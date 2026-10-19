// Bonding-curve maths. Pure functions over bigint so they are easy to test.

/** pump.fun default: 793.1M tokens (6 decimals) sold through the curve before graduation. */
export const DEFAULT_INITIAL_REAL_TOKEN_RESERVES = 793_100_000_000_000n;
export const DEFAULT_TOKEN_SUPPLY = 1_000_000_000_000_000n;

export type CurveState = {
  virtualSolReserves: bigint;
  virtualTokenReserves: bigint;
  realSolReserves: bigint;
  realTokenReserves: bigint;
  tokenTotalSupply: bigint;
  complete: boolean;
};

/** Market cap in SOL = supply × virtualSolReserves / virtualTokenReserves. */
export function marketCapSol(c: Pick<CurveState, "virtualSolReserves" | "virtualTokenReserves" | "tokenTotalSupply">): number {
  if (c.virtualTokenReserves <= 0n) return 0;
  // Keep precision: compute in lamports with bigint, convert at the end.
  const lamports = (c.tokenTotalSupply * c.virtualSolReserves) / c.virtualTokenReserves;
  return Number(lamports) / 1e9;
}

/** Price of one whole token in SOL. */
export function priceSol(c: Pick<CurveState, "virtualSolReserves" | "virtualTokenReserves">, decimals = 6): number {
  if (c.virtualTokenReserves <= 0n) return 0;
  return Number(c.virtualSolReserves) / 1e9 / (Number(c.virtualTokenReserves) / 10 ** decimals);
}

/** Share of the curve's sellable tokens already bought, 0–100. */
export function curveProgressPct(realTokenReserves: bigint, initialRealTokenReserves = DEFAULT_INITIAL_REAL_TOKEN_RESERVES, complete = false): number {
  if (complete) return 100;
  if (initialRealTokenReserves <= 0n) return 0;
  const left = realTokenReserves > initialRealTokenReserves ? initialRealTokenReserves : realTokenReserves;
  const soldBp = ((initialRealTokenReserves - left) * 10_000n) / initialRealTokenReserves;
  return Math.max(0, Math.min(100, Number(soldBp) / 100));
}

/** Net SOL that buyers have put into the curve (buys minus sells, after fees). */
export function netInflowSol(realSolReserves: bigint): number {
  return Number(realSolReserves) / 1e9;
}

/** Tokens out for a SOL amount (after fees) on a constant-product curve. */
export function tokensForSol(c: Pick<CurveState, "virtualSolReserves" | "virtualTokenReserves" | "realTokenReserves">, lamportsIn: bigint): bigint {
  if (lamportsIn <= 0n) return 0n;
  const k = c.virtualSolReserves * c.virtualTokenReserves;
  const newSol = c.virtualSolReserves + lamportsIn;
  const newTokens = k / newSol + 1n;
  const out = c.virtualTokenReserves - newTokens;
  return out > c.realTokenReserves ? c.realTokenReserves : out;
}

export const lamportsToSol = (l: bigint | number) => Number(l) / 1e9;
export const solToLamports = (sol: number) => BigInt(Math.round(sol * 1e9));
