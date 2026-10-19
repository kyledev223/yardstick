import { describe, expect, it } from "vitest";
import { breakpoints, compositeScore, median, percentileOf, quantile, topShare } from "@/lib/data/percentile";

describe("quantile / breakpoints", () => {
  it("interpolates linearly", () => {
    expect(quantile([0, 10], 0.5)).toBe(5);
    expect(quantile([1, 2, 3, 4, 5], 0.25)).toBe(2);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([])).toBeNull();
  });

  it("returns 19 ascending breakpoints for p5…p95", () => {
    const values = Array.from({ length: 101 }, (_, i) => i); // 0…100
    const bps = breakpoints(values);
    expect(bps).toHaveLength(19);
    expect(bps[0]).toBeCloseTo(5);
    expect(bps[9]).toBeCloseTo(50);
    expect(bps[18]).toBeCloseTo(95);
    for (let i = 1; i < bps.length; i++) expect(bps[i]).toBeGreaterThanOrEqual(bps[i - 1]);
  });

  it("ignores non-finite values", () => {
    expect(breakpoints([1, NaN, 3, Infinity])[9]).toBe(2);
  });
});

describe("percentileOf", () => {
  const bps = breakpoints(Array.from({ length: 101 }, (_, i) => i));

  it("maps values onto the 0–100 scale", () => {
    expect(percentileOf(50, bps)).toBeCloseTo(50, 0);
    expect(percentileOf(72.5, bps)).toBeCloseTo(72.5, 0);
    expect(percentileOf(-10, bps)).toBe(2.5);
    expect(percentileOf(1000, bps)).toBe(97.5);
  });

  it("puts ties in the middle of the tied range", () => {
    // 60% of coins at 0, the rest spread 1…40.
    const values = [...Array(60).fill(0), ...Array.from({ length: 40 }, (_, i) => i + 1)];
    const b = breakpoints(values);
    const p = percentileOf(0, b);
    expect(p).toBeGreaterThan(20);
    expect(p).toBeLessThan(40);
  });

  it("is monotonic", () => {
    let prev = -1;
    for (let v = -5; v <= 105; v += 0.5) {
      const p = percentileOf(v, bps);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });

  it("topShare turns percentile into 'top X%'", () => {
    expect(topShare(82)).toBe(18);
    expect(topShare(99.9)).toBe(1);
  });
});

describe("compositeScore", () => {
  it("weights metrics and inverts concentration-type metrics", () => {
    const all = { holders: 80, uniqueBuyers: 80, netInflowSol: 80, curveProgress: 80, top10Pct: 20, sniperPct: 20, freshWalletPct: 20 };
    expect(compositeScore(all)).toBeCloseTo(80);
  });

  it("matches the documented weights", () => {
    const s = compositeScore({ holders: 100, uniqueBuyers: 0, netInflowSol: 0, curveProgress: 0, top10Pct: 100, sniperPct: 100, freshWalletPct: 100 });
    expect(s).toBeCloseTo(25);
  });

  it("rescales when some metrics are missing", () => {
    const s = compositeScore({ holders: 60, uniqueBuyers: 60, netInflowSol: 60, curveProgress: 60, top10Pct: null });
    expect(s).toBeCloseTo(60);
  });

  it("refuses when too little weight is available", () => {
    expect(compositeScore({ holders: 90, uniqueBuyers: 90 })).toBeNull();
  });

  it("never uses volume", () => {
    expect(compositeScore({ holders: 50, uniqueBuyers: 50, netInflowSol: 50, curveProgress: 50, mcapSol: 100 } as never)).toBeCloseTo(50);
  });
});
