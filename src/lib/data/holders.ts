import "server-only";
import bs58 from "bs58";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "../config";
import { endpointsFor, rpcCall } from "../rpc";
import type { Budget } from "./budget";

export type HolderData = {
  holders: number;
  top10Pct: number;
  /** owner → raw token amount, excluding the bonding curve. */
  balances: Map<string, bigint>;
};

type DasPage = { token_accounts?: { owner: string; amount: number | string }[]; cursor?: string };

/** Summarise holder balances: count of non-zero holders and the top-10 share of supply. */
export function summariseHolders(balances: Map<string, bigint>, supply: bigint): HolderData {
  const amounts = [...balances.values()].filter((a) => a > 0n).sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
  const top10 = amounts.slice(0, 10).reduce((s, a) => s + a, 0n);
  return {
    holders: amounts.length,
    top10Pct: supply > 0n ? Number((top10 * 1_000_000n) / supply) / 10_000 : 0,
    balances,
  };
}

function add(map: Map<string, bigint>, owner: string, amount: bigint, exclude: string) {
  if (owner === exclude || amount <= 0n) return;
  map.set(owner, (map.get(owner) ?? 0n) + amount);
}

async function viaDas(mint: string, curve: string, budget: Budget): Promise<Map<string, bigint> | null> {
  const balances = new Map<string, bigint>();
  let cursor: string | undefined;
  for (let i = 0; i < 20; i++) {
    if (!budget.ok(10)) return null;
    const page = await rpcCall<DasPage>(
      "getTokenAccounts",
      { mint, limit: 1000, ...(cursor ? { cursor } : {}), options: { showZeroBalance: false } },
      { hostIncludes: "helius" },
    );
    for (const a of page.token_accounts ?? []) add(balances, a.owner, BigInt(a.amount), curve);
    if (!page.cursor || (page.token_accounts?.length ?? 0) < 1000) return balances;
    cursor = page.cursor;
  }
  return balances;
}

async function viaProgramAccounts(mint: string, curve: string, tokenProgram: string, budget: Budget): Promise<Map<string, bigint> | null> {
  if (!budget.ok(10)) return null;
  const filters: object[] = [{ memcmp: { offset: 0, bytes: mint } }];
  if (tokenProgram === TOKEN_PROGRAM_ID) filters.push({ dataSize: 165 });
  const accounts = await rpcCall<{ account: { data: [string, string] } }[]>("getProgramAccounts", [
    tokenProgram,
    { encoding: "base64", commitment: "confirmed", filters, dataSlice: { offset: 32, length: 40 } },
  ]);
  if (accounts.length === 0) return null; // the curve's own account always exists
  const balances = new Map<string, bigint>();
  for (const a of accounts) {
    const buf = Buffer.from(a.account.data[0], "base64");
    if (buf.length < 40) continue;
    add(balances, bs58.encode(buf.subarray(0, 32)), buf.readBigUInt64LE(32), curve);
  }
  return balances;
}

/** Current holders of a mint (excluding the bonding curve). Null if the budget ran out. */
export async function fetchHolders(mint: string, bondingCurve: string, tokenProgram: string | null, supply: bigint, budget: Budget): Promise<HolderData | null> {
  let balances: Map<string, bigint> | null = null;
  if (endpointsFor("helius").length > 0) {
    try {
      balances = await viaDas(mint, bondingCurve, budget);
    } catch {
      balances = null;
    }
  }
  if (!balances) balances = await viaProgramAccounts(mint, bondingCurve, tokenProgram ?? TOKEN_2022_PROGRAM_ID, budget);
  return balances ? summariseHolders(balances, supply) : null;
}
