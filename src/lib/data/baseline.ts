import "server-only";
import { PUMP_MINT_AUTHORITY } from "../config";
import { db } from "../db";
import { env } from "../env";
import { parsePumpTx } from "../pump-events";
import { rpcCall } from "../rpc";
import type { Budget } from "./budget";
import { enrollFromCreate } from "./coins";
import { getRawTx } from "./trades";

export type DiscoveryResult = { source: string; createsSeen: number; sampled: number; enrolled: number; skipped: number };

/** Where baseline coins come from. Swap in another implementation without touching the rest. */
export interface BaselineSource {
  readonly name: string;
  discover(budget: Budget): Promise<DiscoveryResult>;
}

type SigInfo = { signature: string; err: unknown; blockTime: number | null };
type Cursor = { lastSig?: string; lastTime?: number; eligibleShare?: number; lastRunAt?: number; carry?: number };

const KV_KEY = "baseline:onchain";

async function getKV<T>(key: string): Promise<T | null> {
  const row = await db().keyValue.findUnique({ where: { key } });
  return (row?.value as T) ?? null;
}
async function setKV(key: string, value: object) {
  await db().keyValue.upsert({ where: { key }, create: { key, value }, update: { value } });
}

/** Spread a covered time window [t0, t1] (unix seconds) across hour rows, adding creates per hour. */
export function coverageByHour(t0: number, t1: number, createTimes: number[]): Map<number, { creates: number; covered: number }> {
  const out = new Map<number, { creates: number; covered: number }>();
  const hourOf = (t: number) => Math.floor(t / 3600) * 3600;
  for (let h = hourOf(t0); h <= hourOf(t1); h += 3600) {
    const covered = Math.max(0, Math.min(t1, h + 3600) - Math.max(t0, h));
    out.set(h, { creates: 0, covered });
  }
  for (const t of createTimes) {
    const row = out.get(hourOf(t));
    if (row) row.creates++;
  }
  return out;
}

/** Creates per hour: overall over 7 days, and at this hour of day. Null without enough coverage. */
export async function launchRates(): Promise<{ avgPerHour: number | null; thisHourOfDayAvg: number | null; recentPerHour: number | null; avgCoveredHours: number }> {
  const since = new Date(Date.now() - 7 * 86_400_000);
  const rows = await db().launchActivity.findMany({ where: { hour: { gte: since } } });
  const rate = (rs: typeof rows) => {
    const covered = rs.reduce((s, r) => s + r.coveredSeconds, 0);
    return covered >= 1800 ? (rs.reduce((s, r) => s + r.creates, 0) / covered) * 3600 : null;
  };
  const nowHour = new Date().getUTCHours();
  const recent = rows.filter((r) => r.hour.getTime() >= Date.now() - 2 * 3600_000);
  // The 7-day average excludes the last 2 hours so "now" and "usual" don't overlap.
  const older = rows.filter((r) => r.hour.getTime() < Date.now() - 2 * 3600_000);
  return {
    avgCoveredHours: older.reduce((s, r) => s + r.coveredSeconds, 0) / 3600,
    avgPerHour: rate(older),
    thisHourOfDayAvg: rate(older.filter((r) => r.hour.getUTCHours() === nowHour)),
    recentPerHour: rate(recent),
  };
}

/**
 * Default source: read create signatures from pump's mint-authority account (touched only
 * by creates), record the launch rate, and enrol a random sample of SOL-quoted, non-mayhem coins.
 */
export class OnchainBaselineSource implements BaselineSource {
  readonly name = "onchain";

