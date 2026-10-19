import "server-only";
import BN from "bn.js";
import { AddressLookupTableAccount, ComputeBudgetProgram, Keypair, PublicKey } from "@solana/web3.js";
import { pumpSdk } from "../pump";
import { rpcCall, withRpc } from "../rpc";

/**
 * A v0 transaction with an address lookup table (ALT) is needed for create + dev buy:
 * as a legacy transaction it is ~1,280 bytes with a full-length name, over Solana's 1,232 limit.
 * The site owner creates one frozen ALT once (/setup) and sets PUMP_LOOKUP_TABLE.
 */

export function configuredLookupTable(): string | null {
  const v = process.env.PUMP_LOOKUP_TABLE?.trim();
  if (!v) return null;
  try {
    return new PublicKey(v).toBase58();
  } catch {
    return null;
  }
}

/**
 * Accounts that are the same for every launch: programs, pump's global PDAs and the
 * fee recipients (the SDK picks one at random per transaction, so all are included).
 * Found by building create + buy many times for two different wallets/mints and keeping
 * the accounts common to both sets.
 */
export async function launchTableAddresses(): Promise<string[]> {
  const { PumpSdk, OnlinePumpSdk } = pumpSdk();
  const global = await withRpc((c) => new OnlinePumpSdk(c).fetchGlobal(), { credits: 1 });
  const sdk = new PumpSdk();
  const collect = async () => {
    const user = Keypair.generate().publicKey;
    const mint = Keypair.generate().publicKey;
    const keys = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const ixs = await sdk.createV2AndBuyInstructions({ global, mint, name: "x", symbol: "X", uri: "u", creator: user, user, amount: new BN(1000), solAmount: new BN(1_000_000), mayhemMode: false });
      for (const ix of ixs) {
        keys.add(ix.programId.toBase58());
        for (const k of ix.keys) keys.add(k.pubkey.toBase58());
      }
    }
    return keys;
  };
  const [a, b] = [await collect(), await collect()];
  const out = new Set([...a].filter((k) => b.has(k)));
  out.add(ComputeBudgetProgram.programId.toBase58());
  out.add(global.feeRecipient.toBase58());
  for (const r of global.feeRecipients) out.add(r.toBase58());
  // (Invoked program ids can't be loaded from a table; compileToV0Message keeps those static.)
  return [...out].sort();
}

type RawAlt = { data: [string, string] } | null;
let cache: { key: string; at: number; table: AddressLookupTableAccount | null } | null = null;

/** The configured lookup table, if it exists and is active. Cached for 10 minutes. */
export async function getLaunchLookupTable(): Promise<AddressLookupTableAccount | null> {
  const key = configuredLookupTable();
  if (!key) return null;
  if (cache && cache.key === key && Date.now() - cache.at < 600_000) return cache.table;
  const res = await rpcCall<{ value: RawAlt }>("getAccountInfo", [key, { encoding: "base64", commitment: "confirmed" }]);
  let table: AddressLookupTableAccount | null = null;
  if (res.value) {
    const state = AddressLookupTableAccount.deserialize(Buffer.from(res.value.data[0], "base64"));
    table = new AddressLookupTableAccount({ key: new PublicKey(key), state });
    if (!table.isActive()) table = null;
  }
  cache = { key, at: Date.now(), table };
  return table;
}

export async function lookupTableStatus() {
  const key = configuredLookupTable();
  if (!key) return { configured: false as const };
  const table = await getLaunchLookupTable().catch(() => null);
  if (!table) return { configured: true as const, key, ok: false, problem: "not found or deactivated" };
  const wanted = await launchTableAddresses().catch(() => [] as string[]);
  const have = new Set(table.state.addresses.map((a) => a.toBase58()));
  const missing = wanted.filter((w) => !have.has(w));
  return { configured: true as const, key, ok: true, frozen: !table.state.authority, entries: have.size, missing: missing.length };
}
