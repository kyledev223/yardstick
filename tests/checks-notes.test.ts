import { describe, expect, it } from "vitest";
import { buildNotes, type NoteDist } from "@/lib/data/notes";
import { breakpoints } from "@/lib/data/percentile";
import { collisionCheck, findCollisions, levenshtein } from "@/lib/data/prechecks";
import { coverageByHour } from "@/lib/data/baseline";
import { isFresh, sampleBuyers } from "@/lib/data/fresh";
import { summariseHolders } from "@/lib/data/holders";
import { nearestBucket } from "@/lib/data/distributions";

const coins = [
  { name: "Doge Moon", symbol: "DMOON", nameKey: "dogemoon" },
  { name: "Cat Coin", symbol: "CAT", nameKey: "catcoin" },
  { name: "Another Cat", symbol: "CAT", nameKey: "anothercat" },
];

describe("pre-launch: name/symbol collisions", () => {
  it("finds same symbol and near-identical names", () => {
    expect(findCollisions({ name: "Something", symbol: "cat" }, coins).sameSymbol).toHaveLength(2);
    expect(findCollisions({ name: "Doge Mooon", symbol: "X" }, coins).similarName).toHaveLength(1);
    expect(findCollisions({ name: "Totally new", symbol: "NEW" }, coins)).toEqual({ sameSymbol: [], similarName: [] });
  });
  it("phrases results descriptively", () => {
    expect(collisionCheck({ name: "New", symbol: "NEW" }, coins).status).toBe("good");
    const c = collisionCheck({ name: "X", symbol: "CAT" }, coins);
    expect(c.status).toBe("look");
    expect(c.text).toMatch(/2 coins in the last 7 days used \$CAT/);
  });
  it("levenshtein", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
  });
});

describe("what to look at", () => {
  const spread = (lo: number, hi: number) => breakpoints(Array.from({ length: 101 }, (_, i) => lo + ((hi - lo) * i) / 100));
  const dist = (lo: number, hi: number, gradMedian: number | null): NoteDist => ({ breakpoints: spread(lo, hi), sampleSize: 200, gradMedian, gradSampleSize: 25 });

  it("picks the weakest metrics vs graduated coins, descriptively", () => {
    const dists = new Map<string, NoteDist>([
      ["holders", dist(0, 400, 300)],
      ["top10Pct", dist(10, 90, 22)],
      ["netInflowSol", dist(0, 40, 20)],
    ]);
    const notes = buildNotes({ values: { holders: 320, top10Pct: 46, netInflowSol: 21 }, dev: { sold: false, soldSol: 0, soldPct: 0, holdPct: 3 }, dists, ageLabel: "2h" });
    expect(notes[0].text).toBe("Top 10 wallets hold 46% of supply. Coins that graduated had a median of 22% at 2h.");
    expect(notes.some((n) => n.text === "No sells from the creator wallet so far.")).toBe(true);
    expect(notes.length).toBeLessThanOrEqual(4);
    for (const n of notes) expect(n.text).not.toMatch(/\b(buy now|sell now|will|should)\b/i);
  });

  it("falls back to the median coin when few graduated coins exist", () => {
    const dists = new Map<string, NoteDist>([["holders", { breakpoints: spread(0, 400), sampleSize: 200, gradMedian: null, gradSampleSize: 2 }]]);
    const notes = buildNotes({ values: { holders: 20 }, dev: { sold: null, soldSol: null, soldPct: null, holdPct: null }, dists, ageLabel: "1h" });
    expect(notes[0].text).toMatch(/The median coin had a median of 200 at 1h/);
  });

  it("tops up to two notes from real comparisons when few metrics trail", () => {
    const dists = new Map<string, NoteDist>([
      ["holders", dist(0, 400, 200)],
      ["top10Pct", dist(10, 90, 50)],
    ]);
    // Both metrics are ahead of the reference: no "look" notes, no creator data.
    const notes = buildNotes({ values: { holders: 380, top10Pct: 15 }, dev: { sold: null, soldSol: null, soldPct: null, holdPct: null }, dists, ageLabel: "2h" });
    expect(notes).toHaveLength(2);
    expect(notes.map((n) => n.metric).sort()).toEqual(["holders", "top10Pct"]);
    expect(notes.every((n) => n.tone === "good")).toBe(true);
    expect(notes.find((n) => n.metric === "holders")!.text).toBe("380 holders so far. Coins that graduated had a median of 200 at 2h.");
  });

  it("adds nothing when there is no comparison data", () => {
    const dists = new Map<string, NoteDist>([["holders", { breakpoints: spread(0, 400), sampleSize: 4, gradMedian: null, gradSampleSize: 0 }]]);
    const notes = buildNotes({ values: { holders: 10, top10Pct: 30 }, dev: { sold: null, soldSol: null, soldPct: null, holdPct: null }, dists, ageLabel: "12h" });
    expect(notes).toEqual([]);
  });

  it("stays silent about metrics without enough data", () => {
    const dists = new Map<string, NoteDist>([["holders", { breakpoints: spread(0, 400), sampleSize: 12, gradMedian: 300, gradSampleSize: 12 }]]);
    const notes = buildNotes({ values: { holders: 1 }, dev: { sold: true, soldSol: 1.2, soldPct: 4, holdPct: 0 }, dists, ageLabel: "1h" });
    expect(notes).toHaveLength(1);
    expect(notes[0].text).toMatch(/has sold 1\.20 SOL worth \(4\.0% of supply\)/);
  });
});

