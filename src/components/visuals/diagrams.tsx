"use client";
import { useId } from "react";
import { useMounted, usePhases, useSvgText } from "./util";

// Explanatory diagrams of the method. Illustrations, not data: no numbers, and each says so to screen readers.
// They play once when scrolled into view (reduced motion: straight to the last frame). The drawings render after
// hydration into a box of the same shape (useMounted), so the page's HTML stays small.

const W = 520; // viewBox width of both diagrams
const YOURS = "var(--accent-ink)";
const label = (size: number) => ({ fontFamily: "var(--font-mono)", fontSize: size, letterSpacing: "0.12em" }) as const;

/** The steps a diagram plays through, under it; the current one in ink. */
function Steps({ steps, phase }: { steps: string[]; phase: number }) {
  return (
    <ol aria-hidden className="mt-4 grid gap-1.5 font-mono text-mono tracking-[0.12em] uppercase sm:grid-cols-3">
      {steps.map((t, i) => (
        <li key={t} className={`transition-colors duration-(--dur-fast) ${phase >= i + 1 ? "text-ink" : "text-muted"}`}>
          {String(i + 1).padStart(2, "0")} {t}
        </li>
      ))}
    </ol>
  );
}

// ---- Same-age comparison ----

const X0 = 40;
const NOW = 500;
const BASE = 192;
const SLICE = 150; // "1h" of age, in px from launch
type Line = { start: number; H: number; tau: number; seed: number; you?: boolean };
const LINES: Line[] = [
  { start: 40, H: 72, tau: 90, seed: 1 },
  { start: 105, H: 128, tau: 60, seed: 2 },
  { start: 165, H: 104, tau: 70, seed: 3, you: true },
  { start: 225, H: 56, tau: 50, seed: 4 },
  { start: 285, H: 138, tau: 45, seed: 5 },
];
// Rounded: trig results can differ in the last digits between the server and the browser, which breaks hydration.
const lineY = (l: Line, a: number) => Math.round((BASE - 8 - l.H * (1 - Math.exp(-a / l.tau)) - 6 * Math.sin(a / 19 + l.seed * 1.7) * Math.min(1, a / 40)) * 10) / 10;
const linePath = (l: Line) => {
  const pts: string[] = [];
  for (let a = 0; a <= NOW - l.start; a += 5) pts.push(`${a} ${lineY(l, a)}`);
  return `M${pts.join(" L")}`;
};

/** Coin lines start at different times, slide together so they line up by age, then a slice at "1h" picks each out. */
export function SameAgeDiagram() {
  const [ref, phase] = usePhases<HTMLDivElement>([0, 1600, 3000]);
  const mounted = useMounted();
  const [svg, size] = useSvgText(W, mounted);
  const id = useId();
  const aligned = phase >= 2;
  const mono = label(size);
  return (
    <div ref={ref}>
      {!mounted ? (
        <div className="aspect-[520/222] w-full" />
      ) : (
        <svg ref={svg} viewBox={`0 0 ${W} 222`} role="img" aria-labelledby={`${id}-t ${id}-d`} className="w-full overflow-visible">
          <title id={`${id}-t`}>Illustration: how coins are compared at the same age</title>
          <desc id={`${id}-d`}>
            An illustration of the method, not data. Five coin lines start at different times. They slide left until they all start at the same point, so they line up by age. A dashed line at one hour then marks
            where each coin was at that age, which is where they are compared. One line, yours, is highlighted.
          </desc>
          <line x1={X0} x2={NOW} y1={BASE + 6} y2={BASE + 6} stroke="var(--rule-strong)" />
          {LINES.map((l) => (
            <line key={l.start} x1={l.start} x2={l.start} y1={BASE + 2} y2={BASE + 10} stroke="var(--rule-strong)" className={`fx-fade ${phase >= 1 && !aligned ? "fx-shown" : ""}`} />
          ))}
          <text x={NOW} y={BASE + 10 + size * 1.3} textAnchor="end" fill="var(--muted)" style={mono}>
            {aligned ? "AGE →" : "CLOCK TIME →"}
          </text>
          <text x={X0} y={BASE + 10 + size * 1.3} fill="var(--muted)" style={mono} className={`fx-fade ${aligned ? "fx-shown" : ""}`}>
            LAUNCH
          </text>
          <text x={NOW} y={18} textAnchor="end" fill="var(--muted)" style={mono} className={`fx-fade ${phase >= 1 && !aligned ? "fx-shown" : ""}`}>
            NOW
          </text>

          {LINES.map((l, i) => (
            <g key={l.seed} className="fx-move" style={{ transform: `translateX(${aligned ? X0 : l.start}px)`, transitionDelay: `${i * 70}ms` }}>
              <path
                d={linePath(l)}
                pathLength={1}
                fill="none"
                stroke={l.you ? YOURS : "var(--primary-ink)"}
                strokeOpacity={l.you ? 1 : 0.5}
                strokeWidth={l.you ? 2.5 : 1.5}
                strokeLinecap="round"
                className={`fx-draw ${phase >= 1 ? "fx-drawn" : ""}`}
                style={{ transitionDelay: `${i * 90}ms` }}
              />
            </g>
          ))}

          <g className={`fx-fade ${phase >= 3 ? "fx-shown" : ""}`}>
            <line x1={X0 + SLICE} x2={X0 + SLICE} y1={30} y2={BASE + 6} stroke="var(--ink)" strokeDasharray="3 4" />
            <text x={X0 + SLICE} y={22} textAnchor="middle" fill="var(--ink)" style={{ ...mono, fontSize: size * 1.1 }}>
              1H
            </text>
          </g>
          {LINES.map((l, i) => (
            <circle
              key={l.seed}
              cx={X0 + SLICE}
              cy={lineY(l, SLICE)}
              r={l.you ? 6 : 4.5}
              fill={l.you ? YOURS : "var(--primary-ink)"}
              stroke="var(--card)"
              strokeWidth={2}
              className={`fx-pop ${phase >= 3 ? "fx-popped" : ""}`}
              style={{ transitionDelay: `${300 + i * 80}ms` }}
            />
          ))}
        </svg>
      )}
      <Steps steps={["Launched at different times", "Lined up by age", "Compared at the same age"]} phase={phase} />
    </div>
  );
}

