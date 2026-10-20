import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { BoardPanel } from "@/components/board-panel";
import { CoinCard } from "@/components/coin-card";
import { CoinStrip } from "@/components/coin-strip";
import { CheckCoinButton, SearchPill } from "@/components/command-search";
import { Countdown } from "@/components/countdown";
import { LaunchPreviewCard } from "@/components/launch-preview-card";
import { SectionHead } from "@/components/page-head";
import { StepList } from "@/components/step-list";
import { db, hasDatabase } from "@/lib/db";
import { displayImage } from "@/lib/data/coins";
import { leaderboard, type CoinChip, type RankRow } from "@/lib/data/lists";
import { fmtSol } from "@/lib/format";

// Dev-only style guide: every design token and component in one place. 404 in production.
// Component demos use real coins from the database (never made-up ones); without a database they show their empty states.
export const metadata: Metadata = { title: "Design system", robots: { index: false } };

const USES: Record<string, string> = {
  paper: "Page background",
  card: "Cards, form, floating coin cards, popovers",
  tint: "Quiet panels: pills, preview panel, footer band, skeletons",
  "tint-strong": "Hover fill of pills and ghost buttons",
  ink: "Text and headlines",
  muted: "Secondary text (ink-blue, never grey)",
  rule: "Card borders and section rules",
  "rule-strong": "Input borders, rings: boundaries that must read (3:1)",
  primary: "Primary button fill",
  "primary-hover": "Primary button hover",
  "on-primary": "Text on primary",
  "primary-ink": "Primary as text: standing number, links, your coin",
  accent: "Second accent: tags, badges, chips. Fill only",
  "on-accent": "Text on the accent",
  panel: "Ink panels and full-bleed ink sections",
  "panel-edge": "Border of ink panels (visible in dark)",
  "on-panel": "Text on ink panels",
  "panel-muted": "Secondary text on ink panels",
  "panel-accent": "Primary on ink panels",
  focus: "Focus ring",
  "data-you": "This coin: bar, marker, chart line",
  "data-median": "Median notch and line",
  "data-range": "Comparison track",
  "data-range-strong": "Middle half of the group",
  up: "Rises, always with ▲ and +",
  down: "Falls and errors, always with ▼ and −",
};

/** Reads both themes' colour tokens from globals.css, so this page can't drift from the CSS. */
function themes() {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  const parse = (body = "") => Object.fromEntries([...body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map(([, k, v]) => [k, v]));
  return { light: parse(css.match(/^:root \{([^}]*)\}/m)?.[1]), dark: parse(css.match(/^:root\[data-theme="dark"\] \{([^}]*)\}/m)?.[1]) };
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const TYPE: [string, string, string][] = [
  ["text-hero", "48 → 96px · 0.96 · −6% · 500", "Same yardstick."],
  ["text-cta", "48 → 72px · 1.0 · −6% · 500", "Where does it stand?"],
  ["text-display", "36 → 60px · 1.0 · −5% · 500", "Today's top coins."],
  ["text-title", "24px · 32px · −2.5% · 500", "Make your coin"],
  ["text-stat num", "30px · 36px · −2.5% · 500 · tabular", "Top 12%"],
  ["text-lead", "14 → 16px · 24px", "Free. No fees. Your coin lives on pump.fun."],
  ["text-small", "14px · 24px", "Each reading is ranked against coins of exactly the same age."],
  ["text-label", "12px · 16px", "Nav links, captions under figures"],
  ["eyebrow", "10px Geist Mono · +16% · uppercase", "What we measure"],
];

const MOTION: [string, string, string][] = [
  ["--ease-standard", "cubic-bezier(.4, 0, .2, 1)", "Every transition"],
  ["--dur-fast", "150ms", "Hovers: colour, fill, opacity (nav links fade to 50%)"],
  ["--dur-zoom", "500ms", "Coin-card image zooms to 1.03 on hover and focus"],
  ["--dur-float", "7s", "One bob of a floating hero card (ease-in-out, infinite)"],
  ["--float-distance", "−14px", "How far a floating card rises"],
  ["--float-stagger", "−1.3s", "Phase offset between floating cards"],
  ["scroll-behavior", "smooth", "Anchor links; instant under reduced motion"],
];

