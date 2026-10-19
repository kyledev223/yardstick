// Error codes the UI can show. Each has a plain-English message; docs/YARDSTICK.md lists causes.

export const ERRORS = {
  "not-signed-in": "Connect and sign in with your wallet first.",
  "session-wallet-mismatch": "The connected wallet isn't the one you signed in with. Switch back or sign in again.",
  "validation-failed": "Some fields need fixing.",
  "image-invalid": "That image couldn't be read. Try a PNG, JPEG or WebP under 4 MB.",
  "banned-word": "The name, symbol or description contains a word this site doesn't allow.",
  "rate-limited": "Too many launches from this wallet or network in the last hour. Try again later.",
  "metadata-upload-failed": "Couldn't upload the image and metadata to IPFS. Nothing was charged. Try again in a minute.",
  "launch-not-found": "That launch couldn't be found.",
  "launch-expired": "This launch wasn't signed within 30 minutes, so it expired. Nothing was sent. Start again.",
  "launch-wrong-state": "This launch has already moved on. Refresh the page.",
  "insufficient-sol": "Not enough SOL in this wallet to cover the launch. Nothing was sent.",
  "dev-buy-too-large": "Dev buy is above the cap.",
  "tx-too-large": "The launch transaction is too large for Solana. Nothing was sent.",
  "simulation-failed": "The transaction failed a dry run, so it wasn't sent. Nothing was charged.",
  "invalid-transaction": "The signed transaction didn't match what was built, so it wasn't sent.",
  "blockhash-expired": "The approval took too long and the transaction expired. Nothing was charged. Approve again.",
  "wallet-rejected": "You cancelled the request in your wallet.",
  "wallet-not-installed": "That wallet isn't installed in this browser.",
  "tx-failed": "The transaction was included but failed on-chain.",
  "rpc-rate-limited": "The Solana RPC is busy right now. Wait a moment and try again.",
  "rpc-forbidden": "The Solana RPC refused the request. The site's RPC settings need attention.",
  "rpc-timeout": "The Solana RPC didn't respond in time. Try again.",
  "rpc-network": "Couldn't reach the Solana RPC. Try again.",
  "rpc-unsupported": "The configured RPC doesn't support a method this needs.",
  "rpc-error": "The Solana RPC returned an error.",
  "pump-sdk-unavailable": "The pump.fun SDK failed to load on the server.",
  "invalid-mint": "That isn't a valid Solana mint address.",
  "not-a-pump-coin": "That mint isn't a pump.fun coin (no bonding curve found).",
  "unsupported-quote": "That coin is priced in a token other than SOL; Yardstick compares SOL-priced coins only.",
  "server-error": "Something went wrong on the server.",
} as const;

export type ErrorCode = keyof typeof ERRORS;

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message?: string,
    public status = 400,
    public details?: unknown,
  ) {
    super(message ?? ERRORS[code]);
    this.name = "AppError";
  }
}

export function errorBody(code: ErrorCode, message?: string, details?: unknown) {
  return { ok: false as const, error: { code, message: message ?? ERRORS[code], details } };
}
