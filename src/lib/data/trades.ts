import "server-only";
import { db } from "../db";
import { parsePumpTx, type ParsedTx, type RawTx } from "../pump-events";
import { endpointsFor, isMethodSupported, rpcCall, RpcError } from "../rpc";
import type { Budget } from "./budget";

export type CoinRef = { id: string; mint: string; bondingCurve: string };
export type SyncResult = { caughtUp: boolean; added: number; capped: boolean; graduatedAt: Date | null };

type SigInfo = { signature: string; slot: number; err: unknown; blockTime: number | null };

const TX_OPTS = { encoding: "json", maxSupportedTransactionVersion: 1, commitment: "confirmed" } as const;

export async function getRawTx(signature: string): Promise<RawTx | null> {
  return rpcCall<RawTx | null>("getTransaction", [signature, TX_OPTS]);
}

/** Store this mint's trades from one parsed transaction. Returns how many were new. */
export async function insertTrades(coinId: string, mint: string, p: ParsedTx): Promise<number> {
  const rows = p.trades
    .filter((t) => t.mint === mint)
    .map((t) => ({
      coinId,
      signature: p.signature,
      idx: t.idx,
      slot: BigInt(p.slot),
      blockTime: new Date((p.blockTime ?? t.timestamp) * 1000),
      user: t.user,
      isBuy: t.isBuy,
      lamports: t.lamports,
      tokens: t.tokens,
      vSol: t.vSol,
      vTokens: t.vTokens,
      rSol: t.rSol,
      rTokens: t.rTokens,
    }));
  if (rows.length === 0) return 0;
  const res = await db().trade.createMany({ data: rows, skipDuplicates: true });
  return res.count;
}

async function markGraduated(coinId: string, at: Date) {
  await db().coin.updateMany({ where: { id: coinId, graduatedAt: null }, data: { graduatedAt: at } });
  await db().milestone.upsert({ where: { coinId_kind: { coinId, kind: "graduated" } }, create: { coinId, kind: "graduated", at }, update: {} });
}

function heliusGtfaAvailable() {
  return endpointsFor("helius").length > 0 && isMethodSupported("getTransactionsForAddress", "helius");
}

/**
 * Bring a coin's stored trades up to date, oldest first, from its cursor.
 * Stops at the budget, at `maxTx` transactions, or at the coin's trade cap.
 */
export async function syncTrades(coin: CoinRef, budget: Budget, opts: { cap: number; maxTx?: number }): Promise<SyncResult> {
  const cursor = await db().tradeCursor.upsert({ where: { coinId: coin.id }, create: { coinId: coin.id }, update: {} });
  if (cursor.capped) return { caughtUp: true, added: 0, capped: true, graduatedAt: null };

  if (heliusGtfaAvailable()) {
    try {
      return await syncViaGtfa(coin, cursor.lastSlot, cursor.tradeCount, budget, opts);
    } catch (err) {
      if (!(err instanceof RpcError) || !["rpc-unsupported", "rpc-forbidden"].includes(err.code)) throw err;
      // Plan doesn't include the method: fall through to standard RPC.
    }
  }
  return syncViaSignatures(coin, cursor.lastSignature, cursor.tradeCount, budget, { ...opts, cap: Math.min(opts.cap, 600) });
}

async function finish(coinId: string, data: { lastSlot?: bigint; lastSignature?: string; tradeCount: number; capped: boolean; caughtUp: boolean }) {
  await db().tradeCursor.update({
    where: { coinId },
    data: {
      ...(data.lastSlot !== undefined ? { lastSlot: data.lastSlot } : {}),
      ...(data.lastSignature !== undefined ? { lastSignature: data.lastSignature } : {}),
      tradeCount: data.tradeCount,
      capped: data.capped,
      ...(data.caughtUp ? { caughtUpAt: new Date() } : {}),
    },
  });
}

// ---- Helius getTransactionsForAddress: 100 full transactions per 10 credits ----

type GtfaPage = { data: (RawTx & { transactionIndex?: number })[]; paginationToken: string | null };

