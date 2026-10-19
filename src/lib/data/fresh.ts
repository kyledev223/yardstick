import "server-only";
import { createHash } from "node:crypto";
import { DATA } from "../config";
import { db } from "../db";
import { rpcCall } from "../rpc";
import type { Budget } from "./budget";

const PROBE = 25; // signatures fetched per wallet

type Buyer = { user: string; firstBuy: Date };

/** Deterministic sample so repeated snapshots check the same wallets (and hit the cache). */
export function sampleBuyers<T extends { user: string }>(buyers: T[], mint: string, n: number): T[] {
  const h = (u: string) => createHash("sha1").update(u + mint).digest("hex");
  return [...buyers].sort((a, b) => (h(a.user) < h(b.user) ? -1 : 1)).slice(0, n);
}

/**
 * A wallet counts as fresh if it has fewer than DATA.freshWalletMinTx transactions in total,
 * or its whole history (under 25 transactions) starts within DATA.freshWalletHours of its first
 * buy of this coin. Busier wallets are counted as not fresh.
 */
export function isFresh(w: { txCount: number; firstSeenAt: Date | null }, firstBuy: Date): boolean {
  if (w.txCount < DATA.freshWalletMinTx) return true;
  if (w.txCount >= PROBE || !w.firstSeenAt) return false;
  return w.firstSeenAt.getTime() >= firstBuy.getTime() - DATA.freshWalletHours * 3600_000;
}

export async function freshWalletShare(mint: string, buyers: Buyer[], budget: Budget, maxNewChecks = DATA.freshSampleSize): Promise<{ pct: number; sampled: number } | null> {
  if (buyers.length === 0) return null;
  const sample = sampleBuyers(buyers, mint, DATA.freshSampleSize);
  const cached = new Map((await db().walletAge.findMany({ where: { wallet: { in: sample.map((b) => b.user) } } })).map((w) => [w.wallet, w]));
  let checks = 0;
  let fresh = 0;
  let sampled = 0;
  for (const b of sample) {
    let w = cached.get(b.user);
    if (!w || Date.now() - w.checkedAt.getTime() > 7 * 86_400_000) {
      if (checks >= maxNewChecks || !budget.ok(1)) continue;
      checks++;
      const sigs = await rpcCall<{ blockTime: number | null }[]>("getSignaturesForAddress", [b.user, { limit: PROBE }]);
      const oldest = sigs.at(-1)?.blockTime;
      const data = { txCount: sigs.length, firstSeenAt: oldest ? new Date(oldest * 1000) : null, checkedAt: new Date() };
      const freshNow = isFresh(data, new Date());
      w = await db().walletAge.upsert({ where: { wallet: b.user }, create: { wallet: b.user, ...data, fresh: freshNow }, update: { ...data, fresh: freshNow } });
    }
    sampled++;
    if (isFresh(w, b.firstBuy)) fresh++;
  }
  if (sampled < Math.min(5, buyers.length)) return null;
  return { pct: (fresh / sampled) * 100, sampled };
}
