"use client";
import { InView } from "./in-view";
import { useMounted } from "./util";

// Designed empty states: shown only while there's nothing to list. Shapes only, never values; always aria-hidden,
// so the message next to them carries the meaning. Their loops run only while on screen (InView), and they draw after
// hydration into a box of the same shape (useMounted), which keeps their markup out of the page's HTML.

const mono = { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em" } as const;
const PODIUM = [150, 122, 100, 82, 66, 52]; // slot heights, tallest for 01
// Trig results can differ in the last digits between the server and the browser; round so hydration matches.
const r2 = (n: number) => Math.round(n * 100) / 100;

// The dial: 72 ticks around the outer ring, a long one every 6th. Two paths instead of 72 lines keeps the HTML small.
const DIAL = Array.from({ length: 72 }, (_, i) => i).reduce(
  (acc, i) => {
    const a = (i / 72) * Math.PI * 2;
    const long = i % 6 === 0;
    const inner = long ? 176 : 182;
    const seg = `M${r2(200 + Math.cos(a) * 188)} ${r2(200 + Math.sin(a) * 188)}L${r2(200 + Math.cos(a) * inner)} ${r2(200 + Math.sin(a) * inner)}`;
    if (long) acc.long += seg;
    else acc.short += seg;
    return acc;
  },
  { long: "", short: "" },
);

const PODIUM_TONES = {
  panel: { line: "var(--panel-muted)", fill: "var(--panel-accent)", text: "var(--panel-muted)", marker: "var(--accent)" },
  page: { line: "var(--rule-strong)", fill: "var(--primary-ink)", text: "var(--muted)", marker: "var(--accent-ink)" },
};

/** "Top coins" with no launches: six open slots as bars waiting to rise, and a coral marker over 01. */
export function EmptyPodium({ tone = "panel", slots = 6, className = "" }: { tone?: keyof typeof PODIUM_TONES; slots?: number; className?: string }) {
  const c = PODIUM_TONES[tone];
  const heights = PODIUM.slice(0, slots);
  const mounted = useMounted();
  const width = 12 + heights.length * 58;
  if (!mounted) return <div aria-hidden className={className} style={{ aspectRatio: `${width} / 214` }} />;
  return (
    <InView className={className}>
      <svg viewBox={`0 0 ${width} 214`} className="w-full">
      {heights.map((h, i) => {
        const x = 12 + i * 58;
        return (
          <g key={h}>
            <rect x={x} y={184 - h} width={46} height={h} rx={10} fill="none" stroke={c.line} strokeOpacity={0.55} strokeDasharray="3 5" />
            <rect x={x + 6} y={178 - h} width={34} height={h} rx={7} fill={c.fill} fillOpacity={0.4} className="fx-stub" style={{ animationDelay: `${i * 0.22}s` }} />
            <text x={x + 23} y={204} textAnchor="middle" fill={c.text} style={mono}>
              {String(i + 1).padStart(2, "0")}
            </text>
          </g>
        );
      })}
      <g className="fx-bob">
        <circle cx={35} cy={14} r={6} fill={c.marker} />
        <circle cx={35} cy={14} r={11} fill="none" stroke={c.marker} strokeOpacity={0.5} />
      </g>
      </svg>
    </InView>
  );
}

/** A stage with nobody on it: a slow dial, two rings and a pulsing coral marker in the middle, with a short label. */
export function EmptyRings({ label, className = "" }: { label?: string; className?: string }) {
  const mounted = useMounted();
  if (!mounted) return <div aria-hidden className={`relative ${className}`} />;
  return (
    <InView className={`relative ${className}`}>
      <svg viewBox="0 0 400 400" className="size-full">
        <g className="fx-dial" stroke="var(--rule-strong)">
          <path d={DIAL.long} strokeOpacity={0.9} strokeWidth={1.5} />
          <path d={DIAL.short} strokeOpacity={0.45} />
        </g>
        <circle cx={200} cy={200} r={164} fill="none" stroke="var(--rule-strong)" strokeDasharray="4 6" />
        <circle cx={200} cy={200} r={120} fill="none" stroke="var(--rule)" />
        <circle cx={200} cy={200} r={70} fill="none" stroke="var(--rule)" strokeOpacity={0.7} />
        <circle cx={200} cy={200} r={14} fill="var(--accent)" className="fx-pulse" />
        <circle cx={200} cy={200} r={14} fill="var(--accent)" className="fx-pulse fx-pulse-late" />
        <circle cx={200} cy={200} r={9} fill="var(--accent)" />
      </svg>
      {label && (
        <span className="absolute top-[69%] left-1/2 -translate-x-1/2 font-mono text-mono tracking-[0.12em] whitespace-nowrap text-muted uppercase">{label}</span>
      )}
    </InView>
  );
}
