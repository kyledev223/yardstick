import { describe, expect, it } from "vitest";
import { curveProgressPct, DEFAULT_INITIAL_REAL_TOKEN_RESERVES, marketCapSol, netInflowSol, priceSol, tokensForSol } from "@/lib/curve";

// Fresh pump.fun curve: 30 virtual SOL, 1.073B virtual tokens, 793.1M real tokens, 1B supply.
const fresh = {
  virtualSolReserves: 30_000_000_000n,
  virtualTokenReserves: 1_073_000_000_000_000n,
  realSolReserves: 0n,
  realTokenReserves: DEFAULT_INITIAL_REAL_TOKEN_RESERVES,
  tokenTotalSupply: 1_000_000_000_000_000n,
  complete: false,
};

describe("curve maths", () => {
  it("market cap = supply × vSol / vTokens", () => {
    expect(marketCapSol(fresh)).toBeCloseTo(27.958, 2); // ≈ 28 SOL at launch
  });

  it("price per token", () => {
    expect(priceSol(fresh)).toBeCloseTo(2.7958e-8, 11);
  });

  it("progress is 0 at launch, 100 when complete, linear in tokens sold", () => {
    expect(curveProgressPct(fresh.realTokenReserves)).toBe(0);
    expect(curveProgressPct(0n)).toBe(100);
    expect(curveProgressPct(DEFAULT_INITIAL_REAL_TOKEN_RESERVES / 2n)).toBeCloseTo(50, 1);
    expect(curveProgressPct(DEFAULT_INITIAL_REAL_TOKEN_RESERVES, undefined, true)).toBe(100);
  });

  it("net inflow comes from real SOL reserves", () => {
    expect(netInflowSol(4_000_000_000n)).toBe(4);
  });

  it("matches the recorded on-chain 4 SOL buy (constant product)", () => {
    // From fixture create-*: a 4 SOL buy moved virtual SOL from 30 to 34.
    const out = tokensForSol(fresh, 4_000_000_000n);
    const after = { ...fresh, virtualSolReserves: 34_000_000_000n, virtualTokenReserves: fresh.virtualTokenReserves - out };
    expect(Number(fresh.virtualSolReserves * fresh.virtualTokenReserves - after.virtualSolReserves * after.virtualTokenReserves)).toBeLessThanOrEqual(0);
    expect(out).toBeGreaterThan(126_000_000_000_000n);
    expect(out).toBeLessThan(126_300_000_000_000n);
  });

  it("never sells more than the real reserves", () => {
    expect(tokensForSol(fresh, 10_000_000_000_000n)).toBe(fresh.realTokenReserves);
  });
});