export default async function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  await connection();
  const t = themes();

  let coins: CoinChip[] = [];
  let rows: RankRow[] = [];
  if (hasDatabase()) {
    const found = await db()
      .coin.findMany({ where: { imageUrl: { not: null } }, select: { mint: true, name: true, symbol: true, imageUrl: true }, orderBy: { createdAt: "desc" }, take: 12 })
      .catch(() => []);
    coins = found.map((c) => ({ mint: c.mint, name: c.name, symbol: c.symbol, image: displayImage(c.imageUrl) })).filter((c) => c.image).slice(0, 6);
    rows = await leaderboard({ range: "7d", graduatedOnly: false, group: "baseline" }).catch(() => []);
  }

  return (
    <div className="mx-auto max-w-page px-gutter pt-[calc(var(--header-h)+2.5rem)]">
      <SectionHead
        as="h1"
        eyebrow="Development only"
        title="Design system (v3)."
        note="Every token and component. Colours are read from globals.css. Demos use real coins from the database; without one they show their empty states."
      />

      <section className="mt-24" aria-labelledby="colour-h">
        <h2 id="colour-h" className="eyebrow">
          Colour · no neutral greys
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {(["light", "dark"] as const).map((name) => {
            const pal = t[name];
            return (
              <div key={name} className="rounded-card p-6" style={{ background: pal.paper, color: pal.ink, boxShadow: `inset 0 0 0 1px ${pal.rule}` }}>
                <p className="font-mono text-mono tracking-[0.16em] uppercase" style={{ color: pal.muted }}>
                  {name}
                </p>
                <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {Object.entries(pal).map(([k, hex]) => (
                    <li key={k}>
                      <span className="block h-12 rounded-xl" style={{ background: hex, boxShadow: `inset 0 0 0 1px ${pal.rule}` }} />
                      <span className="mt-1.5 block text-label font-medium">--{k}</span>
                      <span className="block font-mono text-mono" style={{ color: pal.muted }}>
                        {hex} · {contrast(hex, pal.paper).toFixed(1)}:1
                      </span>
                      <span className="block text-label" style={{ color: pal.muted }}>
                        {USES[k] ?? ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-24" aria-labelledby="type-h">
        <h2 id="type-h" className="eyebrow">
          Type · Geist 400/500/600 and Geist Mono 400 (SIL OFL 1.1)
        </h2>
        <ul className="mt-4 border-t border-rule">
          {TYPE.map(([cls, spec, sample]) => (
            <li key={cls} className="grid gap-2 border-b border-rule py-5 md:grid-cols-[14rem_1fr] md:items-baseline">
              <span className="font-mono text-mono text-muted">
                {cls}
                <br />
                {spec}
              </span>
              <span className={cls}>{sample}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-24" aria-labelledby="controls-h">
        <h2 id="controls-h" className="eyebrow">
          Controls
        </h2>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary">
            Primary
          </button>
          <button type="button" className="btn btn-ghost">
            Ghost
          </button>
          <button type="button" className="btn btn-outline">
            Outline
          </button>
          <button type="button" className="btn btn-primary" disabled>
            Disabled
          </button>
          <button type="button" className="btn btn-primary btn-sm">
            Small
          </button>
          <CheckCoinButton className="btn btn-outline btn-lg" />
          <span className="tag tag-outline">Outline tag</span>
          <span className="tag tag-tint">Tint tag</span>
          <span className="tag tag-accent">Accent tag</span>
          <span className="tag tag-primary">Primary tag</span>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div>
            <label htmlFor="demo-field" className="label">
              Field
            </label>
            <input id="demo-field" className="field" placeholder="Placeholder" />
            <p className="help">Help text under a field.</p>
          </div>
          <div>
            <span className="label" id="demo-seg">
              Segmented control
            </span>
            <div role="radiogroup" aria-labelledby="demo-seg" className="seg">
              <button type="button" role="radio" aria-checked="true">
                pump.fun baseline
              </button>
              <button type="button" role="radio" aria-checked="false">
                Yardstick launches
              </button>
            </div>
          </div>
          <div>
            <span className="label">Search pill (⌘K)</span>
            <SearchPill className="w-64" />
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <div className="skeleton h-16 w-40" />
          <div className="skeleton h-16 w-64" />
        </div>
      </section>

      <section className="mt-24" aria-labelledby="cards-h">
        <h2 id="cards-h" className="eyebrow">
          Surfaces
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="card p-6">
            <p className="text-title">.card</p>
            <p className="mt-2 text-small text-muted">White, 1px tinted border, 24px corners.</p>
          </div>
          <div className="rounded-card bg-tint p-6">
            <p className="text-title">bg-tint</p>
            <p className="mt-2 text-small text-muted">Quiet panel: launch preview, footer band.</p>
          </div>
          <div className="panel p-6">
            <p className="text-title">.panel</p>
            <p className="mt-2 text-small text-panel-muted">Ink panel for strong moments.</p>
          </div>
        </div>
      </section>

      <section className="mt-24" aria-labelledby="steps-h">
        <h2 id="steps-h" className="eyebrow">
          StepList
        </h2>
        <StepList
          className="mt-4"
          steps={[
            { label: "Launch", text: "One sentence per step." },
            { label: "Measure", text: "Mono number and label above." },
            { label: "Compare", text: "Four columns on wide screens." },
            { label: "Improve", text: "One column on phones." },
          ]}
        />
      </section>

      <section className="mt-24" aria-labelledby="preview-h">
        <h2 id="preview-h" className="eyebrow">
          LaunchPreviewCard (empty)
        </h2>
        <div className="mt-4 rounded-card bg-tint p-10">
          <LaunchPreviewCard image={null} name="" symbol="" description="" />
        </div>
      </section>

      <section className="mt-24" aria-labelledby="strip-h">
        <h2 id="strip-h" className="eyebrow">
          CoinStrip · {coins.length} real tracked coins (any source; on the landing page only Yardstick launches)
        </h2>
        <div className="relative mt-4 h-[36rem] overflow-hidden rounded-card bg-paper shadow-[inset_0_0_0_1px_var(--rule)]">
          <CoinStrip coins={coins} />
          {coins.length === 0 && <p className="p-6 text-small text-muted">No coins with images in the database: the hero shows without cards.</p>}
        </div>
      </section>

      <section className="mt-24 rounded-card bg-panel p-6 text-on-panel sm:p-10" aria-labelledby="coincard-h">
        <h2 id="coincard-h" className="eyebrow text-panel-muted">
          CoinCard · Yardstick launches, last 7 days
        </h2>
        {rows.length === 0 ? (
          <>
            <p className="mt-4 text-small text-panel-muted">No Yardstick launches in the last 7 days. Below: the same card with the real tracked coins from the strip (no standing).</p>
            <ol className="mt-6 grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 lg:grid-cols-6">
              {coins.map((c, i) => (
                <li key={c.mint}>
                  <CoinCard onPanel href={`/coin/${c.mint}`} rank={i + 1} image={c.image} name={c.name} symbol={c.symbol} />
                </li>
              ))}
            </ol>
          </>
        ) : (
          <ol className="mt-6 grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 lg:grid-cols-6">
            {rows.slice(0, 6).map((r, i) => (
              <li key={r.mint}>
                <CoinCard onPanel href={`/coin/${r.mint}`} rank={i + 1} image={r.image} name={r.name} symbol={r.symbol} sub={r.bucket ?? "–"} figure={r.mcapSol !== null ? `${fmtSol(r.mcapSol)} SOL` : undefined} standing={r.percentile} />
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-24" aria-labelledby="board-h">
        <h2 id="board-h" className="eyebrow mb-8">
          BoardPanel · best standing in the last 7 days · Countdown <Countdown />
        </h2>
        <BoardPanel leader={rows.find((r) => r.percentile !== null) ?? null} coinsToday={rows.length} />
      </section>

      <section className="mt-24 mb-24" aria-labelledby="motion-h">
        <h2 id="motion-h" className="eyebrow">
          Motion · there are no scroll reveals and no page-load animation
        </h2>
        <table className="mt-4 w-full text-left text-small">
          <tbody>
            {MOTION.map(([k, v, use]) => (
              <tr key={k} className="border-b border-rule">
                <td className="py-3 font-mono text-mono">{k}</td>
                <td className="num py-3">{v}</td>
                <td className="py-3 text-muted">{use}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