// ---- Standing (percentile) ----

const VALUES = [0.42, 0.15, 0.66, 0.3, 0.88, 0.52, 0.22, 0.71, 0.36, 0.58, 0.09, 0.47, 0.81, 0.27, 0.62];
const YOU_V = 0.76;
const SORTED = [...VALUES].sort((a, b) => a - b);
const YOU_RANK = [...VALUES, YOU_V].sort((a, b) => a - b).indexOf(YOU_V);
const slotX = (k: number, n: number) => 40 + (k * 440) / (n - 1);
const valY = (v: number) => 172 - v * 140;

/** Dots sort themselves low to high, a coral dot finds its place, and a bracket marks the middle half. */
export function PercentileDiagram() {
  const [ref, phase] = usePhases<HTMLDivElement>([0, 1300, 2700, 3900]);
  const mounted = useMounted();
  const [svg, size] = useSvgText(W, mounted);
  const id = useId();
  const mono = label(size);
  const x16 = (v: number) => {
    const k = SORTED.indexOf(v);
    return slotX(k >= YOU_RANK ? k + 1 : k, 16);
  };
  const [lo, hi] = [slotX(4, 16), slotX(11, 16)];
  const youX = slotX(YOU_RANK, 16);
  return (
    <div ref={ref}>
      {!mounted ? (
        <div className="aspect-[520/222] w-full" />
      ) : (
        <svg ref={svg} viewBox={`0 0 ${W} 222`} role="img" aria-labelledby={`${id}-t ${id}-d`} className="w-full overflow-visible">
          <title id={`${id}-t`}>Illustration: how a standing is worked out</title>
          <desc id={`${id}-d`}>
            An illustration of the method, not data. A row of dots, one per coin of the same age, sorts itself from low to high. Then your coin, in coral, drops into its place in the order. A bracket under
            the middle of the row marks the middle half of coins. Your coin sits above it, higher than most.
          </desc>
          <line x1={28} x2={492} y1={184} y2={184} stroke="var(--rule)" />
          {VALUES.map((v, i) => {
            const x = phase >= 3 ? x16(v) : phase >= 2 ? slotX(SORTED.indexOf(v), 15) : slotX(i, 15);
            return (
              <g key={v} className="fx-move" style={{ transform: `translate(${x}px, ${valY(v)}px)`, transitionDelay: `${(i % 5) * 40}ms` }}>
                <circle r={6} fill="var(--primary-ink)" fillOpacity={0.75} className={`fx-pop ${phase >= 1 ? "fx-popped" : ""}`} style={{ transitionDelay: `${i * 45}ms` }} />
              </g>
            );
          })}
          <g className="fx-move" style={{ transform: `translate(${youX}px, ${phase >= 3 ? valY(YOU_V) : -24}px)`, opacity: phase >= 3 ? 1 : 0 }}>
            <circle r={8} fill={YOURS} stroke="var(--card)" strokeWidth={2.5} />
            <text y={-16} textAnchor="middle" fill="var(--ink)" style={mono} className={`fx-fade ${phase >= 4 ? "fx-shown" : ""}`}>
              YOURS
            </text>
          </g>
          <g className={`fx-fade ${phase >= 4 ? "fx-shown" : ""}`}>
            <path d={`M${lo} 192 V198 H${hi} V192`} fill="none" stroke="var(--ink)" strokeWidth={1.5} />
            <text x={(lo + hi) / 2} y={200 + size * 1.3} textAnchor="middle" fill="var(--ink)" style={mono}>
              THE MIDDLE HALF
            </text>
            <text x={492} y={200 + size * 1.3} textAnchor="end" fill="var(--muted)" style={mono}>
              HIGHER →
            </text>
          </g>
        </svg>
      )}
      <Steps steps={["Every coin the same age", "Sorted low to high", "Yours finds its place"]} phase={phase} />
    </div>
  );
}

