import type { Metadata } from "next";
import { notFound } from "next/navigation";

// Dev-only style guide: every design token in one place. 404 in production.
export const metadata: Metadata = { title: "Design tokens", robots: { index: false } };

const SWATCHES: { group: string; tokens: [string, string][] }[] = [
  {
    group: "Surfaces",
    tokens: [
      ["page", "Page background"],
      ["surface", "Cards, panels, inputs"],
      ["soft", "Footer bar, quiet panels"],
      ["sunk", "Chips, tracks, alternate sections"],
    ],
  },
  {
    group: "Text and lines",
    tokens: [
      ["ink", "Body text, headings"],
      ["muted", "Secondary text"],
      ["faint", "Tertiary text"],
      ["teal-ink", "Links, small teal text"],
      ["rule", "Decorative dividers"],
      ["rule-strong", "Input borders"],
      ["focus", "Focus ring"],
    ],
  },
  {
    group: "Brand",
    tokens: [
      ["teal", "Large elements, accents"],
      ["btn", "Primary button"],
      ["yellow", "Highlight only"],
      ["coral", "Highlight only"],
      ["stone", "Neutral highlight"],
    ],
  },
  {
    group: "Data",
    tokens: [
      ["data-you", "Your coin"],
      ["data-median", "Median"],
      ["data-range", "Comparison range"],
      ["data-range-strong", "Middle half of range"],
      ["up", "Up"],
      ["down", "Down"],
    ],
  },
  {
    group: "Cursor field",
    tokens: [
      ["field-dot", "Dot glyph"],
      ["field-square", "Square glyph"],
      ["field-plus", "Plus glyph"],
    ],
  },
];

const TYPE: [string, string, string][] = [
  ["text-giant", "giant", "Off the scale"],
  ["text-display", "display", "See where you stand."],
  ["text-headline", "headline", "Launch → Measure → Improve"],
  ["text-title", "title", "Holders at 1 hour"],
  ["text-lead", "lead", "Compare your coin with every pump.fun coin of the same age."],
  ["text-base", "body (1rem)", "Trade-based metrics use the first 500 trades of each coin."],
  ["text-sm", "small (0.875rem)", "Refreshes every couple of minutes."],
  ["text-micro", "micro (0.8125rem)", "Solana mainnet · real SOL"],
];

const RADII = ["rounded-xs", "rounded-sm", "rounded-md", "rounded-lg", "rounded-xl", "rounded-2xl", "rounded-pill"];

const DEMO_METRICS: [string, string, string][] = [
  ["Holders", "412", "top 18%"],
  ["Market cap", "86.4 SOL", "top 24%"],
  ["Buyers", "1,208", "top 31%"],
  ["Curve progress", "41.7%", "top 22%"],
];
const DEMO_ROWS: [string, string, string, string][] = [
  ["MOTH", "1h", "88th", "+12.4%"],
  ["GLOW", "3h", "71st", "−3.0%"],
  ["PEBL", "6h", "64th", "+4.8%"],
  ["KITE", "1h", "52nd", "−8.1%"],
];

