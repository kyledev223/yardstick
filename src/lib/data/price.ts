import "server-only";
import { db } from "../db";
import { env } from "../env";

async function coingecko(): Promise<number> {
  const headers: Record<string, string> = {};
  if (env.coingeckoKey) headers["x-cg-demo-api-key"] = env.coingeckoKey;
  const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd", { headers, signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`coingecko ${r.status}`);
  const j = (await r.json()) as { solana?: { usd?: number } };
  if (!j.solana?.usd) throw new Error("coingecko: no price");
  return j.solana.usd;
}

async function coinbase(): Promise<number> {
  const r = await fetch("https://api.coinbase.com/v2/prices/SOL-USD/spot", { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`coinbase ${r.status}`);
  const j = (await r.json()) as { data?: { amount?: string } };
  const v = Number(j.data?.amount);
  if (!v) throw new Error("coinbase: no price");
  return v;
}

async function kraken(): Promise<number> {
  const r = await fetch("https://api.kraken.com/0/public/Ticker?pair=SOLUSD", { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`kraken ${r.status}`);
  const j = (await r.json()) as { result?: Record<string, { c?: string[] }> };
  const v = Number(Object.values(j.result ?? {})[0]?.c?.[0]);
  if (!v) throw new Error("kraken: no price");
  return v;
}

/** Fetch SOL/USD: CoinGecko, then Coinbase, then Kraken. Stores the result. */
export async function refreshSolPrice(): Promise<{ usd: number; source: string } | null> {
  for (const [source, fn] of [
    ["coingecko", coingecko],
    ["coinbase", coinbase],
    ["kraken", kraken],
  ] as const) {
    try {
      const usd = await fn();
      await db().solPrice.create({ data: { usd, source } });
      return { usd, source };
    } catch {
      // next source
    }
  }
  return null;
}

/** Latest stored SOL/USD (USD is computed at read time from this). */
export async function solUsd(): Promise<{ usd: number; fetchedAt: Date } | null> {
  const row = await db().solPrice.findFirst({ orderBy: { fetchedAt: "desc" } });
  return row ? { usd: row.usd, fetchedAt: row.fetchedAt } : null;
}
