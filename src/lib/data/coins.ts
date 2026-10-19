import "server-only";
import { PublicKey } from "@solana/web3.js";
import { TRACKING_DAYS } from "../config";
import { db } from "../db";
import { AppError } from "../errors";
import { nameKey } from "../launch/validate";
import { parsePumpTx, type CreateEvt, type ParsedTx, type RawTx } from "../pump-events";
import { endpointsFor, isMethodSupported, rpcCall } from "../rpc";
import type { Coin, CoinSource } from "@/generated/prisma/client";
import { bondingCurveAddress, fetchCurve } from "./curve-account";
import { getRawTx, insertTrades } from "./trades";

export function isMint(s: string): boolean {
  try {
    return new PublicKey(s).toBytes().length === 32;
  } catch {
    return false;
  }
}

/** Enrol (or upgrade) a coin from its parsed create transaction, storing the create's own trades. */
export async function enrollFromCreate(p: ParsedTx, c: CreateEvt, source: CoinSource, extra: { createdAt?: Date } = {}): Promise<Coin> {
  const createdAt = extra.createdAt ?? new Date((p.blockTime ?? c.timestamp) * 1000);
  const devBuy = p.trades.filter((t) => t.mint === c.mint && t.isBuy && t.user === c.creator).reduce((s, t) => s + t.lamports, 0n);
  const base = {
    bondingCurve: c.bondingCurve,
    creator: c.creator,
    name: c.name.slice(0, 64),
    symbol: c.symbol.slice(0, 16),
    nameKey: nameKey(c.name),
    uri: c.uri,
    createdAt,
    createSlot: BigInt(p.slot),
    tokenProgram: c.tokenProgram || null,
    devBuyLamports: devBuy,
    trackingUntil: new Date(createdAt.getTime() + TRACKING_DAYS * 86_400_000),
  };
  const coin = await db().coin.upsert({
    where: { mint: c.mint },
    create: { mint: c.mint, source, ...base, trackingStopped: source === "external" },
    // A pasted (external) coin that turns out to be ours becomes a Yardstick coin.
    update: source === "yardstick" ? { source, ...base, trackingStopped: false } : {},
  });
  await insertTrades(coin.id, c.mint, p);
  await db().tradeCursor.upsert({
    where: { coinId: coin.id },
    create: { coinId: coin.id, lastSlot: BigInt(p.slot), lastSignature: p.signature },
    update: {},
  });
  return coin;
}

/** Find a coin's create transaction: Helius history (oldest first) or paging signatures back. */
async function findCreateTx(curve: string): Promise<ParsedTx | null> {
  if (endpointsFor("helius").length > 0 && isMethodSupported("getTransactionsForAddress", "helius")) {
    try {
      const page = await rpcCall<{ data: RawTx[] }>(
        "getTransactionsForAddress",
        [curve, { transactionDetails: "full", sortOrder: "asc", limit: 1, encoding: "json", maxSupportedTransactionVersion: 1, filters: { status: "succeeded" } }],
        { hostIncludes: "helius" },
      );
      if (page.data[0]) return parsePumpTx(page.data[0]);
    } catch {
      // fall back below
    }
  }
  let before: string | undefined;
  let oldest: string | undefined;
  for (let i = 0; i < 5; i++) {
    const batch = await rpcCall<{ signature: string; err: unknown }[]>("getSignaturesForAddress", [curve, { limit: 1000, ...(before ? { before } : {}) }]);
    const ok = batch.filter((s) => !s.err);
    if (ok.length) oldest = ok[ok.length - 1].signature;
    if (batch.length < 1000) break;
    before = batch[batch.length - 1].signature;
    if (i === 4) return null; // too much history to page through on the free plan
  }
  if (!oldest) return null;
  const raw = await getRawTx(oldest);
  return raw ? parsePumpTx(raw, oldest) : null;
}

/** Look up a pasted mint; enrol it as an external coin if we haven't seen it. */
export async function getOrEnrollCoin(mint: string): Promise<Coin> {
  if (!isMint(mint)) throw new AppError("invalid-mint", undefined, 400);
  const existing = await db().coin.findUnique({ where: { mint } });
  if (existing) return existing;

  const curveAddr = bondingCurveAddress(mint);
  const curve = await fetchCurve(curveAddr);
  if (!curve) throw new AppError("not-a-pump-coin", undefined, 404);
  if (!curve.solQuoted) throw new AppError("unsupported-quote", undefined, 422);

  const p = await findCreateTx(curveAddr);
  const create = p?.creates.find((c) => c.mint === mint);
  if (p && create) return enrollFromCreate(p, create, "external");

  // Create not reachable (very old, very busy coin): enrol with what the curve tells us.
  const createdAt = new Date(Date.now() - TRACKING_DAYS * 86_400_000);
  return db().coin.upsert({
    where: { mint },
    create: {
      mint,
      source: "external",
      bondingCurve: curveAddr,
      creator: curve.creator,
      name: mint.slice(0, 4) + "…" + mint.slice(-4),
      symbol: "?",
      nameKey: "",
      createdAt,
      trackingUntil: createdAt,
      trackingStopped: true,
    },
    update: {},
  });
}

// ---- Off-chain metadata (IPFS JSON): name, image, socials. Not RPC, so no credits. ----

// ipfs.io and dweb.link now rate-limit server and hotlinked requests heavily (moving to a
// service-worker gateway), so IPFS content is read through these public gateways instead.
const GATEWAYS = ["https://4everland.io/ipfs/", "https://gateway.pinata.cloud/ipfs/"];

function gatewayUrls(uri: string): string[] {
  const m = uri.match(/\/ipfs\/([^/?#]+)/) ?? uri.match(/^ipfs:\/\/([^/?#]+)/);
  if (!m) return [uri];
  return GATEWAYS.map((g) => g + m[1]);
}

export async function fetchCoinMetadata(coin: Pick<Coin, "id" | "uri">): Promise<void> {
  if (!coin.uri) return;
  for (const url of gatewayUrls(coin.uri).slice(0, 2)) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) continue;
      const j = (await res.json()) as Record<string, unknown>;
      const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 300) : null);
      const description = s(j.description);
      await db().coin.update({
        where: { id: coin.id },
        data: {
          imageUrl: s(j.image),
          description,
          descLength: description?.length ?? 0,
          twitter: s(j.twitter),
          telegram: s(j.telegram),
          website: s(j.website),
          metaFetchedAt: new Date(),
        },
      });
      return;
    } catch {
      // try next gateway
    }
  }
  // Mark as attempted so we don't retry forever.
  await db().coin.update({ where: { id: coin.id }, data: { metaFetchedAt: new Date() } });
}

export function displayImage(url: string | null | undefined): string | null {
  if (!url) return null;
  return gatewayUrls(url)[0];
}
