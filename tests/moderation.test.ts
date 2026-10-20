import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MODERATION } from "@/lib/config";
import { containsBannedWord } from "@/lib/launch/validate";
import { findBannedTerm, isHiddenMint, showInLiveStrip } from "@/lib/moderation";

// The starter list holds real slurs and sexual terms, so these tests have to name some of them.
describe("banned words", () => {
  it.each([
    ["exact, any case", "SEX coin"],
    ["accents and full-width letters", "Ｓéx"],
    ["look-alike digits and symbols", "$3x"],
    ["spaced-out letters", "s e x"],
    ["dotted letters", "n.i.g.g.e.r"],
    ["stretched letters", "niiiiigger"],
    ["Cyrillic look-alikes", "nаzi"], // Cyrillic а
    ["zero-width characters", "na\u200bzi"],
    ["plurals", "nazis"],
    ["phrases", "Sieg   Heil"],
    ["numbers read as written", "1488"],
    ["1 read as i or l", "n1gga"],
    ["a slur inside a longer symbol", "NIGGERCOIN"],
    ["a slur in the description", "a fun coin about h1tler"],
  ])("blocks %s (%s)", (_why, text) => {
    expect(findBannedTerm(text)).not.toBeNull();
  });

  it.each(["Sussex", "Essex", "Niger", "Nigeria", "Grape", "Drapes", "Torpedo", "Analysis", "Cocktail", "Dickens", "Cumulus", "Spicy", "Pakistan", "Scrape", "Therapist", "Titan", "Coonhound fan club", "Moon dog 4 life", "$PEPE"])(
    "allows ordinary words (%s)",
    (text) => {
      expect(findBannedTerm(text)).toBeNull();
    },
  );

  it("checks every text it's given, and ignores empty ones", () => {
    expect(findBannedTerm("Moon", undefined, "", "RAPE")).toBe("rape");
    expect(findBannedTerm(undefined, "", null)).toBeNull();
  });

  it("launch validation uses the same lists", () => {
    expect(containsBannedWord("Good coin", "GOOD", "porn")).toBe("porn");
    expect(containsBannedWord("Good coin", "GOOD", "A dog with a hat")).toBeNull();
  });

  it("every list entry blocks itself", () => {
    for (const w of [...MODERATION.bannedWords, ...MODERATION.bannedAnywhere]) expect(findBannedTerm(w), w).not.toBeNull();
  });
});

describe("hide list", () => {
  it("hides only listed mints", () => {
    const listed = MODERATION.hiddenMints;
    listed.push("So11111111111111111111111111111111111111112");
    try {
      expect(isHiddenMint("So11111111111111111111111111111111111111112")).toBe(true);
      expect(isHiddenMint("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")).toBe(false);
    } finally {
      listed.pop();
    }
  });
});

describe("Live on pump.fun strip", () => {
  const ok = { mint: "GoodMint111111111111111111111111111111111111", name: "Moon Dog", symbol: "MDOG", latest: { devSold: false, sniperPct: 4 } };

  it("shows a coin whose latest reading has no warning sign", () => {
    expect(showInLiveStrip(ok)).toBe(true);
  });

  it.each([
    ["no reading yet", { ...ok, latest: null }],
    ["creator sold", { ...ok, latest: { devSold: true, sniperPct: 4 } }],
    ["creator sells not known yet", { ...ok, latest: { devSold: null, sniperPct: 4 } }],
    ["high sniper share", { ...ok, latest: { devSold: false, sniperPct: MODERATION.maxSniperPct + 0.1 } }],
    ["sniper share not known yet", { ...ok, latest: { devSold: false, sniperPct: null } }],
    ["a banned word in the name", { ...ok, name: "Porn Dog" }],
    ["a banned word in the symbol", { ...ok, symbol: "NAZI" }],
  ])("leaves out a coin with %s", (_why, coin) => {
    expect(showInLiveStrip(coin)).toBe(false);
  });

  it("leaves out a coin on the hide list", () => {
    MODERATION.hiddenMints.push(ok.mint);
    try {
      expect(showInLiveStrip(ok)).toBe(false);
    } finally {
      MODERATION.hiddenMints.pop();
    }
  });

  it("labels the strip as pump.fun coins, not Yardstick launches or picks", () => {
    const src = readFileSync(new URL("../src/components/live-strip.tsx", import.meta.url), "utf8");
    expect(src).toContain("Live on pump.fun");
    expect(src).toContain("Not Yardstick launches, not recommendations.");
    expect(src).toContain("Not Yardstick launches, not picks");
    expect(src).not.toMatch(/<(img|CoinImage)\b/); // no coin images
  });
});
