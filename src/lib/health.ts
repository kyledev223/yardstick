import "server-only";
import { Keypair } from "@solana/web3.js";
import { AGE_BUCKETS, DATA, GROUPS, PUMP_IPFS_URL, TICK } from "./config";
import { db, hasDatabase } from "./db";
import { env, rpcEndpoints } from "./env";
import { pumpSdk } from "./pump";
import { hostOf, redact } from "./rpc";
import { utcDay } from "./data/budget";
import { lookupTableStatus } from "./launch/lookup-table";

type Check = { ok: boolean; ms: number; detail?: unknown };

async function timed(fn: () => Promise<unknown>): Promise<Check> {
  const t = Date.now();
  try {
    const detail = await fn();
    return { ok: true, ms: Date.now() - t, ...(detail !== undefined ? { detail } : {}) };
  } catch (err) {
    return { ok: false, ms: Date.now() - t, detail: redact(String((err as Error)?.message ?? err)).slice(0, 200) };
  }
}

export async function healthReport() {
  const hints: string[] = [];
  const checks: Record<string, unknown> = {};

  // Configuration
  if (!process.env.DATABASE_URL) hints.push("DATABASE_URL is not set. Add the Neon integration in Vercel (or paste the connection string) and redeploy.");
  if (!process.env.SOLANA_RPC_URL && !process.env.HELIUS_API_KEY)
    hints.push("SOLANA_RPC_URL is not set, so only the public RPC is used. It rate-limits and often refuses Vercel. Add your Helius mainnet URL.");
  if (!env.cronSecret) hints.push("CRON_SECRET is not set, so /api/cron is disabled. Generate one and set up cron-job.org.");
  if (!process.env.SITE_URL) hints.push("SITE_URL is not set. Set it to your public URL (used in the sign-in message and share images).");

  // Database
  checks.database = hasDatabase() ? await timed(() => db().$queryRaw`SELECT 1`) : { ok: false, ms: 0, detail: "not configured" };
  const dbOk = (checks.database as Check).ok;
  if (hasDatabase() && !dbOk) hints.push("The database didn't answer. Check DATABASE_URL and that migrations ran (vercel-build runs prisma migrate deploy).");

  // RPC endpoints (hostnames only)
  checks.rpc = await Promise.all(
    rpcEndpoints().map(async (url) => {
      const c = await timed(async () => {
        const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getLatestBlockhash", params: [] }), signal: AbortSignal.timeout(6000) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as { error?: { message: string } };
        if (j.error) throw new Error(j.error.message);
      });
      return { host: hostOf(url), ...c };
    }),
  );
  const rpcs = checks.rpc as (Check & { host: string })[];
  if (!rpcs.some((r) => r.ok)) hints.push("No RPC endpoint answered getLatestBlockhash. Check SOLANA_RPC_URL.");
  // Hints are shown on the public /status page too, so they never include hostnames, keys or raw errors.
  else if (!rpcs[0].ok) hints.push("The first RPC endpoint failed; requests are falling back to the next one (details in checks.rpc).");

  // pump SDK: build a dummy create instruction
  checks.pumpSdk = await timed(async () => {
    const { PumpSdk } = pumpSdk();
    const kp = Keypair.generate().publicKey;
    const ix = await new PumpSdk().createV2Instruction({ mint: Keypair.generate().publicKey, name: "Health", symbol: "HLTH", uri: "https://example.com/x.json", creator: kp, user: kp, mayhemMode: false });
    return { accounts: ix.keys.length };
  });
  if (!(checks.pumpSdk as Check).ok) hints.push("The pump SDK failed to load. Check serverExternalPackages and the uuid override in package.json.");

  // pump.fun IPFS address answers (any HTTP answer counts). This does NOT prove uploads work:
  // pump.fun has answered GET while failing every upload. Real upload results are in checks.metadataUpload.
  checks.pumpIpfs = await timed(async () => {
    const r = await fetch(PUMP_IPFS_URL, { method: "GET", signal: AbortSignal.timeout(6000) });
    return { status: r.status };
  });
  // Lookup table (needed for create + dev buy to fit in one transaction)
  const lut = await lookupTableStatus().catch(() => null);
  checks.lookupTable = lut;
  if (lut && !lut.configured)
    hints.push("PUMP_LOOKUP_TABLE is not set, so launches with a dev buy may be too large for one transaction. Create it once from a local copy of the site at /setup (about 0.006 SOL), then set the variable and redeploy.");
  else if (lut && lut.configured && !lut.ok) hints.push(`The configured lookup table is ${lut.problem}. Create a new one at /setup on a local copy of the site.`);
  else if (lut && lut.configured && lut.ok && !lut.frozen) hints.push("The lookup table isn't frozen; whoever controls its authority could change it. Create a frozen one at /setup.");

  if (!(checks.pumpIpfs as Check).ok) hints.push(env.pinataJwt ? "pump.fun's IPFS endpoint is unreachable; uploads will use Pinata." : "pump.fun's IPFS endpoint is unreachable from this server and PINATA_JWT is not set, so launches can't upload metadata.");

  if (dbOk) {
    const now = Date.now();
    const [price, lastTick, lastOkTick, dist, usage, coins7d] = await Promise.all([
      db().solPrice.findFirst({ orderBy: { fetchedAt: "desc" } }),
      db().jobRun.findFirst({ where: { name: "tick" }, orderBy: { startedAt: "desc" } }),
      db().jobRun.findFirst({ where: { name: "tick", ok: true, finishedAt: { not: null } }, orderBy: { startedAt: "desc" } }),
      db().distribution.findFirst({ orderBy: { computedAt: "desc" }, select: { computedAt: true } }),
      db().rpcUsage.findMany({ where: { day: utcDay() } }),
      db().coin.groupBy({ by: ["source"], where: { createdAt: { gte: new Date(now - 7 * 86_400_000) } }, _count: true }),
    ]);
    // Real image/metadata uploads made by launches (recorded in lib/launch/metadata.ts).
    const [lastUpload, uploads24h] = await Promise.all([
      db().jobRun.findFirst({ where: { name: "metadata-upload" }, orderBy: { startedAt: "desc" } }),
      db().jobRun.groupBy({ by: ["ok"], where: { name: "metadata-upload", startedAt: { gte: new Date(now - 86_400_000) } }, _count: true }),
    ]);
    const lastSummary = (lastUpload?.summary ?? {}) as { provider?: "pump" | "pinata" | null; pumpFailed?: boolean };
    checks.metadataUpload = {
      pinataFallback: Boolean(env.pinataJwt),
      last: lastUpload
        ? { at: lastUpload.startedAt, minutesAgo: Math.round((now - lastUpload.startedAt.getTime()) / 60000), ok: lastUpload.ok, provider: lastSummary.provider ?? null, pumpFailed: Boolean(lastSummary.pumpFailed), error: lastUpload.error }
        : null,
      last24h: { ok: uploads24h.find((g) => g.ok)?._count ?? 0, failed: uploads24h.find((g) => !g.ok)?._count ?? 0 },
    };
    if (lastUpload && !lastUpload.ok)
      hints.push(
        env.pinataJwt
          ? "The last image upload failed on both pump.fun and the Pinata fallback, so launches can't be prepared. Check the Pinata key and plan (details in checks.metadataUpload.last.error)."
          : "The last image upload failed: pump.fun's upload service refused it and PINATA_JWT is not set, so there's no fallback. Launches can't be prepared until PINATA_JWT is set (free Pinata account).",
      );
    else if (lastUpload && lastSummary.pumpFailed) hints.push("pump.fun's upload service failed on the last launch; the Pinata fallback handled it.");
    if (!env.pinataJwt && lastUpload?.ok !== false) hints.push("PINATA_JWT is not set, so image uploads depend on pump.fun's unofficial upload service alone. Set it (free Pinata account) so launches keep working when that service fails.");

    checks.solPrice = price ? { usd: price.usd, source: price.source, ageMinutes: Math.round((now - price.fetchedAt.getTime()) / 60000) } : null;
    if (!price) hints.push("No SOL price stored yet; it refreshes on the next tick. USD values are hidden until then.");

    const summary = (lastOkTick?.summary ?? {}) as Record<string, { due?: number; done?: number } | unknown>;
    checks.tick = lastTick
      ? {
          lastStartedAt: lastTick.startedAt,
          minutesAgo: Math.round((now - lastTick.startedAt.getTime()) / 60000),
          durationMs: lastTick.durationMs,
          ok: lastTick.ok,
          error: lastTick.error,
          yardstickSnapshots: summary.yardstickSnapshots ?? null,
          baselineSnapshots: summary.baselineSnapshots ?? null,
          discovery: summary.discovery ?? null,
        }
      : null;
    if (!lastTick) hints.push("The background tick has never run. Set up cron-job.org to call /api/cron every 5 minutes (see docs/YARDSTICK.md).");
    else if (now - lastTick.startedAt.getTime() > 15 * 60_000) hints.push(`The last tick was ${Math.round((now - lastTick.startedAt.getTime()) / 60000)} minutes ago. Check the cron-job.org job and CRON_SECRET.`);
    if (lastTick && !lastTick.ok) hints.push("The last tick failed (the error is in checks.tick.error of /api/health, or Vercel → Logs).");

    // Sample sizes per group at each age over the window.
    const bucketCounts = await db().distribution.findMany({ where: { metric: "holders" }, select: { group: true, ageBucket: true, sampleSize: true } });
    const sample: Record<string, Record<string, number>> = {};
    for (const g of GROUPS) sample[g] = Object.fromEntries(AGE_BUCKETS.map((b) => [b.key, bucketCounts.find((r) => r.group === g && r.ageBucket === b.key)?.sampleSize ?? 0]));
    checks.samples = { coins7d: Object.fromEntries(coins7d.map((c) => [c.source, c._count])), perAge: sample };
    for (const b of ["1h", "24h"]) {
      const n = sample.baseline[b];
      if (n < DATA.minSampleForPercentile) hints.push(`Baseline has ${n} coin${n === 1 ? "" : "s"} in the ${b} bucket (needs ${DATA.minSampleForPercentile}); percentiles at that age will show "Not enough data" until more are sampled.`);
    }

    checks.distributions = dist ? { computedAt: dist.computedAt, minutesAgo: Math.round((now - dist.computedAt.getTime()) / 60000) } : null;
    if (dist && now - dist.computedAt.getTime() > (TICK.distributionEveryMinutes + 30) * 60_000) hints.push("Distributions are more than 90 minutes old; the tick may not be running.");

    const used = usage.reduce((s, u) => s + u.credits, 0);
    // Last 7 UTC days, to judge whether BASELINE_DAILY_SAMPLE can be raised. Credits count Helius only.
    const days = Array.from({ length: 7 }, (_, i) => utcDay(new Date(now - i * 86_400_000)));
    const [history, sampledByDay] = await Promise.all([
      db().rpcUsage.groupBy({ by: ["day"], where: { day: { in: days } }, _sum: { credits: true, calls: true, errors: true } }),
      db().$queryRaw<{ day: string; n: number }[]>`
        SELECT to_char("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*)::int AS n FROM "Coin"
        WHERE "source" = 'baseline' AND "createdAt" >= ${new Date(Date.parse(days[6] + "T00:00:00Z"))} GROUP BY 1`,
    ]);
    checks.rpcUsage = {
      creditsToday: used,
      budget: env.rpcDailyBudget,
      baselineDailyTarget: env.baselineDailySample,
      byHost: usage.map((u) => ({ host: u.host, credits: u.credits, calls: u.calls, errors: u.errors })),
      last7Days: days.map((day) => {
        const h = history.find((r) => r.day === day)?._sum;
        return { day, credits: h?.credits ?? 0, calls: h?.calls ?? 0, errors: h?.errors ?? 0, baselineSampled: sampledByDay.find((r) => r.day === day)?.n ?? 0 };
      }),
    };
    if (used > env.rpcDailyBudget * 0.9) hints.push(`RPC usage today is ${used} of ${env.rpcDailyBudget} credits; baseline sampling has paused until tomorrow (UTC).`);
  }

  // A failing last upload means nobody can launch, so it counts against "ok".
  const uploadsBroken = (checks.metadataUpload as { last: { ok: boolean } | null } | undefined)?.last?.ok === false;
  const ok = dbOk && rpcs.some((r) => r.ok) && (checks.pumpSdk as Check).ok && !uploadsBroken;
  return { ok, network: "mainnet", checks, hints };
}