export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <>
      {/* Cursor field demo: full strength. */}
      <section data-field="full" className="flex min-h-[85svh] flex-col justify-center px-gutter py-section-sm">
        <div className="mx-auto w-full max-w-page">
          <p className="text-micro text-muted">Cursor field · data-field=&quot;full&quot;</p>
          <h1 className="mt-4 max-w-5xl text-display">
            <span className="pill pill-teal">Launch</span> on pump.fun. See where <span className="pill pill-yellow">you</span> stand.
          </h1>
          <p className="mt-6 max-w-measure text-lead text-muted">Move the pointer across this area: glyphs bloom along its path and wink out behind it. Small text like this never has a + behind it.</p>
        </div>
      </section>

      {/* Cursor field demo: a dashboard-style block, quiet. */}
      <section data-field="quiet" className="px-gutter py-section-sm">
        <div className="mx-auto w-full max-w-page">
          <p className="text-micro text-muted">Dashboard demo · data-field=&quot;quiet&quot;</p>
          <div className="mt-4 grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="text-sm text-muted">Standing among coins aged 1 hour</p>
              <p className="num text-figure-hero">
                82<span className="text-figure">nd</span>
              </p>
              <p className="mt-2 text-sm text-muted">
                Top <span className="num">18%</span> · compared with <span className="num">2,431</span> coins
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3 lg:col-span-8">
              {DEMO_METRICS.map(([k, v, s]) => (
                <div key={k} className="rounded-lg bg-surface p-5 ring-1 ring-rule">
                  <dt className="text-sm text-muted">{k}</dt>
                  <dd className="num mt-1 text-figure">{v}</dd>
                  <dd className="num mt-1 text-sm text-teal-ink">{s}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="mt-10 grid gap-8 lg:grid-cols-12">
            <figure className="lg:col-span-7">
              <figcaption className="text-sm text-muted">Holders over time (no background: the quiet field shows through)</figcaption>
              <svg viewBox="0 0 600 220" className="mt-3 h-auto w-full" role="img" aria-label="Demo chart">
                <path d="M0 200 C 120 180, 200 150, 300 120 S 480 70, 600 50 L600 160 C 480 170, 300 185, 0 210 Z" fill="var(--data-range)" />
                <path d="M0 205 C 150 190, 300 160, 600 110" fill="none" stroke="var(--data-median)" strokeWidth="2" strokeDasharray="5 5" />
                <path d="M0 210 C 100 190, 220 120, 330 100 S 500 60, 600 40" fill="none" stroke="var(--data-you)" strokeWidth="3.5" strokeLinecap="round" />
              </svg>
            </figure>
            <table className="num w-full text-left text-sm lg:col-span-5">
              <thead className="text-muted">
                <tr className="border-b border-ink">
                  <th className="py-2 font-semibold">Coin</th>
                  <th className="py-2 font-semibold">Age</th>
                  <th className="py-2 font-semibold">Standing</th>
                  <th className="py-2 text-right font-semibold">24h</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_ROWS.map(([c, a, s, d]) => (
                  <tr key={c} className="border-b border-rule">
                    <td className="py-2.5 font-semibold">{c}</td>
                    <td className="py-2.5">{a}</td>
                    <td className="py-2.5">{s}</td>
                    <td className={`py-2.5 text-right ${d.startsWith("+") ? "text-up" : "text-down"}`}>
                      {d.startsWith("+") ? "▲" : "▼"} {d}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-page space-y-section-sm px-gutter py-section-sm">
        <header>
          <p className="text-micro text-muted">Dev only</p>
          <h2 className="text-display">
            Yardstick <span className="pill pill-teal">design</span> tokens
          </h2>
          <p className="mt-4 max-w-measure text-lead text-muted">
            Defined once in <code className="addr text-ink">src/app/globals.css</code>. Switch theme with the header toggle; every pair below is contrast-checked in{" "}
            <code className="addr text-ink">tests/design-tokens.test.ts</code>.
          </p>
        </header>

        <section className="grid gap-8 lg:grid-cols-2">
          {SWATCHES.map(({ group, tokens }) => (
            <div key={group}>
              <h2 className="text-title">{group}</h2>
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {tokens.map(([t, label]) => (
                  <li key={t} className="overflow-hidden rounded-lg bg-surface ring-1 ring-rule">
                    <div className="h-16" style={{ background: `var(--${t})` }} />
                    <div className="p-3">
                      <p className="addr text-sm text-ink">--{t}</p>
                      <p className="text-micro text-muted">{label}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section>
          <h2 className="text-title">Type scale (Figtree)</h2>
          <div className="mt-4 divide-y divide-rule">
            {TYPE.map(([cls, name, sample]) => (
              <div key={cls} className="grid gap-2 py-4 md:grid-cols-[10rem_1fr] md:items-baseline">
                <p className="addr text-sm text-muted">{name}</p>
                <p className={cls}>{sample}</p>
              </div>
            ))}
            <div className="grid gap-2 py-4 md:grid-cols-[10rem_1fr] md:items-baseline">
              <p className="addr text-sm text-muted">figure-hero</p>
              <p className="num text-figure-hero">
                87<span className="text-figure">th</span>
              </p>
            </div>
            <div className="grid gap-2 py-4 md:grid-cols-[10rem_1fr] md:items-baseline">
              <p className="addr text-sm text-muted">figure + num</p>
              <div className="num text-figure">
                <p>1,111.11 SOL</p>
                <p>8,808.08 SOL</p>
              </div>
            </div>
            <div className="grid gap-2 py-4 md:grid-cols-[10rem_1fr] md:items-baseline">
              <p className="addr text-sm text-muted">addr (Plex Mono)</p>
              <p className="addr break-all">7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU</p>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-title">Pills, chips, buttons</h2>
          <p className="text-display">
            <span className="pill pill-teal">Launch</span> on pump.fun. <span className="pill pill-plain">See</span> where <span className="pill pill-yellow">you</span>{" "}
            <span className="pill pill-coral">stand</span>. <span className="pill pill-ink">Measure</span> <span className="pill pill-stone">Improve</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="chip">Solana mainnet · real SOL</span>
            <span className="chip">1h bucket</span>
            <span className="chip">Graduated</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary btn-lg">
              Launch a coin
            </button>
            <button type="button" className="btn btn-primary">
              Check a coin
            </button>
            <button type="button" className="btn btn-secondary">
              How it works
            </button>
            <button type="button" className="btn btn-primary" disabled>
              Disabled
            </button>
            <a href="#" className="self-center font-semibold text-teal-ink underline">
              A text link
            </a>
          </div>
          <label className="block max-w-narrow">
            <span className="text-sm font-semibold">Coin name</span>
            <input className="mt-1 block min-h-11 w-full rounded-md border border-rule-strong bg-surface px-4 text-base" placeholder="Input on surface" />
          </label>
        </section>

        <section className="space-y-6">
          <h2 className="text-title">Data</h2>
          <div className="rounded-lg bg-surface p-6 ring-1 ring-rule">
            <p className="text-sm text-muted">Holders, percentile among coins aged 1 hour</p>
            <div className="relative mt-6 h-8">
              <div className="absolute inset-y-2 left-[8%] right-[10%] rounded-pill bg-data-range" />
              <div className="absolute inset-y-2 left-[30%] right-[35%] rounded-pill bg-data-range-strong" />
              <div className="absolute inset-y-0 left-[48%] w-0.5 bg-data-median" title="median" />
              <div className="absolute inset-y-0 left-[72%] w-1.5 -translate-x-1/2 rounded-pill bg-data-you" title="your coin" />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-micro text-muted">
              <span className="inline-flex items-center gap-2">
                <i className="h-2.5 w-2.5 rounded-pill bg-data-you" /> Your coin
              </span>
              <span className="inline-flex items-center gap-2">
                <i className="h-2.5 w-0.5 bg-data-median" /> Median
              </span>
              <span className="inline-flex items-center gap-2">
                <i className="h-2.5 w-4 rounded-pill bg-data-range-strong" /> Middle half
              </span>
              <span className="inline-flex items-center gap-2">
                <i className="h-2.5 w-4 rounded-pill bg-data-range" /> Range
              </span>
            </div>
            <div className="num mt-6 flex gap-8 text-lg font-semibold">
              <span className="text-up">▲ +12.4%</span>
              <span className="text-down">▼ −8.1%</span>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-title">Cursor field glyphs (static sample)</h2>
          <div className="relative h-40 overflow-hidden rounded-lg bg-page ring-1 ring-rule">
            <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
              {Array.from({ length: 5 }, (_, r) =>
                Array.from({ length: 40 }, (_, c) => {
                  const k = (r * 7 + c * 13 + ((r * c) % 5)) % 11;
                  const x = c * 32 + 16;
                  const y = r * 32 + 16;
                  if (k < 4) return <circle key={`${r}-${c}`} cx={x} cy={y} r={7} fill="var(--field-dot)" />;
                  if (k < 7) return <rect key={`${r}-${c}`} x={x - 7} y={y - 7} width={14} height={14} fill="var(--field-square)" />;
                  if (k === 7) return <path key={`${r}-${c}`} d={`M${x - 7} ${y}h14M${x} ${y - 7}v14`} stroke="var(--field-plus)" strokeWidth={3} strokeLinecap="round" />;
                  return null;
                }),
              )}
            </svg>
            <p className="relative p-6 text-lead">
              Text over the field stays at full contrast. <span className="text-muted">Muted text too.</span>
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-title">Radii</h2>
          <div className="flex flex-wrap gap-4">
            {RADII.map((r) => (
              <div key={r} className={`grid h-20 w-28 place-items-center bg-sunk text-micro ${r}`}>
                {r}
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
