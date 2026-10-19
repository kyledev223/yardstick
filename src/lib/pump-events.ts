import bs58 from "bs58";
import { PUMP_PROGRAM_ID } from "./config";
import { pumpSdk } from "./pump";

// Anchor `emit_cpi!` events arrive as an inner instruction to the pump program whose
// data is [EVENT_IX_TAG (8)][event discriminator (8)][borsh body]. Pump also logs the
// same event as "Program data:"; we read only the CPI copy so nothing is counted twice.
const EVENT_IX_TAG = Buffer.from([228, 69, 165, 46, 81, 203, 154, 29]);
const DISC = {
  create: Buffer.from([27, 114, 169, 77, 222, 235, 99, 118]),
  trade: Buffer.from([189, 219, 127, 211, 78, 230, 97, 238]),
  complete: Buffer.from([95, 114, 97, 156, 212, 46, 152, 8]),
};

const ZERO_KEY = "11111111111111111111111111111111";
const NATIVE_MINT = "So11111111111111111111111111111111111111112";

export type CreateEvt = {
  name: string;
  symbol: string;
  uri: string;
  mint: string;
  bondingCurve: string;
  user: string;
  creator: string;
  timestamp: number;
  isMayhem: boolean;
  quoteMint: string; // "" when SOL-quoted
  tokenProgram: string;
  tokenTotalSupply: bigint;
};

export type TradeEvt = {
  idx: number;
  mint: string;
  user: string;
  isBuy: boolean;
  lamports: bigint;
  tokens: bigint;
  timestamp: number;
  vSol: bigint;
  vTokens: bigint;
  rSol: bigint;
  rTokens: bigint;
  ixName: string;
};

export type ParsedTx = {
  signature: string;
  slot: number;
  blockTime: number | null;
  failed: boolean;
  creates: CreateEvt[];
  trades: TradeEvt[];
  completes: string[]; // mints that graduated in this tx
};

/** The subset of a `getTransaction` (encoding "json") response we read. */
export type RawTx = {
  slot: number;
  blockTime?: number | null;
  transaction: { signatures: string[]; message: { accountKeys: string[] } };
  meta: {
    err: unknown;
    loadedAddresses?: { writable?: string[]; readonly?: string[] } | null;
    innerInstructions?: { index: number; instructions: { programIdIndex: number; data: string }[] }[] | null;
  } | null;
};

const big = (v: { toString(): string } | undefined | null) => BigInt(v ? v.toString() : "0");
const key = (v: { toBase58(): string } | undefined | null) => (v ? v.toBase58() : "");

export function isSolQuote(quoteMint: string): boolean {
  return quoteMint === "" || quoteMint === ZERO_KEY || quoteMint === NATIVE_MINT;
}

export function parsePumpTx(tx: RawTx, signature?: string): ParsedTx {
  const sig = signature ?? tx.transaction.signatures[0];
  const out: ParsedTx = { signature: sig, slot: tx.slot, blockTime: tx.blockTime ?? null, failed: Boolean(tx.meta?.err), creates: [], trades: [], completes: [] };
  if (!tx.meta || tx.meta.err) return out;
  const keys = [...tx.transaction.message.accountKeys, ...(tx.meta.loadedAddresses?.writable ?? []), ...(tx.meta.loadedAddresses?.readonly ?? [])];
  const sdk = new (pumpSdk().PumpSdk)();
  let idx = 0;
  for (const group of tx.meta.innerInstructions ?? []) {
    for (const ix of group.instructions) {
      if (keys[ix.programIdIndex] !== PUMP_PROGRAM_ID) continue;
      const data = Buffer.from(bs58.decode(ix.data));
      if (data.length < 16 || !data.subarray(0, 8).equals(EVENT_IX_TAG)) continue;
      const disc = data.subarray(8, 16);
      const body = data.subarray(16);
      try {
        if (disc.equals(DISC.trade)) {
          const e = sdk.decodeTradeEventBc(body);
          out.trades.push({
            idx: idx++,
            mint: key(e.mint),
            user: key(e.user),
            isBuy: Boolean(e.isBuy),
            lamports: big(e.solAmount),
            tokens: big(e.tokenAmount),
            timestamp: Number(e.timestamp?.toString() ?? 0),
            vSol: big(e.virtualSolReserves),
            vTokens: big(e.virtualTokenReserves),
            rSol: big(e.realSolReserves),
            rTokens: big(e.realTokenReserves),
            ixName: String((e as { ixName?: string }).ixName ?? ""),
          });
        } else if (disc.equals(DISC.create)) {
          const e = sdk.decodeCreateEventBc(body);
          const quote = key((e as { quoteMint?: { toBase58(): string } }).quoteMint);
          out.creates.push({
            name: e.name,
            symbol: e.symbol,
            uri: e.uri,
            mint: key(e.mint),
            bondingCurve: key(e.bondingCurve),
            user: key(e.user),
            creator: key(e.creator),
            timestamp: Number(e.timestamp?.toString() ?? 0),
            isMayhem: Boolean((e as { isMayhemMode?: boolean }).isMayhemMode),
            quoteMint: isSolQuote(quote) ? "" : quote,
            tokenProgram: key((e as { tokenProgram?: { toBase58(): string } }).tokenProgram),
            tokenTotalSupply: big(e.tokenTotalSupply),
          });
        } else if (disc.equals(DISC.complete)) {
          const e = sdk.decodeCompleteEventBc(body);
          out.completes.push(key(e.mint));
        }
      } catch {
        // Unknown layout (program upgrade): skip this event rather than fail the batch.
      }
    }
  }
  return out;
}
