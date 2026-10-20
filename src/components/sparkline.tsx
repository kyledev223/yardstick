/** Tiny trend line over the coin's fixed-age snapshots (log-time x). No axes: context only. */
export function Sparkline({ points, label }: { points: { age: number; value: number }[]; label: string }) {
  if (points.length < 2) return <div className="h-6" aria-hidden />;
  const W = 96;
  const H = 24;
  const xs = points.map((p) => Math.log(Math.max(p.age, 60)));
  const ys = points.map((p) => p.value);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const sx = (x: number) => (x1 === x0 ? W / 2 : 2 + ((x - x0) / (x1 - x0)) * (W - 4));
  const sy = (y: number) => (y1 === y0 ? H / 2 : H - 3 - ((y - y0) / (y1 - y0)) * (H - 6));
  const d = points.map((p, i) => `${i ? "L" : "M"}${sx(xs[i]).toFixed(1)},${sy(p.value).toFixed(1)}`).join("");
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-6 w-24" role="img" aria-label={`${label} trend over ${points.length} readings`}>
      <path d={d} fill="none" stroke="var(--data-you)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={sx(xs[xs.length - 1])} cy={sy(last.value)} r="3" fill="var(--data-you)" stroke="var(--card)" strokeWidth="1.5" />
    </svg>
  );
}
