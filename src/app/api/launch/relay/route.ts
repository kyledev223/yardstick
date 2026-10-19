import bs58 from "bs58";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { fail, ok, toErrorResponse } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { flushRpcUsage } from "@/lib/data/budget";
import { getLaunchLookupTable } from "@/lib/launch/lookup-table";
import { checkLaunchTx, normaliseLegacy, normaliseV0, type NormalisedTx } from "@/lib/launch/relay-check";
import { describeSendError } from "@/lib/launch/send-errors";
import { RpcError, withRpc } from "@/lib/rpc";

export const maxDuration = 30;

/** Check the signed transaction strictly, then send it. Nothing else can be relayed through here. */
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const { launchId, transaction } = (await req.json()) as { launchId?: string; transaction?: string };
    const launch = launchId ? await db().launch.findUnique({ where: { id: launchId } }) : null;
    if (!launch || launch.userId !== session.userId) return fail("launch-not-found", 404);
    if (launch.wallet !== session.wallet) return fail("session-wallet-mismatch", 403);
    if (launch.status !== "built" || !launch.mint) return fail("launch-wrong-state", 409);

    // Legacy or v0 (v0 only with this site's own lookup table).
    const raw = Buffer.from(String(transaction), "base64");
    let normalised: NormalisedTx;
    let signatureBytes: Uint8Array;
    try {
      const vtx = VersionedTransaction.deserialize(raw);
      if (vtx.message.version === "legacy") {
        const tx = Transaction.from(raw);
        normalised = normaliseLegacy(tx);
        signatureBytes = tx.signature!;
      } else {
        const table = await getLaunchLookupTable();
        const n = normaliseV0(vtx, table ? [table] : []);
        if ("error" in n) return fail("invalid-transaction", 400, `The signed transaction ${n.error}, so it wasn't sent.`);
        normalised = n;
        signatureBytes = vtx.signatures[0];
      }
    } catch {
      return fail("invalid-transaction", 400);
    }
    const check = checkLaunchTx(normalised, {
      feePayer: session.wallet,
      mint: launch.mint,
      name: launch.name,
      symbol: launch.symbol,
      uri: launch.metadataUri,
      devBuyLamports: launch.devBuyLamports,
      blockhash: launch.blockhash ?? undefined,
    });
    if (!check.ok) return fail("invalid-transaction", 400, `The signed transaction didn't match what was built (${check.reason}), so it wasn't sent.`);

    // Record the signature before sending so a crash after send can still be finalized.
    const signature = bs58.encode(signatureBytes);
    await db().launch.update({ where: { id: launch.id }, data: { signature } });

    try {
      await withRpc((conn) => conn.sendRawTransaction(raw, { skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 3 }));
    } catch (err) {
      if (err instanceof RpcError) {
        // The send may or may not have reached the network. Treat it as relayed: finalize
        // will either find it confirmed or mark it expired once the blockhash runs out.
        await db().launch.update({ where: { id: launch.id }, data: { status: "relayed", relayedAt: new Date() } });
        return ok({ signature, uncertain: true });
      }
      const f = describeSendError(err);
      // An empty wallet often fails without a clear error: check the balance.
      if (f.code !== "insufficient-sol" && f.code !== "blockhash-expired") {
        const balance = await withRpc((c) => c.getBalance(new PublicKey(session.wallet), "confirmed")).catch(() => null);
        if (balance !== null && balance < 5_000_000 + Number(launch.devBuyLamports)) {
          await db().launch.update({ where: { id: launch.id }, data: { errorCode: "insufficient-sol", reason: "Not enough SOL", signature: null } });
          return fail("insufficient-sol", 402, `Not enough SOL: this wallet has ${(balance / 1e9).toFixed(4)} SOL. Nothing was sent.`);
        }
      }
      await db().launch.update({ where: { id: launch.id }, data: { errorCode: f.code, reason: f.message.slice(0, 300), signature: null } });
      return fail(f.code, 422, f.message, { logs: f.logs });
    }

    await db().launch.update({ where: { id: launch.id }, data: { status: "relayed", relayedAt: new Date() } });
    return ok({ signature });
  } catch (err) {
    return toErrorResponse(err);
  } finally {
    await flushRpcUsage().catch(() => {});
  }
}
