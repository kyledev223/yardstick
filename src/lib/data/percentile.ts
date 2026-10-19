import { COMPOSITE_WEIGHTS, PERCENTILE_POINTS, type MetricKey } from "../config";

/** Linear-interpolated quantile (type 7, as in most stats packages). `sorted` ascending. */
export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** p5, p10 … p95 breakpoints for a sample. */
export function breakpoints(values: number[]): number[] {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  return PERCENTILE_POINTS.map((p) => quantile(sorted, p / 100));
}

export function median(values: number[]): number | null {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  return sorted.length ? quantile(sorted, 0.5) : null;
}

/**
 * Where `value` falls among the breakpoints, as a percentile 0–100.
 * Ties use the middle of the tied range (so if most coins have 0 snipers, a coin with
 * 0 lands mid-pack rather than at the top or bottom). Values outside p5–p95 map to 2.5 / 97.5.
 */
export function percentileOf(value: number, bps: number[]): number {
  const n = bps.length;
  if (n === 0 || !Number.isFinite(value)) return NaN;
  const pts = PERCENTILE_POINTS;
  let firstGE = -1;
  let lastLE = -1;
  for (let i = 0; i < n; i++) {
    if (firstGE === -1 && bps[i] >= value) firstGE = i;
    if (bps[i] <= value) lastLE = i;
  }
  if (lastLE === -1) return pts[0] / 2; // below p5
  if (firstGE === -1) return (pts[n - 1] + 100) / 2; // above p95
  if (bps[firstGE] === value) {
    // Exact hit, possibly a run of equal breakpoints: take the middle of the run,
    // extended half a step either side to cover the gaps around it.
    const lo = firstGE === 0 ? 0 : (pts[firstGE - 1] + pts[firstGE]) / 2;
    const hi = lastLE === n - 1 ? 100 : (pts[lastLE] + pts[lastLE + 1]) / 2;
    return (lo + hi) / 2;
  }
  // Strictly between bps[lastLE] and bps[firstGE] (adjacent indices).
  const a = bps[lastLE];
  const b = bps[firstGE];
  const t = (value - a) / (b - a);
  return pts[lastLE] + t * (pts[firstGE] - pts[lastLE]);
}

/** "Top X%" from a percentile (higher percentile = better). */
export function topShare(percentile: number): number {
  return Math.max(1, Math.round(100 - percentile));
}

export type MetricPercentiles = Partial<Record<MetricKey, number | null | undefined>>;

/**
 * Composite = weighted average of metric percentiles (inverted metrics use 100 − p).
 * Missing metrics are dropped and the remaining weights rescaled; if less than 60% of the
 * weight is available the composite is not computed.
 */
export function compositeScore(p: MetricPercentiles): number | null {
  let sum = 0;
  let wsum = 0;
  for (const { metric, weight, inverted } of COMPOSITE_WEIGHTS) {
    const v = p[metric];
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    sum += weight * (inverted ? 100 - v : v);
    wsum += weight;
  }
  if (wsum < 0.6 - 1e-9) return null;
  return sum / wsum;
}
