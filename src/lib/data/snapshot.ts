import "server-only";
import { AGE_BUCKETS, DATA, type AgeBucketKey } from "../config";
import { curveProgressPct, marketCapSol, netInflowSol } from "../curve";
import { db } from "../db";
import type { Coin } from "@/generated/prisma/client";
import type { Budget } from "./budget";
import { fetchCurve, initialRealTokenReserves } from "./curve-account";
import { freshWalletShare } from "./fresh";
import { fetchHolders } from "./holders";
import { syncTrades } from "./trades";

export type SnapshotOutcome = "done" | "deferred" | "not-found";

export function tradeCap(source: Coin["source"]): number {
  return source === "yardstick" ? DATA.tradeCapYardstick : source === "baseline" ? DATA.tradeCapBaseline : DATA.tradeCapExternal;
}

type Agg = {
  buys: bigint;
  sells: bigint;
  buy_lamports: bigint | string;
  sell_lamports: bigint | string;
  unique_buyers: bigint;
  dev_sells: bigint;
  dev_sold_lamports: bigint | string;
  dev_sold_tokens: bigint | string;
  sniper_tokens: bigint | string;
  first_slot: bigint | null;
};

async function tradeAggregates(coin: Coin, until: Date): Promise<Agg> {
  const rows = await db().$queryRaw<Agg[]>`
    SELECT
      count(*) FILTER (WHERE "isBuy") AS buys,
      count(*) FILTER (WHERE NOT "isBuy") AS sells,
      coalesce(sum(lamports) FILTER (WHERE "isBuy"), 0) AS buy_lamports,
      coalesce(sum(lamports) FILTER (WHERE NOT "isBuy"), 0) AS sell_lamports,
      count(DISTINCT "user") FILTER (WHERE "isBuy") AS unique_buyers,
      count(*) FILTER (WHERE NOT "isBuy" AND "user" = ${coin.creator}) AS dev_sells,
      coalesce(sum(lamports) FILTER (WHERE NOT "isBuy" AND "user" = ${coin.creator}), 0) AS dev_sold_lamports,
      coalesce(sum(tokens) FILTER (WHERE NOT "isBuy" AND "user" = ${coin.creator}), 0) AS dev_sold_tokens,
      coalesce(sum(tokens) FILTER (WHERE "isBuy" AND "user" <> ${coin.creator}
        AND slot <= coalesce(${coin.createSlot}, (SELECT min(slot) FROM "Trade" WHERE "coinId" = ${coin.id})) + ${DATA.sniperSlots}), 0) AS sniper_tokens,
      min(slot) AS first_slot
    FROM "Trade" WHERE "coinId" = ${coin.id} AND "blockTime" <= ${until}`;
  return rows[0];
}

/**
 * Take a snapshot of `coin` for a fixed age bucket or "latest". Trades must be caught up
 * first; if the budget runs out on the way, returns "deferred" and the next tick resumes.
 */