// ---- What we measure: four glyphs ----

function Holders({ on }: { on: boolean }) {
  const dots: [number, number, number][] = [
    [20, 22, 6],
    [34, 17, 5],
    [45, 27, 6.5],
    [25, 37, 4],
    [39, 40, 4],
    [15, 48, 3],
    [50, 46, 3],
    [31, 52, 3],
  ];
  return (
    <svg viewBox="0 0 64 64" className="size-16 overflow-visible" aria-hidden>
      {dots.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="var(--primary-ink)" className={`fx-pop ${on ? "fx-popped" : ""}`} style={{ transitionDelay: `${i * 70}ms` }} />
      ))}
      <ellipse cx={33} cy={23} rx={21} ry={14} fill="none" stroke={YOURS} strokeWidth={1.75} pathLength={1} className={`fx-draw ${on ? "fx-drawn" : ""}`} style={{ transitionDelay: "700ms" }} />
    </svg>
  );
}
function BuySell({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className="size-16 overflow-visible" aria-hidden>
      <rect x={17} y={8} width={12} height={26} rx={2.5} fill="var(--primary-ink)" className={`fx-grow fx-grow-up ${on ? "fx-grown" : ""}`} />
      <rect x={35} y={34} width={12} height={16} rx={2.5} fill={YOURS} className={`fx-grow fx-grow-down ${on ? "fx-grown" : ""}`} style={{ transitionDelay: "250ms" }} />
      <line x1={8} x2={56} y1={34} y2={34} stroke="var(--ink)" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}
function Curve({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className="size-16 overflow-visible" aria-hidden>
      <path d="M8 56 H56" stroke="var(--rule-strong)" strokeWidth={1.5} strokeLinecap="round" />
      <path d="M8 56 C 30 56, 38 42, 50 14" fill="none" stroke="var(--primary-ink)" strokeWidth={2.5} strokeLinecap="round" pathLength={1} className={`fx-draw ${on ? "fx-drawn" : ""}`} />
      <g className={`fx-fade ${on ? "fx-shown" : ""}`} style={{ transitionDelay: "900ms" }}>
        <path d="M50 14 V3 L59 6.5 L50 10" fill={YOURS} stroke={YOURS} strokeWidth={1.5} strokeLinejoin="round" />
      </g>
      <circle cx={50} cy={14} r={4} fill={YOURS} className={`fx-pop ${on ? "fx-popped" : ""}`} style={{ transitionDelay: "900ms" }} />
    </svg>
  );
}
function Warning({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className="size-16 overflow-visible" aria-hidden>
      <circle cx={32} cy={36} r={24} fill="none" stroke={YOURS} strokeWidth={1.5} className={`fx-ring ${on ? "fx-ring-play" : ""}`} style={{ animationDelay: "900ms" }} />
      <path d="M32 9 L57 54 H7 Z" fill="none" stroke={YOURS} strokeWidth={2.5} strokeLinejoin="round" pathLength={1} className={`fx-draw ${on ? "fx-drawn" : ""}`} />
      <g className={`fx-fade ${on ? "fx-shown" : ""}`} style={{ transitionDelay: "700ms" }}>
        <line x1={32} x2={32} y1={25} y2={39} stroke="var(--ink)" strokeWidth={3} strokeLinecap="round" />
        <circle cx={32} cy={46.5} r={2} fill="var(--ink)" />
      </g>
    </svg>
  );
}
const GLYPHS = [Holders, BuySell, Curve, Warning];

export type Measure = { label: string; text: string };

/** The 01–04 "What we measure" steps, each with a small glyph that plays once (staggered) when scrolled into view. */
export function MeasureGlyphs({ measures, className = "" }: { measures: Measure[]; className?: string }) {
  const [ref, phase] = usePhases<HTMLOListElement>([0, 300, 600, 900]);
  const mounted = useMounted();
  return (
    <ol ref={ref} className={`grid gap-10 border-t border-rule pt-8 sm:grid-cols-2 lg:grid-cols-4 ${className}`}>
      {measures.map(({ label, text }, i) => {
        const Glyph = GLYPHS[i % GLYPHS.length];
        return (
          <li key={label}>
            {mounted ? <Glyph on={phase >= i + 1} /> : <div className="size-16" />}
            <span className="mt-6 block font-mono text-mono text-muted uppercase">
              {String(i + 1).padStart(2, "0")} / {label}
            </span>
            <p className="mt-3 max-w-xs text-small">{text}</p>
          </li>
        );
      })}
    </ol>
  );
}
