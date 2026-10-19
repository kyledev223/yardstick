import { ed25519 } from "@noble/curves/ed25519.js";
import { PublicKey, Transaction, TransactionMessage, type AddressLookupTableAccount, type TransactionInstruction, type VersionedTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  COMPUTE_BUDGET_PROGRAM_ID,
  LAUNCH,
  PUMP_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "../config";

// Anchor discriminators from the pump IDL (@pump-fun/pump-sdk 4.1.0).
export const CREATE_V2_DISC = Buffer.from([214, 144, 76, 236, 95, 139, 49, 180]);
export const BUY_DISC = Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]);

export type RelayExpectation = {
  feePayer: string;
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  devBuyLamports: bigint;
  blockhash?: string;
};

export type RelayCheck = { ok: true } | { ok: false; reason: string };

/** A signed transaction reduced to what the checker needs; legacy and v0 look the same. */
export type NormalisedTx = {
  feePayer: string | null;
  blockhash: string;
  instructions: TransactionInstruction[];
  /** Accounts that must sign, in order. */
  signers: string[];
  allSigned: boolean;
  signaturesValid: boolean;
  lookupTables: string[];
};

export function normaliseLegacy(tx: Transaction): NormalisedTx {
  const message = tx.compileMessage();
  const signers = message.accountKeys.slice(0, message.header.numRequiredSignatures).map((p) => p.toBase58());
  const allSigned = tx.signatures.length === signers.length && tx.signatures.every((s) => s.signature);
  return {
    feePayer: tx.feePayer?.toBase58() ?? null,
    blockhash: tx.recentBlockhash ?? "",
    instructions: tx.instructions,
    signers,
    allSigned,
    signaturesValid: allSigned && tx.verifySignatures(true),
    lookupTables: [],
  };
}

/** v0: resolve lookup-table accounts (only the tables passed in) and verify every signature. */
export function normaliseV0(tx: VersionedTransaction, tables: AddressLookupTableAccount[]): NormalisedTx | { error: string } {
  const msg = tx.message;
  const used = msg.addressTableLookups.map((l) => l.accountKey.toBase58());
  const known = new Map(tables.map((t) => [t.key.toBase58(), t]));
  if (used.some((u) => !known.has(u))) return { error: "uses an unexpected lookup table" };
  let decompiled: TransactionMessage;
  try {
    decompiled = TransactionMessage.decompile(msg, { addressLookupTableAccounts: used.map((u) => known.get(u)!) });
  } catch {
    return { error: "couldn't resolve the transaction's accounts" };
  }
  const signers = msg.staticAccountKeys.slice(0, msg.header.numRequiredSignatures).map((p) => p.toBase58());
  const bytes = msg.serialize();
  const allSigned = tx.signatures.length === signers.length && tx.signatures.every((s) => s.some((b) => b !== 0));
  const signaturesValid =
    allSigned &&
    signers.every((k, i) => {
      try {
        return ed25519.verify(tx.signatures[i], bytes, new PublicKey(k).toBytes());
      } catch {
        return false;
      }
    });
  return { feePayer: signers[0] ?? null, blockhash: msg.recentBlockhash, instructions: decompiled.instructions, signers, allSigned, signaturesValid, lookupTables: used };
}

type CreateArgs = {
  name: string;
  symbol: string;
  uri: string;
  creator: string;
  mayhem: boolean;
  cashback: boolean;
  creatorFeeBps: bigint;
  holderReward: boolean;
};

class Reader {
  o = 0;
  constructor(private b: Buffer) {}
  u8() {
    if (this.o + 1 > this.b.length) throw new Error("short");
    return this.b[this.o++];
  }
  bool() {
    const v = this.u8();
    if (v > 1) throw new Error("bad bool");
    return v === 1;
  }
  u32() {
    if (this.o + 4 > this.b.length) throw new Error("short");
    const v = this.b.readUInt32LE(this.o);
    this.o += 4;
    return v;
  }
  u64() {
    if (this.o + 8 > this.b.length) throw new Error("short");
    const v = this.b.readBigUInt64LE(this.o);
    this.o += 8;
    return v;
  }
  str() {
    const n = this.u32();
    if (n > 512 || this.o + n > this.b.length) throw new Error("bad string");
    const s = this.b.subarray(this.o, this.o + n).toString("utf8");
    this.o += n;
    return s;
  }
  key() {
    if (this.o + 32 > this.b.length) throw new Error("short");
    const k = new PublicKey(this.b.subarray(this.o, this.o + 32)).toBase58();
    this.o += 32;
    return k;
  }
  done() {
    return this.o === this.b.length;
  }
}

export function decodeCreateV2(data: Buffer): CreateArgs | null {
  if (data.length < 8 || !data.subarray(0, 8).equals(CREATE_V2_DISC)) return null;
  try {
    const r = new Reader(data.subarray(8));
    const out = {
      name: r.str(),
      symbol: r.str(),
      uri: r.str(),
      creator: r.key(),
      mayhem: r.bool(),
      cashback: r.bool(),
      creatorFeeBps: r.u64(),
      holderReward: r.bool(),
    };
    return r.done() ? out : null;
  } catch {
    return null;
  }
}

