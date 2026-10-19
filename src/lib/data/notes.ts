import { DATA, type MetricKey } from "../config";
import { fmtInt, fmtPct, fmtRatio, fmtSol } from "../format";
import { percentileOf } from "./percentile";

export type NoteDist = { breakpoints: number[]; sampleSize: number; gradMedian: number | null; gradSampleSize: number };
export type Note = { metric: MetricKey | "dev"; tone: "look" | "info" | "good"; text: string };

type NoteInput = {
  values: Partial<Record<MetricKey, number | null>>;
  dev: { sold: boolean | null; soldSol: number | null; soldPct: number | null; holdPct: number | null };
  dists: Map<string, NoteDist>;
  ageLabel: string; // e.g. "2h"
};

const LOWER_IS_HEALTHIER = new Set<MetricKey>(["top10Pct", "sniperPct", "freshWalletPct", "devHoldPct"]);

const fmt: Partial<Record<MetricKey, (v: number) => string>> = {
  holders: fmtInt,
  uniqueBuyers: fmtInt,
  netInflowSol: (v) => `${fmtSol(v)} SOL`,
  curveProgress: (v) => fmtPct(v),
  top10Pct: (v) => fmtPct(v),
  sniperPct: (v) => fmtPct(v),
  freshWalletPct: (v) => fmtPct(v, 0),
  devHoldPct: (v) => fmtPct(v),
  buySellCountRatio: fmtRatio,
};

function sentence(m: MetricKey, v: string, ref: string, who: string, age: string): string {
  switch (m) {
    case "holders":
      return `${v} holders so far. ${who} had a median of ${ref} at ${age}.`;
    case "uniqueBuyers":
      return `${v} different wallets have bought. ${who} had a median of ${ref} at ${age}.`;
    case "netInflowSol":
      return `Net SOL in (buys minus sells) is ${v}. ${who} had a median of ${ref} at ${age}.`;
    case "curveProgress":
      return `The bonding curve is ${v} full. ${who} were at a median of ${ref} at ${age}.`;
    case "top10Pct":
      return `Top 10 wallets hold ${v} of supply. ${who} had a median of ${ref} at ${age}.`;
    case "sniperPct":
      return `${v} of supply was bought in the first slots after creation by wallets other than the creator. ${who}: median ${ref}.`;
    case "freshWalletPct":
      return `${v} of sampled buyers are brand-new or near-empty wallets. ${who}: median ${ref}.`;
    case "devHoldPct":
      return `The creator wallet holds ${v} of supply. ${who} had a median of ${ref} at ${age}.`;
    case "buySellCountRatio":
      return `Buys outnumber sells ${v}. ${who} had a median of ${ref} at ${age}.`;
    default:
      return `${m}: ${v} vs ${ref}.`;
  }
}

/**
 * 2–4 descriptive notes from the coin's weakest metrics, compared with coins that graduated
 * (or with the median coin when too few graduated coins exist at this age). No advice.
 * When fewer than 2 notes result and comparison data exists, the remaining compared metrics
 * furthest from the reference fill in (never invented: each is a real value vs a real median).
 */
export function buildNotes(input: NoteInput): Note[] {
  const compared: { m: MetricKey; gap: number; text: string }[] = [];
  for (const [m, f] of Object.entries(fmt) as [MetricKey, (v: number) => string][]) {
    const v = input.values[m];
    const d = input.dists.get(m);
    if (v === null || v === undefined || !d || d.sampleSize < DATA.minSampleForPercentile || d.breakpoints.length === 0) continue;
    const useGrad = d.gradMedian !== null && d.gradSampleSize >= DATA.minSampleForGraduated;
    const ref = useGrad ? d.gradMedian! : d.breakpoints[9];
    const who = useGrad ? "Coins that graduated" : "The median coin";
    const pv = percentileOf(v, d.breakpoints);
    const pr = percentileOf(ref, d.breakpoints);
    const gap = LOWER_IS_HEALTHIER.has(m) ? pv - pr : pr - pv;
    compared.push({ m, gap, text: sentence(m, f(v), f(ref), who, input.ageLabel) });
  }
  const candidates = compared.filter((c) => c.gap > 10).sort((a, b) => b.gap - a.gap);
  const notes: Note[] = candidates.slice(0, 3).map((c) => ({ metric: c.m, tone: "look", text: c.text }));

  if (input.dev.sold === false) notes.push({ metric: "dev", tone: "info", text: "No sells from the creator wallet so far." });
  else if (input.dev.sold) {
    notes.push({
      metric: "dev",
      tone: "look",
      text: `The creator wallet has sold ${fmtSol(input.dev.soldSol ?? 0)} SOL worth (${fmtPct(input.dev.soldPct ?? 0)} of supply).`,
    });
  }

  if (candidates.length === 0 && compared.length >= 3) {
    notes.unshift({ metric: "holders", tone: "good", text: `Every compared metric is at or near the reference median at ${input.ageLabel}.` });
  }

  // Top up to 2 with real comparisons, furthest from the reference first.
  if (compared.length > 0 && notes.length < 2) {
    const used = new Set(notes.map((n) => n.metric));
    for (const c of compared.filter((x) => !used.has(x.m)).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))) {
      if (notes.length >= 2) break;
      notes.push({ metric: c.m, tone: c.gap < -10 ? "good" : "info", text: c.text });
    }
  }
  return notes.slice(0, 4);
}