async function syncViaGtfa(coin: CoinRef, lastSlot: bigint | null, tradeCount: number, budget: Budget, opts: { cap: number; maxTx?: number }): Promise<SyncResult> {
  let token: string | undefined;
  let added = 0;
  let maxSlot = lastSlot ?? 0n;
  let graduatedAt: Date | null = null;
  let caughtUp = false;
  let seen = 0;
  while (budget.ok(10) && tradeCount < opts.cap && seen < (opts.maxTx ?? 1000)) {
    let page: GtfaPage;
    try {
      page = await rpcCall<GtfaPage>(
      "getTransactionsForAddress",
      [
        coin.bondingCurve,
        {
          transactionDetails: "full",
          sortOrder: "asc",
          limit: 100,
          ...TX_OPTS,
          filters: { status: "succeeded", ...(lastSlot !== null ? { slot: { gte: Number(lastSlot) } } : {}) },
          ...(token ? { paginationToken: token } : {}),
        },
      ],
      { hostIncludes: "helius", credits: (r) => Math.max(10, Math.ceil(((r as GtfaPage)?.data?.length ?? 0) / 100) * 10) },
      );
    } catch (err) {
      // Unsupported on this plan: let the caller fall back. Rate limits: keep progress.
      if (err instanceof RpcError && err.retryable && err.code !== "rpc-unsupported" && err.code !== "rpc-forbidden") break;
      throw err;
    }
    for (const entry of page.data) {
      seen++;
      const p = parsePumpTx(entry);
      const n = await insertTrades(coin.id, coin.mint, p);
      added += n;
      tradeCount += n;
      if (BigInt(p.slot) > maxSlot) maxSlot = BigInt(p.slot);
      if (p.completes.includes(coin.mint) && !graduatedAt) graduatedAt = new Date((p.blockTime ?? 0) * 1000);
    }
    if (!page.paginationToken || page.data.length < 100) {
      caughtUp = true;
      break;
    }
    token = page.paginationToken;
  }
  const capped = tradeCount >= opts.cap;
  if (graduatedAt) await markGraduated(coin.id, graduatedAt);
  await finish(coin.id, { lastSlot: maxSlot, tradeCount, capped, caughtUp: caughtUp || capped });
  return { caughtUp: caughtUp || capped, added, capped, graduatedAt };
}

// ---- Standard RPC: signatures, then one getTransaction per trade ----

async function syncViaSignatures(coin: CoinRef, lastSignature: string | null, tradeCount: number, budget: Budget, opts: { cap: number; maxTx?: number }): Promise<SyncResult> {
  const MAX_PAGES = 5;
  const sigs: SigInfo[] = [];
  let before: string | undefined;
  let complete = false;
  let pages = 0;
  while (pages < MAX_PAGES) {
    if (!budget.ok(1)) return { caughtUp: false, added: 0, capped: false, graduatedAt: null };
    let batch: SigInfo[];
    try {
      batch = await rpcCall<SigInfo[]>("getSignaturesForAddress", [
        coin.bondingCurve,
        { limit: 1000, commitment: "confirmed", ...(lastSignature ? { until: lastSignature } : {}), ...(before ? { before } : {}) },
      ]);
    } catch (err) {
      // Lagging node that doesn't know the cursor yet, or rate-limited: try again next time.
      if (/not found/i.test(String((err as Error)?.message)) || (err instanceof RpcError && err.retryable)) return { caughtUp: false, added: 0, capped: false, graduatedAt: null };
      throw err;
    }
    pages++;
    sigs.push(...batch);
    if (batch.length < 1000) {
      complete = true;
      break;
    }
    before = batch[batch.length - 1].signature;
  }
  // More history than we can page through: there would be a gap, so stop counting here.
  if (!complete) {
    await finish(coin.id, { tradeCount, capped: true, caughtUp: true });
    return { caughtUp: true, added: 0, capped: true, graduatedAt: null };
  }

  const ordered = sigs.reverse(); // oldest first
  let added = 0;
  let processed = 0;
  let advancedTo: string | undefined;
  let graduatedAt: Date | null = null;
  let stoppedEarly = false;
  // Fetch in small concurrent chunks (Helius free allows ~10 requests/s), process strictly in order.
  const CHUNK = 4;
  const maxTx = opts.maxTx ?? 150;
  let i = 0;
  outer: while (i < ordered.length) {
    const chunk: SigInfo[] = [];
    let j = i;
    while (j < ordered.length && chunk.filter((c) => !c.err).length < CHUNK) chunk.push(ordered[j++]);
    const live = chunk.filter((c) => !c.err);
    if (live.length && (!budget.ok(live.length) || processed + live.length > maxTx || tradeCount >= opts.cap)) {
      stoppedEarly = true;
      break;
    }
    const results = await Promise.allSettled(live.map((c) => getRawTx(c.signature)));
    for (const s of chunk) {
      if (!s.err) {
        const r = results[live.indexOf(s)];
        if (r.status === "rejected") {
          if (r.reason instanceof RpcError && r.reason.retryable) {
            stoppedEarly = true; // rate-limited: keep progress up to here, resume next time
            break outer;
          }
          throw r.reason;
        }
        processed++;
        if (r.value) {
          const p = parsePumpTx(r.value, s.signature);
          const n = await insertTrades(coin.id, coin.mint, p);
          added += n;
          tradeCount += n;
          if (p.completes.includes(coin.mint) && !graduatedAt) graduatedAt = new Date((p.blockTime ?? 0) * 1000);
        }
      }
      advancedTo = s.signature;
    }
    i = j;
  }
  const capped = tradeCount >= opts.cap;
  if (graduatedAt) await markGraduated(coin.id, graduatedAt);
  const caughtUp = (!stoppedEarly && complete) || capped;
  await finish(coin.id, { lastSignature: advancedTo ?? lastSignature ?? undefined, tradeCount, capped, caughtUp });
  return { caughtUp, added, capped, graduatedAt };
}