export function decodeBuy(data: Buffer): { amount: bigint; maxSolCost: bigint } | null {
  if (data.length < 8 || !data.subarray(0, 8).equals(BUY_DISC)) return null;
  try {
    const r = new Reader(data.subarray(8));
    const amount = r.u64();
    const maxSolCost = r.u64();
    r.bool(); // track_volume
    r.bool(); // partial_fill
    return r.done() ? { amount, maxSolCost } : null;
  } catch {
    return null;
  }
}

const k = (ix: TransactionInstruction, i: number) => ix.keys[i]?.pubkey.toBase58();

/**
 * Check a signed launch transaction before relaying it. Only ComputeBudget, exactly one
 * pump create_v2 for this launch and, with a dev buy, exactly one token-account create and
 * one pump buy for this mint from the fee payer are allowed. Every signature must be valid.
 */
export function checkLaunchTx(input: Transaction | NormalisedTx, want: RelayExpectation): RelayCheck {
  const fail = (reason: string): RelayCheck => ({ ok: false, reason });
  const tx = input instanceof Transaction ? normaliseLegacy(input) : input;

  if (tx.feePayer !== want.feePayer) return fail("fee payer is not the signed-in wallet");
  if (want.blockhash && tx.blockhash !== want.blockhash) return fail("blockhash differs from the built transaction");

  let creates = 0;
  let buys = 0;
  let atas = 0;
  let cuLimit = 0;
  let cuPrice = 0;

  for (const ix of tx.instructions) {
    const program = ix.programId.toBase58();
    if (program === COMPUTE_BUDGET_PROGRAM_ID) {
      const tag = ix.data[0];
      if (tag === 2 && ix.data.length === 5) {
        cuLimit++;
        if (ix.data.readUInt32LE(1) > 1_400_000) return fail("compute limit too high");
      } else if (tag === 3 && ix.data.length === 9) {
        cuPrice++;
        if (ix.data.readBigUInt64LE(1) > BigInt(LAUNCH.priorityMicroLamportsMax)) return fail("priority fee too high");
      } else return fail("unexpected compute-budget instruction");
      continue;
    }

    if (program === PUMP_PROGRAM_ID) {
      const create = decodeCreateV2(ix.data);
      if (create) {
        creates++;
        if (k(ix, 0) !== want.mint) return fail("create is for a different mint");
        if (k(ix, 5) !== want.feePayer) return fail("create user is not the fee payer");
        if (create.name !== want.name || create.symbol !== want.symbol || create.uri !== want.uri) return fail("name, symbol or metadata URI differs");
        if (create.creator !== want.feePayer) return fail("creator is not the fee payer");
        if (create.mayhem || create.cashback || create.holderReward || create.creatorFeeBps !== 0n) return fail("unsupported create options");
        continue;
      }
      const buy = decodeBuy(ix.data);
      if (buy) {
        buys++;
        if (want.devBuyLamports <= 0n) return fail("buy present but no dev buy was requested");
        if (k(ix, 2) !== want.mint) return fail("buy is for a different mint");
        if (k(ix, 6) !== want.feePayer) return fail("buy is not from the fee payer");
        const max = want.devBuyLamports + (want.devBuyLamports * BigInt(LAUNCH.devBuySlippageBps)) / 10_000n;
        if (buy.maxSolCost < want.devBuyLamports || buy.maxSolCost > max) return fail("buy amount differs from the dev buy");
        if (buy.amount <= 0n) return fail("buy amount is zero");
        continue;
      }
      return fail("unexpected pump instruction");
    }

    if (program === ASSOCIATED_TOKEN_PROGRAM_ID) {
      atas++;
      if (want.devBuyLamports <= 0n) return fail("token account create present without a dev buy");
      if (ix.data.length !== 1 || ix.data[0] !== 1) return fail("token account create must be idempotent");
      const payer = new PublicKey(want.feePayer);
      const ata = getAssociatedTokenAddressSync(new PublicKey(want.mint), payer, true, new PublicKey(TOKEN_2022_PROGRAM_ID)).toBase58();
      if (k(ix, 0) !== want.feePayer || k(ix, 1) !== ata || k(ix, 2) !== want.feePayer || k(ix, 3) !== want.mint || k(ix, 5) !== TOKEN_2022_PROGRAM_ID)
        return fail("token account create has unexpected accounts");
      continue;
    }

    return fail(`unexpected program ${program}`);
  }

  if (creates !== 1) return fail("expected exactly one create instruction");
  if (cuLimit > 1 || cuPrice > 1) return fail("duplicate compute-budget instruction");
  if (want.devBuyLamports > 0n && (buys !== 1 || atas !== 1)) return fail("expected exactly one dev buy");
  if (want.devBuyLamports === 0n && (buys !== 0 || atas !== 0)) return fail("unexpected buy");

  // Signers: exactly the fee payer and the mint, both present and valid.
  if (tx.signers.length !== 2) return fail("unexpected signers");
  if (!tx.signers.includes(want.feePayer) || !tx.signers.includes(want.mint)) return fail("signers must be the wallet and the mint");
  if (!tx.allSigned) return fail("missing signature");
  if (!tx.signaturesValid) return fail("invalid signature");

  return { ok: true };
}
