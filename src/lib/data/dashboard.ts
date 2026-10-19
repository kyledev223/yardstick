import "server-only";
import { AGE_BUCKETS, COMPOSITE_WEIGHTS, DATA, GROUPS, LATEST_REFRESH_SECONDS, METRICS, type AgeBucketKey, type GroupKey, type MetricKey } from "../config";
import { db } from "../db";
import type { Coin, Snapshot } from "@/generated/prisma/client";
import { Budget, flushRpcUsage } from "./budget";
import { displayImage } from "./coins";
import { loadAllDistributions, metricPercentiles, nearestBucket, standing, type DistMap } from "./distributions";
import { buildNotes, type Note, type NoteDist } from "./notes";
import { solUsd } from "./price";
import { takeSnapshot } from "./snapshot";

export type MetricCard = {
  key: MetricKey;
  value: number | null;
  /** Per group: percentile at this age, median, breakpoints, sample size. */
  groups: Record<GroupKey, { percentile: number | null; median: number | null; breakpoints: number[]; sampleSize: number; gradMedian: number | null }>;
  spark: { age: number; value: number }[];
};

/**
 * `sampleSize`: coins in the group with a full score at this age (what the standing ranks against).
 * `measured`: coins with any reading at this age. A coin only gets a score once its metrics can be
 * ranked, which needs enough measured coins, so `measured` can exceed `sampleSize`.
 */
export type GroupStanding = { percentile: number | null; composite: number | null; sampleSize: number; measured: number; bucket: AgeBucketKey };

export type BandPoint = { age: number; p25: number; p50: number; p75: number; n: number };

export type CoinView = {
  coin: {
    mint: string;
    name: string;
    symbol: string;
    image: string | null;
    description: string | null;
    creator: string;
    source: Coin["source"];
    createdAt: string;
    ageSeconds: number;
    graduatedAt: string | null;
    twitter: string | null;
    telegram: string | null;
    website: string | null;
    launchSignature: string | null;
  };
  latest: {
    takenAt: string | null;
    mcapSol: number | null;
    mcapUsd: number | null;
    curveProgress: number | null;
    graduated: boolean;
    tradesCapped: boolean;
    tradesCounted: number | null;
    freshSampled: number | null;
    dev: { holdPct: number | null; sold: boolean | null; soldSol: number | null; soldPct: number | null };
    buys: number | null;
    sells: number | null;
    buySol: number | null;
    sellSol: number | null;
  } | null;
  stale: boolean;
  bucket: AgeBucketKey;
  standing: Record<GroupKey, GroupStanding>;
  metrics: MetricCard[];
  trajectory: { coin: { age: number; holders: number | null; mcapSol: number | null }[]; bands: Record<GroupKey, { holders: BandPoint[]; mcapSol: BandPoint[] }> };
  notes: Record<GroupKey, Note[]>;
  milestones: { kind: string; at: string }[];
  solUsd: number | null;
};

const valuesOf = (s: Snapshot | null): Partial<Record<MetricKey, number | null>> => {
  const out: Partial<Record<MetricKey, number | null>> = {};
  if (!s) return out;
  for (const m of METRICS) out[m] = s[m] ?? null;
  return out;
};

function bands(all: Map<AgeBucketKey, DistMap>, metric: MetricKey): BandPoint[] {
  const out: BandPoint[] = [];
  for (const b of AGE_BUCKETS) {
    const d = all.get(b.key)?.get(metric);
    if (!d || d.sampleSize < DATA.minSampleForPercentile || d.breakpoints.length !== 19) continue;
    out.push({ age: b.seconds, p25: d.breakpoints[4], p50: d.breakpoints[9], p75: d.breakpoints[14], n: d.sampleSize });
  }
  return out;
}

