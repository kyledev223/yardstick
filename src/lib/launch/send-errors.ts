import type { ErrorCode } from "../errors";

export type SendFailure = { code: ErrorCode; message: string; logs: string[] };

/** Pull the useful text out of a web3.js SendTransactionError (or anything else thrown by send). */
export function describeSendError(err: unknown): SendFailure {
  const e = err as { message?: string; transactionMessage?: string; transactionLogs?: string[]; logs?: string[] };
  const logs = (e?.transactionLogs ?? e?.logs ?? []).slice(-12);
  const text = [e?.transactionMessage, e?.message, ...logs].filter(Boolean).join("\n");
  if (/blockhash not found|block height exceeded|BlockhashNotFound/i.test(text)) {
    return { code: "blockhash-expired", message: "The approval took too long and the transaction expired. Nothing was charged. Approve again.", logs };
  }
  if (/insufficient (lamports|funds)|InsufficientFunds|Attempt to debit an account but found no record of a prior credit/i.test(text)) {
    return { code: "insufficient-sol", message: "Not enough SOL in this wallet to cover the launch. Nothing was sent.", logs };
  }
  if (/signature verification failed|missing signature/i.test(text)) {
    return { code: "invalid-transaction", message: "A signature was missing or invalid, so the transaction wasn't sent.", logs };
  }
  const detail = (e?.transactionMessage || e?.message || "").replace(/https?:\/\/\S+/g, "").slice(0, 200);
  return { code: "simulation-failed", message: `The network rejected the transaction${detail ? `: ${detail}` : "."}`, logs };
}
