import "server-only";
import { LAUNCH } from "../config";
import { db } from "../db";
import { parsePumpTx } from "../pump-events";
import { rpcCall, withRpc } from "../rpc";
import type { Launch } from "@/generated/prisma/client";
import { bondingCurveAddress, fetchCurve } from "../data/curve-account";
import { enrollFromCreate } from "../data/coins";
import { getRawTx } from "../data/trades";

type SigStatus = { slot: number; err: unknown; confirmationStatus?: "processed" | "confirmed" | "finalized" } | null;

async function setStatus(id: string, from: Launch["status"][], data: Partial<Pick<Launch, "status" | "errorCode" | "reason">>) {
  return db().launch.updateMany({ where: { id, status: { in: from } }, data });
}

/**
 * Advance one relayed launch. Idempotent and safe to call concurrently: the confirmed
 * transition is a conditional update, so only one caller creates the coin.
 */
export async function finalizeLaunch(launch: Launch): Promise<Launch> {
  if (launch.status === "confirmed" && !launch.coinId && launch.signature && launch.mint) return linkCoin(launch);
  if (launch.status !== "relayed" || !launch.signature || !launch.mint) return launch;

  const res = await rpcCall<{ value: SigStatus[] }>("getSignatureStatuses", [[launch.signature], { searchTransactionHistory: true }]);
  const st = res.value[0];

  if (!st) {
    // Not seen. If the blockhash has expired it never will be.
    if (launch.lastValidBlockHeight) {
      const height = await withRpc((c) => c.getBlockHeight("confirmed"));
      if (BigInt(height) > launch.lastValidBlockHeight) {
        await setStatus(launch.id, ["relayed"], { status: "expired", errorCode: "blockhash-expired", reason: "The transaction expired before it landed. Nothing was charged." });
      }
    }
    return (await db().launch.findUnique({ where: { id: launch.id } }))!;
  }

  if (st.err) {
    await setStatus(launch.id, ["relayed"], { status: "failed", errorCode: "tx-failed", reason: `The transaction failed on-chain: ${JSON.stringify(st.err).slice(0, 200)}` });
    return (await db().launch.findUnique({ where: { id: launch.id } }))!;
  }
  if (st.confirmationStatus === "processed") return launch;

  // Confirmed: the curve must exist and belong to the launching wallet.
  const curveAddr = bondingCurveAddress(launch.mint);
  const curve = await fetchCurve(curveAddr);
  if (!curve) return launch; // RPC lagging; try again on the next poll
  if (curve.creator !== launch.wallet) {
    await setStatus(launch.id, ["relayed"], { status: "failed", errorCode: "tx-failed", reason: "The coin exists but its creator isn't this wallet." });
    return (await db().launch.findUnique({ where: { id: launch.id } }))!;
  }

  const raw = await getRawTx(launch.signature);
  if (!raw || !parsePumpTx(raw, launch.signature).creates.some((c) => c.mint === launch.mint)) return launch;

  // Claim the launch first so two pollers can't both create the coin.
  const claimed = await setStatus(launch.id, ["relayed"], { status: "confirmed" });
  if (claimed.count !== 1) return (await db().launch.findUnique({ where: { id: launch.id } }))!;
  return linkCoin({ ...launch, status: "confirmed" });
}

/** Create the coin row for a confirmed launch. Upserts, so a retry after a crash is safe. */
async function linkCoin(launch: Launch): Promise<Launch> {
  const raw = await getRawTx(launch.signature!);
  const parsed = raw ? parsePumpTx(raw, launch.signature!) : null;
  const create = parsed?.creates.find((c) => c.mint === launch.mint);
  if (!parsed || !create) return launch;
  const coin = await enrollFromCreate(parsed, create, "yardstick");
  return db().launch.update({ where: { id: launch.id }, data: { coinId: coin.id, confirmedAt: launch.confirmedAt ?? new Date() } });
}

export async function finalizePending(limit = 10): Promise<number> {
  const relayed = await db().launch.findMany({
    where: { OR: [{ status: "relayed" }, { status: "confirmed", coinId: null }] },
    orderBy: { relayedAt: "asc" },
    take: limit,
  });
  for (const l of relayed) {
    try {
      await finalizeLaunch(l);
    } catch {
      // RPC hiccup: the next tick or poll retries
    }
  }
  // Launches never signed: expire them so they don't linger.
  const stale = new Date(Date.now() - LAUNCH.pendingExpiryMinutes * 60_000);
  await db().launch.updateMany({
    where: { status: { in: ["pending", "built"] }, updatedAt: { lt: stale } },
    data: { status: "expired", errorCode: "launch-expired", reason: "Not signed within 30 minutes. Nothing was sent." },
  });
  return relayed.length;
}
