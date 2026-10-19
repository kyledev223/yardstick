import "server-only";
import { randomBytes } from "node:crypto";
import { AGE_BUCKETS, TICK, snapshotWindowSeconds, type AgeBucketKey } from "../config";
import { db } from "../db";
import { redact } from "../rpc";
import type { CoinSource } from "@/generated/prisma/client";
import { baselineSource } from "../data/baseline";
import { Budget, flushRpcUsage } from "../data/budget";
import { fetchCoinMetadata } from "../data/coins";
import { refreshDistributions } from "../data/distributions";
import { refreshSolPrice } from "../data/price";
import { takeSnapshot } from "../data/snapshot";
import { finalizePending } from "../launch/finalize";

type StepLog = Record<string, unknown>;

async function acquire(name: string, seconds: number): Promise<string | null> {
  const owner = randomBytes(8).toString("hex");
  const until = new Date(Date.now() + seconds * 1000);
  const rows = await db().$queryRaw<{ owner: string }[]>`
    INSERT INTO "JobLock" ("name", "owner", "lockedUntil") VALUES (${name}, ${owner}, ${until})
    ON CONFLICT ("name") DO UPDATE SET "owner" = EXCLUDED."owner", "lockedUntil" = EXCLUDED."lockedUntil"
    WHERE "JobLock"."lockedUntil" < now()
    RETURNING "owner"`;
  return rows[0]?.owner === owner ? owner : null;
}

async function release(name: string, owner: string) {
  await db().jobLock.updateMany({ where: { name, owner }, data: { lockedUntil: new Date(0) } });
}

async function kvGet(key: string): Promise<number> {
  const row = await db().keyValue.findUnique({ where: { key } });
  return typeof row?.value === "number" ? row.value : 0;
}
async function kvSet(key: string, value: number) {
  await db().keyValue.upsert({ where: { key }, create: { key, value }, update: { value } });
}

type Due = { coinId: string; bucket: AgeBucketKey | "latest"; deadline: number };

/** Fixed-age snapshots that are due now (inside their window), most urgent first. */
async function dueSnapshots(sources: CoinSource[]): Promise<Due[]> {
  const now = Date.now();
  const coins = await db().coin.findMany({
    where: { source: { in: sources }, trackingStopped: false },
    select: { id: true, createdAt: true, graduatedAt: true, snapshots: { select: { ageBucket: true, graduated: true } } },
  });
  const due: Due[] = [];
  const stop: string[] = [];
  for (const c of coins) {
    const age = (now - c.createdAt.getTime()) / 1000;
    const have = new Set(c.snapshots.map((s) => s.ageBucket));
    const last = AGE_BUCKETS[AGE_BUCKETS.length - 1];
    if (age > last.seconds + snapshotWindowSeconds(last.seconds)) {
      stop.push(c.id);
      continue;
    }
    if (c.graduatedAt && !c.snapshots.some((s) => s.graduated)) {
      // Graduated: one final snapshot now (as "latest"); closeGraduated() files it under later ages.
      due.push({ coinId: c.id, bucket: "latest", deadline: 0 });
      continue;
    }
    for (const b of AGE_BUCKETS) {
      const end = b.seconds + snapshotWindowSeconds(b.seconds);
      if (age >= b.seconds && age <= end && !have.has(b.key)) due.push({ coinId: c.id, bucket: b.key, deadline: end - age });
    }
  }
  if (stop.length) await db().coin.updateMany({ where: { id: { in: stop } }, data: { trackingStopped: true } });
  return due.sort((a, b) => a.deadline - b.deadline);
}

/**
 * After a graduated coin's final snapshot, file its final values under every later age too,
 * so later-age comparisons still include coins that graduated early (no survivorship bias).
 */
async function closeGraduated(coinId: string) {
  const coin = await db().coin.findUnique({ where: { id: coinId }, include: { snapshots: true } });
  if (!coin?.graduatedAt) return;
  const final = [...coin.snapshots].sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime())[0];
  if (!final || !final.graduated) return;
  const have = new Set(coin.snapshots.map((s) => s.ageBucket));
  const skip = new Set(["id", "coinId", "ageBucket", "ageSeconds", "percentile"]);
  const values = Object.fromEntries(Object.entries(final).filter(([k]) => !skip.has(k))) as Omit<typeof final, "id" | "coinId" | "ageBucket" | "ageSeconds" | "percentile">;
  const finalAge = final.ageSeconds;
  for (const b of AGE_BUCKETS) {
    if (b.seconds <= finalAge || have.has(b.key)) continue;
    await db().snapshot.create({ data: { coinId, ageBucket: b.key, ageSeconds: b.seconds, ...values } });
  }
  await db().coin.update({ where: { id: coinId }, data: { trackingStopped: true } });
}

async function runSnapshots(sources: CoinSource[], budget: Budget, log: StepLog, key: string) {
  const due = await dueSnapshots(sources);
  let done = 0;
  let deferred = 0;
  for (const d of due) {
    if (!budget.ok(15)) break;
    const coin = await db().coin.findUnique({ where: { id: d.coinId } });
    if (!coin) continue;
    try {
      const out = await takeSnapshot(coin, d.bucket, budget, { allowPartial: d.deadline < 180 });
      if (out === "done") {
        done++;
        const fresh = await db().coin.findUnique({ where: { id: coin.id }, select: { graduatedAt: true } });
        if (fresh?.graduatedAt) await closeGraduated(coin.id);
      } else if (out === "not-found") {
        await db().coin.update({ where: { id: coin.id }, data: { trackingStopped: true } });
      } else deferred++;
    } catch (err) {
      deferred++;
      log[`${key}Error`] = redact(String((err as Error).message ?? err)).slice(0, 200);
    }
  }
  log[key] = { due: due.length, done, deferred };
}