describe("helpers", () => {
  it("coverageByHour spreads a window across hours", () => {
    const t0 = 3600 * 10 + 1800; // 10:30
    const t1 = 3600 * 12 + 600; // 12:10
    const m = coverageByHour(t0, t1, [t0 + 10, 3600 * 11 + 5, 3600 * 11 + 6, t1]);
    expect(m.get(36000)).toEqual({ creates: 1, covered: 1800 });
    expect(m.get(39600)).toEqual({ creates: 2, covered: 3600 });
    expect(m.get(43200)).toEqual({ creates: 1, covered: 600 });
  });

  it("fresh-wallet rule", () => {
    const buy = new Date("2026-10-18T12:00:00Z");
    expect(isFresh({ txCount: 2, firstSeenAt: new Date("2025-01-01") }, buy)).toBe(true); // almost no history
    expect(isFresh({ txCount: 12, firstSeenAt: new Date("2026-10-18T02:00:00Z") }, buy)).toBe(true); // new today
    expect(isFresh({ txCount: 12, firstSeenAt: new Date("2026-09-01") }, buy)).toBe(false);
    expect(isFresh({ txCount: 25, firstSeenAt: new Date("2026-10-18T11:00:00Z") }, buy)).toBe(false); // busy wallet
  });

  it("buyer sampling is deterministic per coin", () => {
    const buyers = Array.from({ length: 50 }, (_, i) => ({ user: `w${i}` }));
    expect(sampleBuyers(buyers, "mintA", 5)).toEqual(sampleBuyers([...buyers].reverse(), "mintA", 5));
    expect(sampleBuyers(buyers, "mintA", 5)).not.toEqual(sampleBuyers(buyers, "mintB", 5));
  });

  it("holder summary excludes zero balances and computes top-10 share", () => {
    const balances = new Map<string, bigint>([
      ["a", 100_000_000_000_000n], // 10%
      ["b", 50_000_000_000_000n], // 5%
      ["c", 0n],
    ]);
    const s = summariseHolders(balances, 1_000_000_000_000_000n);
    expect(s.holders).toBe(2);
    expect(s.top10Pct).toBeCloseTo(15);
  });

  it("nearest age bucket on a log scale", () => {
    expect(nearestBucket(2 * 3600 + 14 * 60)).toBe("2h");
    expect(nearestBucket(40 * 60)).toBe("30m");
    expect(nearestBucket(30 * 86400)).toBe("7d");
  });
});
