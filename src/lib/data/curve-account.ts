import "server-only";
import { PublicKey, type AccountInfo } from "@solana/web3.js";
import { DEFAULT_INITIAL_REAL_TOKEN_RESERVES, type CurveState } from "../curve";
import { isSolQuote } from "../pump-events";
import { pumpSdk } from "../pump";
import { rpcCall } from "../rpc";

type RawAccount = { data: [string, string]; owner: string; lamports: number; executable: boolean; rentEpoch: number } | null;

export type CurveInfo = CurveState & { creator: string; isMayhem: boolean; solQuoted: boolean };

function decode(raw: RawAccount): CurveInfo | null {
  if (!raw) return null;
  const info: AccountInfo<Buffer> = {
    data: Buffer.from(raw.data[0], "base64"),
    owner: new PublicKey(raw.owner),
    lamports: raw.lamports,
    executable: raw.executable,
    rentEpoch: raw.rentEpoch,
  };
  const { PumpSdk } = pumpSdk();
  const c = new PumpSdk().decodeBondingCurveNullable(info);
  if (!c) return null;
  const quote = (c as { quoteMint?: PublicKey }).quoteMint?.toBase58() ?? "";
  return {
    virtualSolReserves: BigInt(c.virtualQuoteReserves.toString()),
    virtualTokenReserves: BigInt(c.virtualTokenReserves.toString()),
    realSolReserves: BigInt(c.realQuoteReserves.toString()),
    realTokenReserves: BigInt(c.realTokenReserves.toString()),
    tokenTotalSupply: BigInt(c.tokenTotalSupply.toString()),
    complete: c.complete,
    creator: c.creator.toBase58(),
    isMayhem: Boolean(c.isMayhemMode),
    solQuoted: isSolQuote(quote),
  };
}

export function bondingCurveAddress(mint: string): string {
  const { bondingCurvePda } = pumpSdk();
  return bondingCurvePda(new PublicKey(mint)).toBase58();
}

export async function fetchCurve(bondingCurve: string): Promise<CurveInfo | null> {
  const res = await rpcCall<{ value: RawAccount }>("getAccountInfo", [bondingCurve, { encoding: "base64", commitment: "confirmed" }]);
  return decode(res.value);
}

/** Global's initial real token reserves (for curve progress). Cached per process. */
let initialReal: { value: bigint; at: number } | null = null;
export async function initialRealTokenReserves(): Promise<bigint> {
  if (initialReal && Date.now() - initialReal.at < 3_600_000) return initialReal.value;
  try {
    const { GLOBAL_PDA, PumpSdk } = pumpSdk();
    const res = await rpcCall<{ value: RawAccount }>("getAccountInfo", [GLOBAL_PDA.toBase58(), { encoding: "base64" }]);
    if (res.value) {
      const g = new PumpSdk().decodeGlobal({
        data: Buffer.from(res.value.data[0], "base64"),
        owner: new PublicKey(res.value.owner),
        lamports: res.value.lamports,
        executable: false,
        rentEpoch: 0,
      });
      initialReal = { value: BigInt(g.initialRealTokenReserves.toString()), at: Date.now() };
      return initialReal.value;
    }
  } catch {
    // fall back to the documented default
  }
  return DEFAULT_INITIAL_REAL_TOKEN_RESERVES;
}
