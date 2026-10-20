"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AGE_BUCKETS } from "@/lib/config";
import { fmtAge, fmtInt, fmtSol } from "@/lib/format";

type Band = { age: number; p25: number; p50: number; p75: number; n: number };
type Pt = { age: number; value: number };

/** Drawing width before the chart has measured itself (server render). */
const DEFAULT_W = 640;
const H = 260;
const M = { l: 48, r: 16, t: 14, b: 30 };

/**
 * This coin's holders or market cap over age, against the comparison group's median
 * and 25th–75th percentile band at each fixed age. Log-scaled age axis.
 */
export function TrajectoryChart({ coin, band, metric, groupLabel }: { coin: Pt[]; band: Band[]; metric: "holders" | "mcapSol"; groupLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const titleId = useId();
  // Draw at the real width so labels stay readable on phones instead of shrinking with the SVG.
  const boxRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(DEFAULT_W);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fmt = metric === "holders" ? (v: number) => fmtInt(v) : (v: number) => `${fmtSol(v)} SOL`;

  const geo = useMemo(() => {
    const ages = [...coin.map((p) => p.age), ...band.map((b) => b.age)];
    const maxAge = Math.max(AGE_BUCKETS[3].seconds, ...ages);
    const minAge = AGE_BUCKETS[0].seconds;
    const lx = (a: number) => Math.log(Math.max(a, minAge));
    // Rounded so server and browser produce identical SVG (Math.log can differ in the last digit).
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const x = (a: number) => r2(M.l + ((lx(a) - lx(minAge)) / (lx(maxAge) - lx(minAge) || 1)) * (W - M.l - M.r));
    const maxV = Math.max(metric === "holders" ? 4 : 1, ...coin.map((p) => p.value), ...band.map((b) => b.p75)) * 1.08;
    const y = (v: number) => r2(H - M.b - (v / maxV) * (H - M.t - M.b));
    const yTicks = niceTicks(maxV, 4, metric === "holders");
    // Every fixed age gets a tick; labels are skipped where they would collide on narrow screens.
    const xTicks: ((typeof AGE_BUCKETS)[number] & { label: boolean })[] = [];
    for (const b of AGE_BUCKETS) {
      if (b.seconds > maxAge * 1.01) break;
      const prev = [...xTicks].reverse().find((t) => t.label);
      xTicks.push({ ...b, label: !prev || x(b.seconds) - x(prev.seconds) >= 30 });
    }
    return { x, y, yTicks, xTicks, maxAge };
  }, [coin, band, metric, W]);

  const bandPath = band.length >= 2 ? `M${band.map((b) => `${geo.x(b.age)},${geo.y(b.p75)}`).join("L")}L${[...band].reverse().map((b) => `${geo.x(b.age)},${geo.y(b.p25)}`).join("L")}Z` : "";
  const medPath = band.length >= 2 ? `M${band.map((b) => `${geo.x(b.age)},${geo.y(b.p50)}`).join("L")}` : "";
  const coinPath = coin.length >= 1 ? `M${coin.map((p) => `${geo.x(p.age)},${geo.y(p.value)}`).join("L")}` : "";

  // Hover: nearest age among coin points and band ages.
  const stops = [...new Set([...coin.map((p) => p.age), ...band.map((b) => b.age)])].sort((a, b) => a - b);
  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * (W - M.l - M.r) + M.l;
    let best = 0;
    let bd = Infinity;
    stops.forEach((s, i) => {
      const d = Math.abs(geo.x(s) - px);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    setHover(stops.length ? best : null);
  };
  const hAge = hover !== null ? stops[hover] : null;
  const hCoin = hAge !== null ? coin.find((p) => p.age === hAge) : undefined;
  const hBand = hAge !== null ? band.find((b) => b.age === hAge) : undefined;

  const lastCoin = coin[coin.length - 1];
  const lastBand = band[band.length - 1];

  return (
    <figure aria-labelledby={titleId}>
      <div ref={boxRef}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none" role="img" aria-labelledby={titleId}>
        {/* grid: recessive */}
        {geo.yTicks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={geo.y(t)} y2={geo.y(t)} stroke="var(--rule)" strokeWidth="1" />
            <text x={M.l - 8} y={geo.y(t) + 4} textAnchor="end" className="num" fontSize="11" fill="var(--muted)">
              {metric === "holders" ? fmtInt(t) : fmtSol(t)}
            </text>
          </g>
        ))}
        {/* x axis */}
        <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} stroke="var(--rule-strong)" />
        {geo.xTicks.map((b) => (
          <g key={b.key}>
            <line x1={geo.x(b.seconds)} x2={geo.x(b.seconds)} y1={H - M.b} y2={H - M.b + 6} stroke="var(--rule-strong)" />
            {b.label && (
              <text x={geo.x(b.seconds)} y={H - M.b + 19} textAnchor="middle" className="num" fontSize="11" fill="var(--muted)">
                {b.key}
              </text>
            )}
          </g>
        ))}

        {bandPath && <path d={bandPath} fill="var(--data-range-strong)" />}
        {medPath && <path d={medPath} fill="none" stroke="var(--data-median)" strokeWidth="2" strokeDasharray="5 4" />}
        {coinPath && <path d={coinPath} fill="none" stroke="var(--data-you)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
        {coin.map((p) => (
          <circle key={p.age} cx={geo.x(p.age)} cy={geo.y(p.value)} r="4.5" fill="var(--data-you)" stroke="var(--card)" strokeWidth="2" />
        ))}

        {/* direct labels */}
        {lastCoin && (
          <text x={Math.min(geo.x(lastCoin.age) + 8, W - M.r - 60)} y={geo.y(lastCoin.value) - 8} fontSize="12" fontWeight="500" fill="var(--primary-ink)">
            This coin
          </text>
        )}
        {lastBand && (
          <text x={geo.x(lastBand.age) - 4} y={geo.y(lastBand.p50) - 6} textAnchor="end" fontSize="11" fontWeight="500" fill="var(--muted)">
            Median
          </text>
        )}

        {hAge !== null && (
          <line x1={geo.x(hAge)} x2={geo.x(hAge)} y1={M.t} y2={H - M.b} stroke="var(--rule-strong)" strokeWidth="1" />
        )}
        <rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      </div>

      <div className="mt-3 flex min-h-[1.5rem] flex-wrap items-center gap-x-5 gap-y-1.5 text-label text-muted">
        {hAge !== null ? (
          <span className="num text-ink">
            At {fmtAge(hAge)}: {hCoin ? <>this coin {fmt(hCoin.value)}</> : "no reading for this coin"}
            {hBand ? <>; median {fmt(hBand.p50)}; middle half {fmt(hBand.p25)}–{fmt(hBand.p75)}</> : null}
          </span>
        ) : (
          <>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-[3px] w-5 rounded-pill bg-data-you" /> This coin
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-5 border-t-2 border-dashed border-data-median" /> Median, {groupLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-5 rounded-pill bg-data-range-strong" /> Middle half (25th–75th percentile)
            </span>
          </>
        )}
      </div>

      <figcaption id={titleId} className="sr-only">
        {metric === "holders" ? "Holders" : "Market cap"} by age for this coin compared with {groupLabel}.
        {lastCoin ? ` Latest reading at ${fmtAge(lastCoin.age)}: ${fmt(lastCoin.value)}.` : " No readings yet."}
        {lastBand ? ` Group median at ${fmtAge(lastBand.age)}: ${fmt(lastBand.p50)}.` : " Not enough comparison data yet."}
      </figcaption>

      <details className="mt-3 text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center link">Show as table</summary>
        <table className="num mt-2 w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="py-1 font-mono text-mono font-normal tracking-[0.12em] uppercase">Age</th>
              <th className="py-1 font-mono text-mono font-normal tracking-[0.12em] uppercase">This coin</th>
              <th className="py-1 font-mono text-mono font-normal tracking-[0.12em] uppercase">25th</th>
              <th className="py-1 font-mono text-mono font-normal tracking-[0.12em] uppercase">Median</th>
              <th className="py-1 font-mono text-mono font-normal tracking-[0.12em] uppercase">75th</th>
            </tr>
          </thead>
          <tbody>
            {stops.map((a) => {
              const c = coin.find((p) => p.age === a);
              const b = band.find((x) => x.age === a);
              return (
                <tr key={a} className="border-t border-rule">
                  <td className="py-1">{fmtAge(a)}</td>
                  <td className="py-1">{c ? fmt(c.value) : "–"}</td>
                  <td className="py-1">{b ? fmt(b.p25) : "–"}</td>
                  <td className="py-1">{b ? fmt(b.p50) : "–"}</td>
                  <td className="py-1">{b ? fmt(b.p75) : "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function niceTicks(max: number, count: number, integers = false): number[] {
  const raw = integers ? Math.max(1, max / count) : max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(Number(v.toPrecision(6)));
  return out;
}
