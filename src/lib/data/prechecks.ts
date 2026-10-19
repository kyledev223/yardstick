import "server-only";
import { DATA } from "../config";
import { db } from "../db";
import { fmtPct, fmtSol, ordinal } from "../format";
import { nameKey } from "../launch/validate";
import { launchRates } from "./baseline";
import { percentileOf, breakpoints, median } from "./percentile";

export type CheckStatus = "good" | "look" | "info";
export type PreCheck = { id: string; label: string; status: CheckStatus; text: string };

export type PreCheckInput = {
  name: string;
  symbol: string;
  description: string;
  hasImage: boolean;
  twitter: boolean;
  telegram: boolean;
  website: boolean;
  devBuySol: number;
};

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

type Recent = { name: string; symbol: string; nameKey: string };
let recentCache: { at: number; coins: Recent[] } | null = null;

async function recentCoins(): Promise<Recent[]> {
  if (recentCache && Date.now() - recentCache.at < 5 * 60_000) return recentCache.coins;
  const coins = await db().coin.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) }, source: { in: ["baseline", "yardstick"] } },
    select: { name: true, symbol: true, nameKey: true },
  });
  recentCache = { at: Date.now(), coins };
  return coins;
}

/** Pure part of the collision check, exported for tests. */
export function findCollisions(input: { name: string; symbol: string }, coins: Recent[]) {
  const sym = input.symbol.trim().toUpperCase();
  const key = nameKey(input.name);
  const sameSymbol = sym ? coins.filter((c) => c.symbol.toUpperCase() === sym) : [];
  const similarName =
    key.length >= 3 ? coins.filter((c) => c.nameKey && (c.nameKey === key || (key.length >= 5 && Math.abs(c.nameKey.length - key.length) <= 1 && levenshtein(c.nameKey, key) <= 1))) : [];
  return { sameSymbol, similarName };
}

export function collisionCheck(input: { name: string; symbol: string }, coins: Recent[]): PreCheck {
  const label = "Name and symbol";
  if (!input.name.trim() && !input.symbol.trim()) return { id: "collision", label, status: "info", text: "Type a name and symbol to check for look-alikes." };
  const { sameSymbol, similarName } = findCollisions(input, coins);
  const n = new Set([...sameSymbol, ...similarName].map((c) => c.name + c.symbol)).size;
  if (n === 0) return { id: "collision", label, status: "good", text: `No coin among the ${coins.length.toLocaleString("en-US")} Yardstick has seen in the last 7 days used this symbol or a near-identical name.` };
  const example = [...sameSymbol, ...similarName][0];
  return {
    id: "collision",
    label,
    status: "look",
    text: `${n} coin${n === 1 ? "" : "s"} in the last 7 days used ${sameSymbol.length ? `$${input.symbol.toUpperCase()}` : "a near-identical name"}${example ? ` (e.g. "${example.name}")` : ""}. Look-alikes can be hard to tell apart in search.`,
  };
}