export async function coinView(coin: Coin): Promise<CoinView> {
  const now = Date.now();
  const [snaps, milestones, launch, price, ...dists] = await Promise.all([
    db().snapshot.findMany({ where: { coinId: coin.id }, orderBy: { ageSeconds: "asc" } }),
    db().milestone.findMany({ where: { coinId: coin.id }, orderBy: { at: "asc" } }),
    db().launch.findFirst({ where: { coinId: coin.id }, select: { signature: true } }),
    solUsd(),
    ...GROUPS.map((g) => loadAllDistributions(g)),
  ]);
  const distsByGroup = Object.fromEntries(GROUPS.map((g, i) => [g, dists[i]])) as Record<GroupKey, Map<AgeBucketKey, DistMap>>;

  const latest = snaps.find((s) => s.ageBucket === "latest") ?? [...snaps].sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime())[0] ?? null;
  const ageSeconds = Math.round((now - coin.createdAt.getTime()) / 1000);
  // Compare at the age the values were measured (latest snapshot), nearest fixed age.
  const measuredAge = latest ? latest.ageSeconds : ageSeconds;
  const bucket = nearestBucket(measuredAge);
  const values = valuesOf(latest);

  const standingOut = {} as Record<GroupKey, GroupStanding>;
  const notes = {} as Record<GroupKey, Note[]>;
  const percentiles = {} as Record<GroupKey, ReturnType<typeof metricPercentiles>>;
  for (const g of GROUPS) {
    const d = distsByGroup[g].get(bucket) ?? new Map();
    const st = standing(values, d);
    const measured = Math.max(0, ...COMPOSITE_WEIGHTS.map((w) => d.get(w.metric)?.sampleSize ?? 0));
    standingOut[g] = { ...st, measured, bucket };
    percentiles[g] = metricPercentiles(values, d);
    notes[g] = latest
      ? buildNotes({
          values,
          dev: { sold: latest.devSold, soldSol: latest.devSoldSol, soldPct: latest.devSoldPct, holdPct: latest.devHoldPct },
          dists: d as Map<string, NoteDist>,
          ageLabel: bucket,
        })
      : [];
  }

  const series = snaps.filter((s) => s.ageBucket !== "latest" || s === latest);
  const metrics: MetricCard[] = METRICS.filter((m) => m !== "mcapSol").map((m) => ({
    key: m,
    value: values[m] ?? null,
    groups: Object.fromEntries(
      GROUPS.map((g) => {
        const d = distsByGroup[g].get(bucket)?.get(m);
        const enough = !!d && d.sampleSize >= DATA.minSampleForPercentile && d.breakpoints.length === 19;
        return [
          g,
          {
            percentile: percentiles[g][m] ?? null,
            median: enough ? d!.breakpoints[9] : null,
            breakpoints: enough ? d!.breakpoints : [],
            sampleSize: d?.sampleSize ?? 0,
            gradMedian: d?.gradMedian ?? null,
          },
        ];
      }),
    ) as MetricCard["groups"],
    spark: series.filter((s) => s[m] !== null && s[m] !== undefined).map((s) => ({ age: s.ageSeconds, value: s[m] as number })),
  }));

  return {
    coin: {
      mint: coin.mint,
      name: coin.name,
      symbol: coin.symbol,
      image: displayImage(coin.imageUrl),
      description: coin.description,
      creator: coin.creator,
      source: coin.source,
      createdAt: coin.createdAt.toISOString(),
      ageSeconds,
      graduatedAt: coin.graduatedAt?.toISOString() ?? null,
      twitter: coin.twitter,
      telegram: coin.telegram,
      website: coin.website,
      launchSignature: launch?.signature ?? null,
    },
    latest: latest
      ? {
          takenAt: latest.takenAt.toISOString(),
          mcapSol: latest.mcapSol,
          mcapUsd: latest.mcapSol !== null && price ? latest.mcapSol * price.usd : null,
          curveProgress: latest.curveProgress,
          graduated: latest.graduated || Boolean(coin.graduatedAt),
          tradesCapped: latest.tradesCapped,
          tradesCounted: latest.tradesCounted,
          freshSampled: latest.freshSampled,
          dev: { holdPct: latest.devHoldPct, sold: latest.devSold, soldSol: latest.devSoldSol, soldPct: latest.devSoldPct },
          buys: latest.buys,
          sells: latest.sells,
          buySol: latest.buySol,
          sellSol: latest.sellSol,
        }
      : null,
    stale: !latest || now - latest.takenAt.getTime() > LATEST_REFRESH_SECONDS * 1000,
    bucket,
    standing: standingOut,
    metrics,
    trajectory: {
      coin: series.map((s) => ({ age: s.ageSeconds, holders: s.holders, mcapSol: s.mcapSol })),
      bands: Object.fromEntries(GROUPS.map((g) => [g, { holders: bands(distsByGroup[g], "holders"), mcapSol: bands(distsByGroup[g], "mcapSol") }])) as CoinView["trajectory"]["bands"],
    },
    notes,
    milestones: milestones.map((m) => ({ kind: m.kind, at: m.at.toISOString() })),
    solUsd: price?.usd ?? null,
  };
}

/** Refresh the "latest" snapshot while someone is viewing (at most every 2 minutes per coin). */
export async function refreshLatest(coin: Coin): Promise<void> {
  const last = await db().snapshot.findUnique({ where: { coinId_ageBucket: { coinId: coin.id, ageBucket: "latest" } }, select: { takenAt: true } });
  await db().coin.update({ where: { id: coin.id }, data: { lastViewedAt: new Date() } });
  if (last && Date.now() - last.takenAt.getTime() < LATEST_REFRESH_SECONDS * 1000) return;
  if (coin.graduatedAt && last) return; // frozen after graduation
  // Per-coin lock so simultaneous viewers don't double-spend credits.
  const until = new Date(Date.now() + 30_000);
  const got = await db().$queryRaw<{ name: string }[]>`
    INSERT INTO "JobLock" ("name", "owner", "lockedUntil") VALUES (${"latest:" + coin.id}, 'view', ${until})
    ON CONFLICT ("name") DO UPDATE SET "lockedUntil" = EXCLUDED."lockedUntil" WHERE "JobLock"."lockedUntil" < now()
    RETURNING "name"`;
  if (!got.length) return;
  try {
    const budget = await Budget.create(9000, coin.source === "external" ? 80 : 150);
    await takeSnapshot(coin, "latest", budget);
  } finally {
    await flushRpcUsage().catch(() => {});
  }
}