export async function takeSnapshot(coin: Coin, bucket: AgeBucketKey | "latest", budget: Budget, opts: { allowPartial?: boolean } = {}): Promise<SnapshotOutcome> {
  // Leave time for the curve and holder reads: a page view syncs at most 40 transactions.
  const sync = await syncTrades(coin, budget, { cap: tradeCap(coin.source), ...(bucket === "latest" ? { maxTx: 40 } : {}) });
  // "latest" never waits for a trade backlog (curve and holder metrics don't need it); fixed ages
  // wait unless their window is about to close. Either way, partial trade metrics are labelled
  // "based on the first N trades", which is exact because trades sync oldest first.
  const partial = !sync.caughtUp;
  if (partial && bucket !== "latest" && !opts.allowPartial) return "deferred";
  if (!budget.ok(2)) return "deferred";

  const curve = await fetchCurve(coin.bondingCurve);
  if (!curve) return "not-found";
  const takenAt = new Date();
  const supply = curve.tokenTotalSupply || 1_000_000_000_000_000n;
  const initialReal = await initialRealTokenReserves();
  const graduated = curve.complete || Boolean(coin.graduatedAt) || Boolean(sync.graduatedAt);

  // Holders: reuse the previous reading if nothing has traded since (saves credits on quiet coins).
  const prev = await db().snapshot.findFirst({ where: { coinId: coin.id, holders: { not: null } }, orderBy: { takenAt: "desc" } });
  let holders: number | null = null;
  let top10Pct: number | null = null;
  let devHoldPct: number | null = null;
  const tradedSince = prev ? await db().trade.count({ where: { coinId: coin.id, blockTime: { gt: prev.takenAt } } }) : 1;
  if (prev && tradedSince === 0 && !sync.capped) {
    holders = prev.holders;
    top10Pct = prev.top10Pct;
    devHoldPct = prev.devHoldPct;
  } else {
    const h = await fetchHolders(coin.mint, coin.bondingCurve, coin.tokenProgram, supply, budget);
    if (!h) return "deferred";
    holders = h.holders;
    top10Pct = h.top10Pct;
    devHoldPct = Number(((h.balances.get(coin.creator) ?? 0n) * 1_000_000n) / supply) / 10_000;
  }

  const a = await tradeAggregates(coin, takenAt);
  const buys = Number(a.buys);
  const sells = Number(a.sells);
  const buySol = Number(a.buy_lamports) / 1e9;
  const sellSol = Number(a.sell_lamports) / 1e9;
  const devSoldTokens = BigInt(a.dev_sold_tokens.toString());
  if (coin.createSlot === null && a.first_slot !== null) {
    await db().coin.update({ where: { id: coin.id }, data: { createSlot: a.first_slot } });
  }

  // Fresh wallets: only up to 24h (after that the buyer set barely changes). "latest" uses the cache plus a few checks.
  let fresh: { pct: number; sampled: number } | null = null;
  const bucketSeconds = AGE_BUCKETS.find((b) => b.key === bucket)?.seconds ?? 0;
  if (bucket === "latest" || bucketSeconds <= 24 * 3600) {
    const buyers = await db().$queryRaw<{ user: string; first_buy: Date }[]>`
      SELECT "user", min("blockTime") AS first_buy FROM "Trade"
      WHERE "coinId" = ${coin.id} AND "isBuy" AND "user" <> ${coin.creator}
      GROUP BY "user"`;
    fresh = await freshWalletShare(coin.mint, buyers.map((b) => ({ user: b.user, firstBuy: b.first_buy })), budget, bucket === "latest" ? 5 : DATA.freshSampleSize);
  }

  // After migration the curve's reserves are emptied: use the reserves at the last curve trade (graduation).
  let reserves = { vSol: curve.virtualSolReserves, vTokens: curve.virtualTokenReserves, rSol: curve.realSolReserves };
  if (curve.virtualTokenReserves === 0n) {
    const last = await db().trade.findFirst({ where: { coinId: coin.id }, orderBy: [{ slot: "desc" }, { idx: "desc" }] });
    if (last) reserves = { vSol: last.vSol, vTokens: last.vTokens, rSol: last.rSol };
  }
  const mcap = reserves.vTokens > 0n ? marketCapSol({ virtualSolReserves: reserves.vSol, virtualTokenReserves: reserves.vTokens, tokenTotalSupply: supply }) : null;
  const data = {
    ageSeconds: Math.round((takenAt.getTime() - coin.createdAt.getTime()) / 1000),
    takenAt,
    holders,
    uniqueBuyers: Number(a.unique_buyers),
    buys,
    sells,
    buySol,
    sellSol,
    netInflowSol: netInflowSol(reserves.rSol),
    buySellCountRatio: buys / Math.max(sells, 1),
    buySellSolRatio: sellSol > 0 ? buySol / sellSol : null, // undefined until the first sell
    curveProgress: curveProgressPct(curve.realTokenReserves, initialReal, curve.complete),
    mcapSol: mcap,
    top10Pct,
    devHoldPct,
    devSold: Number(a.dev_sells) > 0,
    devSoldSol: Number(a.dev_sold_lamports) / 1e9,
    devSoldPct: Number((devSoldTokens * 1_000_000n) / supply) / 10_000,
    sniperPct: Number((BigInt(a.sniper_tokens.toString()) * 1_000_000n) / supply) / 10_000,
    freshWalletPct: fresh?.pct ?? null,
    freshSampled: fresh?.sampled ?? null,
    tradesCounted: buys + sells,
    tradesCapped: sync.capped || partial,
    graduated,
  };
  await db().snapshot.upsert({
    where: { coinId_ageBucket: { coinId: coin.id, ageBucket: bucket } },
    create: { coinId: coin.id, ageBucket: bucket, ...data },
    update: data,
  });

  await updateMilestonesAndPeak(coin, holders, takenAt, initialReal, supply);
  if (curve.complete && !coin.graduatedAt) {
    await db().coin.update({ where: { id: coin.id }, data: { graduatedAt: sync.graduatedAt ?? takenAt } });
    await db().milestone.upsert({ where: { coinId_kind: { coinId: coin.id, kind: "graduated" } }, create: { coinId: coin.id, kind: "graduated", at: sync.graduatedAt ?? takenAt }, update: {} });
  }
  return "done";
}

async function updateMilestonesAndPeak(coin: Coin, holders: number | null, takenAt: Date, initialReal: bigint, supply: bigint) {
  const existing = new Set((await db().milestone.findMany({ where: { coinId: coin.id }, select: { kind: true } })).map((m) => m.kind));
  const add = (kind: string, at: Date) => db().milestone.upsert({ where: { coinId_kind: { coinId: coin.id, kind } }, create: { coinId: coin.id, kind, at }, update: {} });

  // Holder count is only known at snapshot time, so this milestone is "first seen at".
  if (!existing.has("holders50") && holders !== null && holders >= 50) await add("holders50", takenAt);

  // Curve milestones come from the trade log, so they are exact.
  for (const [kind, frac] of [
    ["curve25", 25n],
    ["curve50", 50n],
  ] as const) {
    if (existing.has(kind)) continue;
    const threshold = (initialReal * (100n - frac)) / 100n; // rTokens at or below this = progress ≥ frac
    const first = await db().trade.findFirst({ where: { coinId: coin.id, rTokens: { lte: threshold } }, orderBy: [{ blockTime: "asc" }, { idx: "asc" }], select: { blockTime: true } });
    if (first) await add(kind, first.blockTime);
  }

  const peak = await db().$queryRaw<{ peak: number | null }[]>`
    SELECT max(("vSol"::numeric * ${supply.toString()}::numeric / nullif("vTokens", 0)::numeric) / 1e9)::float8 AS peak
    FROM "Trade" WHERE "coinId" = ${coin.id}`;
  const p = peak[0]?.peak;
  if (p && (!coin.peakMcapSol || p > coin.peakMcapSol)) await db().coin.update({ where: { id: coin.id }, data: { peakMcapSol: p } });
}
