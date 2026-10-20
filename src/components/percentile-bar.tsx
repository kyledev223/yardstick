import { ordinal } from "@/lib/format";

/**
 * Percentile bar: a rounded 0–100 track, the group's middle half shaded, the median notched
 * and this coin marked with a dot. `percentile` is already oriented so that right = healthier.
 */
export function PercentileBar({ percentile, label, size = "sm", showScale = false }: { percentile: number | null; label: string; size?: "sm" | "lg"; showScale?: boolean }) {
  const p = percentile === null ? null : Math.max(0, Math.min(100, percentile));
  const lg = size === "lg";
  return (
    <div role="img" aria-label={p === null ? `${label}: not enough data` : `${label}: ${ordinal(p)} percentile`}>
      {/* Without data only the bar dims; the scale labels keep full contrast. */}
      <div className={`relative ${lg ? "h-7" : "h-5"} ${p === null ? "opacity-35" : ""}`}>
        {/* track and middle half of the group */}
        <div className={`absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-pill bg-data-range ${lg ? "h-4" : "h-2.5"}`} />
        <div className={`absolute top-1/2 -translate-y-1/2 rounded-pill bg-data-range-strong ${lg ? "h-4" : "h-2.5"}`} style={{ left: "25%", width: "50%" }} />
        {/* median notch */}
        <div className="absolute inset-y-0 w-[2px] -translate-x-1/2 rounded-pill bg-data-median" style={{ left: "50%" }} />
        {p !== null && (
          <>
            <div className={`absolute left-0 top-1/2 -translate-y-1/2 rounded-pill bg-data-you ${lg ? "h-1.5" : "h-1"}`} style={{ width: `${p}%` }} />
            <div
              className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-pill bg-data-you ring-card ${lg ? "h-6 w-6 ring-4" : "h-4 w-4 ring-[3px]"}`}
              style={{ left: `${p}%` }}
            />
          </>
        )}
      </div>
      {showScale && (
        <div className="num mt-1.5 flex justify-between font-mono text-mono text-muted" aria-hidden>
          <span>0</span>
          <span>median</span>
          <span>100</span>
        </div>
      )}
      {p === null && <p className="sr-only">Not enough data yet</p>}
    </div>
  );
}

/** Metric bar: flips metrics where lower is healthier so right is always healthier. */
export function MetricBar({ percentile, inverted, label }: { percentile: number | null; inverted?: boolean; label: string }) {
  const oriented = percentile === null ? null : inverted ? 100 - percentile : percentile;
  return <PercentileBar percentile={oriented} label={label} />;
}
