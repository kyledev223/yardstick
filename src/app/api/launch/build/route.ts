import { PublicKey } from "@solana/web3.js";
import { fail, ok, toErrorResponse } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { flushRpcUsage } from "@/lib/data/budget";
import { buildLaunchTx } from "@/lib/launch/build";

export const maxDuration = 30;

/** Build + simulate the create (and optional dev buy) transaction. The browser signs it. */
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const { launchId, mint } = (await req.json()) as { launchId?: string; mint?: string };
    const launch = launchId ? await db().launch.findUnique({ where: { id: launchId } }) : null;
    if (!launch || launch.userId !== session.userId) return fail("launch-not-found", 404);
    if (launch.wallet !== session.wallet) return fail("session-wallet-mismatch", 403);
    if (launch.status === "expired") return fail("launch-expired", 410);
    if (!["pending", "built"].includes(launch.status)) return fail("launch-wrong-state", 409);
    try {
      new PublicKey(String(mint));
    } catch {
      return fail("validation-failed", 400, "Invalid mint address");
    }
    // The mint is fixed to this launch; a different launch can't reuse it.
    const clash = await db().launch.findFirst({ where: { mint: String(mint), NOT: { id: launch.id } }, select: { id: true } });
    if (clash) return fail("validation-failed", 409, "That mint address is already used by another launch");

    const built = await buildLaunchTx({
      wallet: session.wallet,
      mint: String(mint),
      name: launch.name,
      symbol: launch.symbol,
      uri: launch.metadataUri,
      devBuyLamports: launch.devBuyLamports,
    });
    await db().launch.update({
      where: { id: launch.id },
      data: { status: "built", mint: String(mint), blockhash: built.blockhash, lastValidBlockHeight: BigInt(built.lastValidBlockHeight), errorCode: null, reason: null },
    });
    return ok({ transaction: built.transaction, balanceSol: built.balanceSol, estimatedCostSol: built.estimatedCostSol });
  } catch (err) {
    return toErrorResponse(err);
  } finally {
    await flushRpcUsage().catch(() => {});
  }
}