  async discover(budget: Budget): Promise<DiscoveryResult> {
    const res: DiscoveryResult = { source: this.name, createsSeen: 0, sampled: 0, enrolled: 0, skipped: 0 };
    if (!budget.ok(2)) return res;
    const cursor = (await getKV<Cursor>(KV_KEY)) ?? {};
    const fetchSigs = (until?: string) =>
      rpcCall<SigInfo[]>("getSignaturesForAddress", [PUMP_MINT_AUTHORITY, { limit: 1000, commitment: "confirmed", ...(until ? { until } : {}) }]);
    let sigs: SigInfo[];
    try {
      sigs = await fetchSigs(cursor.lastSig);
    } catch (err) {
      // A load-balanced RPC node may not know the cursor signature yet: start a fresh window.
      if (!/not found/i.test(String((err as Error)?.message))) throw err;
      cursor.lastSig = undefined;
      cursor.lastTime = undefined;
      sigs = await fetchSigs();
    }
    if (sigs.length === 0) return res;

    // Launch-rate bookkeeping. With fewer than 1000 results the window since the last cursor is contiguous.
    const ok = sigs.filter((s) => !s.err && s.blockTime);
    const times = ok.map((s) => s.blockTime!) as number[];
    const newest = sigs[0].blockTime ?? Math.floor(Date.now() / 1000);
    const contiguous = sigs.length < 1000 && cursor.lastTime !== undefined && newest - cursor.lastTime! < 6 * 3600;
    const oldest = sigs[sigs.length - 1].blockTime ?? newest;
    const t0 = contiguous ? cursor.lastTime! : oldest;
    for (const [hour, v] of coverageByHour(t0, newest, times)) {
      const h = new Date(hour * 1000);
      await db().launchActivity.upsert({
        where: { hour: h },
        create: { hour: h, creates: v.creates, coveredSeconds: v.covered },
        update: { creates: { increment: v.creates }, coveredSeconds: { increment: v.covered } },
      });
    }
    res.createsSeen = ok.length;
    // Share of creates that are eligible (SOL-quoted, non-mayhem); a running estimate used to
    // over-sample enough to hit the daily target. Starts at 0.55 (measured Oct 2026).
    const eligibleShare = Math.min(1, Math.max(0.1, cursor.eligibleShare ?? 0.55));

    // Sampling quota by elapsed time: BASELINE_DAILY_SAMPLE per day, spread evenly, slowed by the
    // RPC budget. Fractions carry over between runs. Picks are uniform among the creates just seen.
    const now = Date.now();
    const elapsed = Math.min(3600, Math.max(0, (now - (cursor.lastRunAt ?? now - 300_000)) / 1000));
    const startOfDay = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
    const enrolledToday = await db().coin.count({ where: { source: "baseline", enrolledAt: { gte: startOfDay } } });
    const remaining = Math.max(0, env.baselineDailySample - enrolledToday);
    let quota = Math.min(20, (cursor.carry ?? 0) + ((env.baselineDailySample * elapsed) / 86400 / eligibleShare) * budget.baselineFactor());
    const n = Math.min(Math.floor(quota), 8, remaining > 0 ? Math.ceil(remaining / eligibleShare) : 0, ok.length);
    quota -= n;
    const shuffled = [...ok].sort(() => Math.random() - 0.5);
    const picks = shuffled.slice(0, n);
    const save = (share: number) => setKV(KV_KEY, { lastSig: sigs[0].signature, lastTime: newest, eligibleShare: share, lastRunAt: now, carry: remaining > 0 ? quota : 0 });
    await save(eligibleShare);
    for (const s of picks) {
      if (!budget.ok(3)) break;
      res.sampled++;
      const raw = await getRawTx(s.signature);
      if (!raw) continue;
      const parsed = parsePumpTx(raw, s.signature);
      const create = parsed.creates[0];
      // Like-for-like: only SOL-priced, non-mayhem coins (Yardstick launches are both).
      if (!create || create.quoteMint || create.isMayhem) {
        res.skipped++;
        continue;
      }
      await enrollFromCreate(parsed, create, "baseline");
      res.enrolled++;
    }
    const seen = res.enrolled + res.skipped;
    if (seen > 0) {
      await save(0.9 * eligibleShare + 0.1 * (res.enrolled / seen));
    }
    return res;
  }
}

export function baselineSource(): BaselineSource {
  return new OnchainBaselineSource();
}