export type TickOptions = { reason: string; only?: "finalize" };

export async function tick(opts: TickOptions): Promise<StepLog> {
  const owner = await acquire("tick", TICK.lockSeconds);
  if (!owner) return { skipped: "locked" };
  const started = Date.now();
  const run = await db().jobRun.create({ data: { name: "tick" } });
  const log: StepLog = { reason: opts.reason };
  let ok = true;
  try {
    const budget = await Budget.create(TICK.budgetMs, TICK.creditsPerTick);
    log.finalized = await finalizePending();
    if (opts.only === "finalize") return log;

    await runSnapshots(["yardstick"], budget, log, "yardstickSnapshots");

    if (budget.ok(10)) {
      try {
        log.discovery = await baselineSource().discover(budget);
      } catch (err) {
        log.discoveryError = redact(String((err as Error).message ?? err)).slice(0, 200);
      }
    }
    await runSnapshots(["baseline"], budget, log, "baselineSnapshots");

    // Off-chain metadata (no RPC credits): a few per tick.
    const needMeta = await db().coin.findMany({ where: { metaFetchedAt: null, uri: { not: null } }, orderBy: { enrolledAt: "desc" }, take: 6, select: { id: true, uri: true } });
    let meta = 0;
    for (const c of needMeta) {
      if (budget.msLeft() < 1500) break;
      await fetchCoinMetadata(c);
      meta++;
    }
    log.metadata = meta;

    const now = Date.now();
    if (now - (await kvGet("distributions:at")) > TICK.distributionEveryMinutes * 60_000) {
      log.distributions = await refreshDistributions();
      await kvSet("distributions:at", now);
    }
    if (now - (await kvGet("price:at")) > TICK.solPriceEveryMinutes * 60_000) {
      log.solPrice = await refreshSolPrice();
      await kvSet("price:at", now);
    }
    if (now - (await kvGet("prune:at")) > 24 * 3600_000) {
      log.pruned = await prune();
      await kvSet("prune:at", now);
    }
    log.credits = budget.spent();
    return log;
  } catch (err) {
    ok = false;
    log.error = redact(String((err as Error).message ?? err)).slice(0, 300);
    return log;
  } finally {
    await flushRpcUsage().catch(() => {});
    const durationMs = Date.now() - started;
    await db()
      .jobRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), durationMs, ok, summary: JSON.parse(JSON.stringify(log, (_k, v) => (typeof v === "bigint" ? v.toString() : v))), error: ok ? null : String(log.error ?? "") } })
      .catch(() => {});
    await kvSet("tick:at", Date.now()).catch(() => {});
    await release("tick", owner).catch(() => {});
  }
}

/** Keep the free database small. */
async function prune() {
  const day = 86_400_000;
  const now = Date.now();
  const r = await Promise.all([
    db().trade.deleteMany({ where: { coin: { trackingStopped: true, source: { not: "external" }, createdAt: { lt: new Date(now - 8 * day) } } } }),
    db().trade.deleteMany({ where: { coin: { source: "external", OR: [{ lastViewedAt: null }, { lastViewedAt: { lt: new Date(now - 3 * day) } }] } } }),
    db().authNonce.deleteMany({ where: { expiresAt: { lt: new Date(now - day) } } }),
    db().session.deleteMany({ where: { expiresAt: { lt: new Date(now) } } }),
    db().jobRun.deleteMany({ where: { startedAt: { lt: new Date(now - 3 * day) } } }),
    db().solPrice.deleteMany({ where: { fetchedAt: { lt: new Date(now - 7 * day) } } }),
    db().launchActivity.deleteMany({ where: { hour: { lt: new Date(now - 14 * day) } } }),
    db().walletAge.deleteMany({ where: { checkedAt: { lt: new Date(now - 30 * day) } } }),
    db().rateLimit.deleteMany({ where: { windowStart: { lt: new Date(now - day) } } }),
    db().rpcUsage.deleteMany({ where: { day: { lt: new Date(now - 60 * day).toISOString().slice(0, 10) } } }),
  ]);
  // Old baseline coins: drop the coin rows too (snapshots cascade); distributions only use 7 days.
  const old = await db().coin.deleteMany({ where: { source: "baseline", createdAt: { lt: new Date(now - 30 * day) } } });
  return { trades: r[0].count + r[1].count, baselineCoins: old.count };
}

let lastLocalTick = 0;

/** Called from busy page loads via after(): tick if nobody has for a minute. */
export async function maybeTick(reason: string) {
  if (Date.now() - lastLocalTick < TICK.minGapSeconds * 1000) return;
  lastLocalTick = Date.now();
  try {
    if (Date.now() - (await kvGet("tick:at")) < TICK.minGapSeconds * 1000) return;
    await tick({ reason });
  } catch {
    // background work: never break the page
  }
}
