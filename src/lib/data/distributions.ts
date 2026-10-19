import "server-only";
import { AGE_BUCKETS, COMPOSITE_WEIGHTS, DATA, GROUPS, METRICS, type AgeBucketKey, type GroupKey, type MetricKey } from "../config";
import { db } from "../db";
import type { Distribution } from "@/generated/prisma/client";
import { breakpoints, compositeScore, median, percentileOf, type MetricPercentiles } from "./percentile";

export type MetricValues = Partial<Record<MetricKey, number | null>>;
export type DistKey = MetricKey | "composite";
export type DistMap = Map<DistKey, Distribution>;

const metricSelect = Object.fromEntries(METRICS.map((m) => [m, true])) as Record<MetricKey, true>;

/** Percentile of each metric (only where the group has enough coins at that age). */
export function metricPercentiles(values: MetricValues, dists: DistMap): MetricPercentiles {
  const out: MetricPercentiles = {};
  for (const m of METRICS) {
    const v = values[m];
    const d = dists.get(m);
    if (v === null || v === undefined || !d || d.sampleSize < DATA.minSampleForPercentile) continue;
    out[m] = percentileOf(v, d.breakpoints);
  }
  return out;
}

/** Composite score and its percentile among the group's composites. */
export function standing(values: MetricValues, dists: DistMap): { composite: number | null; percentile: number | null; sampleSize: number } {
  const composite = compositeScore(metricPercentiles(values, dists));
  const cd = dists.get("composite");
  if (composite === null || !cd || cd.sampleSize < DATA.minSampleForPercentile) return { composite, percentile: null, sampleSize: cd?.sampleSize ?? 0 };
  return { composite, percentile: percentileOf(composite, cd.breakpoints), sampleSize: cd.sampleSize };
}

export async function loadDistributions(group: GroupKey, bucket: AgeBucketKey): Promise<DistMap> {
  const rows = await db().distribution.findMany({ where: { group, ageBucket: bucket } });
  return new Map(rows.map((r) => [r.metric as DistKey, r]));
}

export async function loadAllDistributions(group: GroupKey): Promise<Map<AgeBucketKey, DistMap>> {
  const rows = await db().distribution.findMany({ where: { group } });
  const out = new Map<AgeBucketKey, DistMap>();
  for (const r of rows) {
    const k = r.ageBucket as AgeBucketKey;
    if (!out.has(k)) out.set(k, new Map());
    out.get(k)!.set(r.metric as DistKey, r);
  }
  return out;
}

/** Nearest fixed age to `ageSeconds`, on a log scale ("2h 14m" → "2h"). */
export function nearestBucket(ageSeconds: number): AgeBucketKey {
  let best: AgeBucketKey = AGE_BUCKETS[0].key;
  let bestD = Infinity;
  for (const b of AGE_BUCKETS) {
    const d = Math.abs(Math.log(Math.max(ageSeconds, 60)) - Math.log(b.seconds));
    if (d < bestD) {
      bestD = d;
      best = b.key;
    }
  }
  return best;
}

/** Rebuild every (group, age, metric) distribution over the rolling window. */
export async function refreshDistributions(): Promise<{ rows: number; scored: number }> {
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - DATA.distributionWindowDays * 86_400_000);
  let rows = 0;

  for (const group of GROUPS) {
    for (const b of AGE_BUCKETS) {
      const snaps = await db().snapshot.findMany({
        where: { ageBucket: b.key, coin: { source: group, createdAt: { gte: windowStart } } },
        select: { ...metricSelect, coin: { select: { graduatedAt: true } } },
      });
      const fresh: DistMap = new Map();
      const write = async (metric: DistKey, values: number[], gradValues: number[]) => {
        const data = {
          breakpoints: values.length ? breakpoints(values) : [],
          sampleSize: values.length,
          gradMedian: gradValues.length >= DATA.minSampleForGraduated ? median(gradValues) : null,
          gradSampleSize: gradValues.length,
          windowStart,
          windowEnd,
          computedAt: windowEnd,
        };
        const row = await db().distribution.upsert({
          where: { group_ageBucket_metric: { group, ageBucket: b.key, metric } },
          create: { group, ageBucket: b.key, metric, ...data },
          update: data,
        });
        fresh.set(metric, row);
        rows++;
      };
      for (const m of METRICS) {
        const vals: number[] = [];
        const grad: number[] = [];
        for (const s of snaps) {
          const v = s[m];
          if (v === null || v === undefined || !Number.isFinite(v)) continue;
          vals.push(v);
          if (s.coin.graduatedAt) grad.push(v);
        }
        await write(m, vals, grad);
      }
      // Composite distribution, so "Top 18%" is a real percentile and not an average of percentiles.
      const comps: number[] = [];
      const gradComps: number[] = [];
      for (const s of snaps) {
        const c = compositeScore(metricPercentiles(s, fresh));
        if (c === null) continue;
        comps.push(c);
        if (s.coin.graduatedAt) gradComps.push(c);
      }
      await write("composite", comps, gradComps);
    }
  }

  const scored = await scoreNewSnapshots(windowStart);
  return { rows, scored };
}

/** Fill Snapshot.percentile (vs baseline) for fixed-age snapshots that don't have one yet. */
async function scoreNewSnapshots(windowStart: Date): Promise<number> {
  const baseline = await loadAllDistributions("baseline");
  const pending = await db().snapshot.findMany({
    where: { percentile: null, ageBucket: { not: "latest" }, takenAt: { gte: windowStart } },
    select: { id: true, coinId: true, ageBucket: true, ...metricSelect },
    take: 400,
  });
  let n = 0;
  const best = new Map<string, number>();
  for (const s of pending) {
    const d = baseline.get(s.ageBucket as AgeBucketKey);
    if (!d) continue;
    const st = standing(s, d);
    if (st.percentile === null) continue;
    await db().snapshot.update({ where: { id: s.id }, data: { percentile: st.percentile } });
    best.set(s.coinId, Math.max(best.get(s.coinId) ?? 0, st.percentile));
    n++;
  }
  for (const [coinId, p] of best) {
    await db().coin.updateMany({ where: { id: coinId, OR: [{ bestPercentile: null }, { bestPercentile: { lt: p } }] }, data: { bestPercentile: p } });
  }
  return n;
}

export const COMPOSITE_METRICS = COMPOSITE_WEIGHTS.map((w) => w.metric);
