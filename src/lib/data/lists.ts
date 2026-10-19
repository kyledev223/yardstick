import "server-only";
import { type AgeBucketKey, type GroupKey, type MetricKey, METRICS } from "../config";
import { db } from "../db";
import type { Coin, Snapshot } from "@/generated/prisma/client";
import { displayImage } from "./coins";
import { loadAllDistributions, nearestBucket, standing, type DistMap } from "./distributions";
import { median } from "./percentile";

const startOfUtcDay = () => new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");

export type TodayStats = { launches: number; medianHolders1h: number | null; holders1hSample: number; graduated: number };

export async function todayStats(): Promise<TodayStats> {
  const since = startOfUtcDay();
  const [launches, graduated, oneHour] = await Promise.all([
    db().coin.count({ where: { source: "yardstick", createdAt: { gte: since } } }),
    db().coin.count({ where: { source: "yardstick", graduatedAt: { gte: since } } }),
    db().snapshot.findMany({ where: { ageBucket: "1h", holders: { not: null }, coin: { source: "yardstick", createdAt: { gte: since } } }, select: { holders: true } }),
  ]);
  const hs = oneHour.map((s) => s.holders!) ;
  return { launches, medianHolders1h: hs.length ? median(hs) : null, holders1hSample: hs.length, graduated };
}

export type RankRow = {
  mint: string;
  name: string;
  symbol: string;
  image: string | null;
  creator: string;
  ageSeconds: number;
  holders: number | null;
  netInflowSol: number | null;
  curveProgress: number | null;
  /** Standing within the selected comparison group at `bucket`, or null without enough data. */
  percentile: number | null;
  group: GroupKey;
  /** Fixed age the latest reading is compared at; null before the first reading. */
  bucket: AgeBucketKey | null;
  graduated: boolean;
};

function latestOf(snaps: Snapshot[]): Snapshot | null {
  return snaps.find((s) => s.ageBucket === "latest") ?? [...snaps].sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime())[0] ?? null;
}

function values(s: Snapshot): Partial<Record<MetricKey, number | null>> {
  return Object.fromEntries(METRICS.map((m) => [m, s[m]]));
}

/** Score a coin's latest snapshot against one comparison group at its age. */
function rankOne(coin: Coin & { snapshots: Snapshot[] }, dists: Map<AgeBucketKey, DistMap>, group: GroupKey): RankRow {
  const s = latestOf(coin.snapshots);
  const ageSeconds = Math.round((Date.now() - coin.createdAt.getTime()) / 1000);
  const bucket = s ? nearestBucket(s.ageSeconds) : null;
  const percentile = s && bucket ? standing(values(s), dists.get(bucket) ?? new Map()).percentile : null;
  return {
    mint: coin.mint,
    name: coin.name,
    symbol: coin.symbol,
    image: displayImage(coin.imageUrl),
    creator: coin.creator,
    ageSeconds,
    holders: s?.holders ?? null,
    netInflowSol: s?.netInflowSol ?? null,
    curveProgress: s?.curveProgress ?? null,
    percentile,
    group,
    bucket,
    graduated: Boolean(coin.graduatedAt),
  };
}

/** Yardstick launches ranked by standing in one group; coins without enough data go last. */
export async function leaderboard(opts: { range: "today" | "7d"; graduatedOnly: boolean; group: GroupKey }): Promise<RankRow[]> {
  const since = opts.range === "today" ? startOfUtcDay() : new Date(Date.now() - 7 * 86_400_000);
  const coins = await db().coin.findMany({
    where: { source: "yardstick", createdAt: { gte: since }, ...(opts.graduatedOnly ? { graduatedAt: { not: null } } : {}) },
    include: { snapshots: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const dists = await loadAllDistributions(opts.group);
  return coins
    .map((c) => rankOne(c, dists, opts.group))
    .sort((a, b) => (b.percentile ?? -1) - (a.percentile ?? -1) || (b.holders ?? 0) - (a.holders ?? 0));
}

export type CreatorCoin = {
  mint: string;
  name: string;
  symbol: string;
  image: string | null;
  createdAt: string;
  outcome: "graduated" | "active" | "faded";
  peakMcapSol: number | null;
  bestPercentile: number | null;
};

export async function creatorProfile(wallet: string): Promise<{ coins: CreatorCoin[]; launches: number; graduationRate: number | null }> {
  const coins = await db().coin.findMany({
    where: { creator: wallet, source: "yardstick" },
    include: { snapshots: { orderBy: { takenAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });
  const rows = coins.map((c): CreatorCoin => {
    const ageH = (Date.now() - c.createdAt.getTime()) / 3600_000;
    const last = c.snapshots[0];
    const faded = !c.graduatedAt && (c.trackingStopped || (ageH > 24 && (last?.curveProgress ?? 0) < 5));
    return {
      mint: c.mint,
      name: c.name,
      symbol: c.symbol,
      image: displayImage(c.imageUrl),
      createdAt: c.createdAt.toISOString(),
      outcome: c.graduatedAt ? "graduated" : faded ? "faded" : "active",
      peakMcapSol: c.peakMcapSol,
      bestPercentile: c.bestPercentile,
    };
  });
  return {
    coins: rows,
    launches: rows.length,
    graduationRate: rows.length ? (rows.filter((r) => r.outcome === "graduated").length / rows.length) * 100 : null,
  };
}