async function completenessCheck(input: PreCheckInput): Promise<PreCheck> {
  const label = "Completeness";
  const grads = await db().coin.findMany({
    where: { graduatedAt: { not: null }, metaFetchedAt: { not: null }, createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    select: { twitter: true, telegram: true, website: true, descLength: true },
  });
  const missing = [!input.hasImage && "image", !input.description.trim() && "description", !input.twitter && "X / Twitter", !input.telegram && "Telegram", !input.website && "website"].filter(Boolean) as string[];
  if (grads.length < DATA.minSampleForGraduated) {
    return {
      id: "completeness",
      label,
      status: missing.length ? "info" : "good",
      text: missing.length ? `Not filled in yet: ${missing.join(", ")}. Too few graduated coins in the sample (${grads.length}) to compare against yet.` : "Image, description and all socials are filled in.",
    };
  }
  const rate = (f: (g: (typeof grads)[number]) => boolean) => (grads.filter(f).length / grads.length) * 100;
  const rates = { website: rate((g) => !!g.website), twitter: rate((g) => !!g.twitter), telegram: rate((g) => !!g.telegram) };
  const gaps: string[] = [];
  if (!input.website) gaps.push(`had a website ${fmtPct(rates.website, 0)} of the time`);
  if (!input.twitter) gaps.push(`linked an X account ${fmtPct(rates.twitter, 0)} of the time`);
  if (!input.telegram) gaps.push(`linked a Telegram ${fmtPct(rates.telegram, 0)} of the time`);
  const descMedian = median(grads.map((g) => g.descLength ?? 0)) ?? 0;
  if (gaps.length === 0 && input.hasImage) {
    return { id: "completeness", label, status: "good", text: `All socials filled in. Coins that graduated in the last 7 days had a median description of ${Math.round(descMedian)} characters; yours is ${input.description.trim().length}.` };
  }
  const worth = (!input.website && rates.website >= 40) || (!input.twitter && rates.twitter >= 40) || (!input.telegram && rates.telegram >= 40);
  return {
    id: "completeness",
    label,
    status: worth ? "look" : "info",
    text: `Coins that graduated in the last 7 days (${grads.length} in the sample) ${gaps.join(", ")}. Yours doesn't have ${gaps.length === 1 ? "that" : "these"} yet.`,
  };
}

async function devBuyCheck(devBuySol: number): Promise<PreCheck> {
  const label = "Dev buy size";
  const rows = await db().coin.findMany({
    where: { source: "baseline", devBuyLamports: { not: null }, createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    select: { devBuyLamports: true },
  });
  const sols = rows.map((r) => Number(r.devBuyLamports) / 1e9);
  if (sols.length < DATA.minSampleForPercentile) {
    return { id: "devbuy", label, status: "info", text: `Not enough sampled coins yet (${sols.length}) to compare dev buys.` };
  }
  const bps = breakpoints(sols);
  const med = median(sols) ?? 0;
  const zeroShare = (sols.filter((s) => s === 0).length / sols.length) * 100;
  if (devBuySol === 0) {
    return { id: "devbuy", label, status: "info", text: `No dev buy. ${fmtPct(zeroShare, 0)} of sampled pump.fun coins also launched without one; the median dev buy was ${fmtSol(med)} SOL.` };
  }
  const p = percentileOf(devBuySol, bps);
  return {
    id: "devbuy",
    label,
    status: p >= 90 ? "look" : "info",
    text: `A ${fmtSol(devBuySol)} SOL dev buy sits around the ${ordinal(p)} percentile of sampled coins (median ${fmtSol(med)} SOL).${p >= 90 ? " A large dev buy shows up in the creator-wallet and top-10 metrics." : ""}`,
  };
}

async function timingCheck(): Promise<PreCheck> {
  const label = "Timing";
  const r = await launchRates();
  if (r.recentPerHour === null) return { id: "timing", label, status: "info", text: "Not enough launch-rate data yet to say how busy pump.fun is right now." };
  if (r.avgPerHour === null || r.avgCoveredHours < 6) {
    return { id: "timing", label, status: "info", text: `About ${Math.round(r.recentPerHour).toLocaleString("en-US")} pump.fun launches an hour right now. The 7-day average needs a few more hours of data before it can be compared.` };
  }
  const ratio = r.recentPerHour / r.avgPerHour;
  const now = Math.round(r.recentPerHour).toLocaleString("en-US");
  const avg = Math.round(r.avgPerHour).toLocaleString("en-US");
  if (ratio > 1.25)
    return { id: "timing", label, status: "look", text: `pump.fun is busier than usual: about ${now} launches an hour right now vs a 7-day average of ${avg}. More launches compete for the same attention.` };
  if (ratio < 0.8) return { id: "timing", label, status: "good", text: `pump.fun is quieter than usual: about ${now} launches an hour vs a 7-day average of ${avg}.` };
  return { id: "timing", label, status: "info", text: `About ${now} launches an hour right now, close to the 7-day average of ${avg}.` };
}

export async function runPreChecks(input: PreCheckInput): Promise<PreCheck[]> {
  const [coins, completeness, devbuy, timing] = await Promise.all([recentCoins(), completenessCheck(input), devBuyCheck(input.devBuySol), timingCheck()]);
  return [collisionCheck(input, coins), completeness, devbuy, timing];
}
