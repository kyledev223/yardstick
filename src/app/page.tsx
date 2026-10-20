import { ArrowUpRight, FlaskConical } from "lucide-react";
import Link from "next/link";
import { after, connection } from "next/server";
import { BoardPanel } from "@/components/board-panel";
import { CoinCard } from "@/components/coin-card";
import { CoinRow, CoinStrip } from "@/components/coin-strip";
import { CheckCoinButton } from "@/components/command-search";
import { LiveStrip } from "@/components/live-strip";
import { SectionHead } from "@/components/page-head";
import { StepList } from "@/components/step-list";
import { MeasureGlyphs, PercentileDiagram, SameAgeDiagram } from "@/components/visuals/diagrams";
import { EmptyPodium } from "@/components/visuals/empty-states";
import { HeroScale } from "@/components/visuals/hero-scale";
import { DATA } from "@/lib/config";
import { hasDatabase } from "@/lib/db";
import { baselineWeek, leaderboard, livePumpCoins, recentLaunches, type BaselineWeek, type CoinChip, type LiveCoin, type RankRow } from "@/lib/data/lists";
import { fmtAge, fmtInt, fmtSol } from "@/lib/format";
import { maybeTick } from "@/lib/jobs/tick";
import { landingPreviewEnabled } from "@/lib/preview";
import { LaunchForm } from "./launch/launch-form";

const STEPS = [
  { label: "Launch", text: "A name, a symbol and an image, then one transaction from your own wallet creates the coin on pump.fun." },
  { label: "Measure", text: "From five minutes old, Yardstick reads holders, buyers, net SOL in, the curve and warning signs at fixed ages." },
  { label: "Compare", text: "Each reading is ranked against pump.fun coins and Yardstick launches of exactly the same age." },
  { label: "Improve", text: "Plain notes point at the metrics where your coin trails coins that went on to graduate." },
];

const MEASURES = [
  { label: "Holders and distribution", text: "Holders, unique buyers, and how much of the supply the top 10 wallets hold." },
  { label: "Buying and selling", text: "Buys against sells, by count and by SOL, and the net SOL that has come in." },
  { label: "Bonding curve", text: "How full the pump.fun curve is, and whether the coin has graduated." },
  { label: "Warning signs", text: "Sniper share, fresh wallets, and whether the creator has sold." },
];

/*
 * Colour order (docs/yardstick-visual-polish-prompt.md), dark / light:
 * hero + pump.fun strip: ink / light · how it works: ultramarine band · what we measure: deep ink / tint ·
 * launch form: light · today's top coins: ink · coral band · today's board: deep ink / light · footer: tint.
 */
export default async function Home({ searchParams }: PageProps<"/">) {
  await connection();
  // Dev-only: /?preview=baseline fills the page with sampled pump.fun coins (never in production; see src/lib/preview.ts).
  const preview = landingPreviewEnabled(process.env.NODE_ENV, (await searchParams).preview);
  const source = preview ? "baseline" : "yardstick";
  let recent: CoinChip[] = [];
  let rows: RankRow[] | null = [];
  let live: LiveCoin[] = [];
  let week: BaselineWeek | null = null;
  if (hasDatabase()) {
    [recent, rows, live, week] = await Promise.all([
      recentLaunches(6, source).catch(() => []),
      leaderboard({ range: "today", graduatedOnly: false, group: "baseline", source }).catch(() => null),
      livePumpCoins().catch(() => []),
      baselineWeek().catch(() => null),
    ]);
  }
  // Busy page: keep background measuring going if the cron job is late.
  after(() => maybeTick("landing"));
  const top = rows?.slice(0, 6) ?? [];
  const ranked = rows?.find((r) => r.percentile !== null) ?? null;
  // The preview has no standings to rank by yet, so it shows the coin with the most holders and says so.
  const leader = ranked ?? (preview ? (rows?.[0] ?? null) : null);

  return (
    <>
      {preview && (
        <p role="status" className="tag tag-accent fixed bottom-4 left-1/2 z-40 -translate-x-1/2 px-3 py-1.5 shadow-[0_12px_35px_var(--shadow)]">
          <FlaskConical size={12} aria-hidden /> Dev preview<span className="sm:hidden">: sampled coins</span>
          <span className="hidden sm:inline">: sampled pump.fun coins, not Yardstick launches</span>
        </p>
      )}

      {/* Hero: the scale behind the headline, recent launches floating around it, then the pump.fun strip */}
      <section className="relative isolate overflow-hidden">
        <div className="grain" aria-hidden />
        <div className="relative pt-[calc(var(--header-h)+2.5rem)] sm:pt-[calc(var(--header-h)+4rem)]">
          <div className="glow-primary inset-x-[6%] -bottom-1/3 h-3/4" aria-hidden />
          <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-gutter text-center">
            <h1 className="text-hero">
              Launch a coin.
              <br />
              See where it <span className="accent-mark">stands</span>.
            </h1>
            <p className="max-w-md text-lead text-muted">Free. No fees. Your coin lives on pump.fun, and Yardstick shows how it compares with every coin of the same age.</p>
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <a href="#launch" className="btn btn-primary">
                Launch a coin <ArrowUpRight size={16} aria-hidden />
              </a>
              <CheckCoinButton />
            </div>
            <div className="mt-2 w-full">
              <CoinRow coins={recent} />
            </div>
          </div>
          {/* Room for the scale under the buttons; its tallest bars rise a little behind them. */}
          <div className="relative -mt-10 h-48 sm:-mt-16 sm:h-72">
            <HeroScale className="fade-x absolute inset-0 size-full" />
          </div>
          {/* Floating recent launches (md and up); the wrapper lets clicks through to the buttons. */}
          <div className="pointer-events-none absolute inset-0 z-[5]">
            <CoinStrip coins={recent} />
          </div>
        </div>
        <LiveStrip coins={live} />
      </section>

      {/* How it works: the ultramarine band, with the two method diagrams */}
      <section id="how" aria-labelledby="how-h" className="relative isolate overflow-hidden bg-band px-gutter py-section text-on-band">
        <div className="grain" aria-hidden />
        <div className="mx-auto w-full max-w-text">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow text-on-band-muted">How it works</p>
              <h2 id="how-h" className="mt-6 text-hero">
                Same age.
                <br />
                Same <span className="accent-mark">yardstick</span>.
              </h2>
            </div>
            <WeekStats week={week} />
          </div>
          <div className="mt-12 grid gap-4 lg:grid-cols-2">
            <figure className="surface-light rounded-card bg-card p-6 shadow-[0_20px_60px_rgb(3_5_26/0.35)] sm:p-8">
              <figcaption className="eyebrow mb-6">Illustration · same-age comparison</figcaption>
              <SameAgeDiagram />
            </figure>
            <figure className="surface-light rounded-card bg-card p-6 shadow-[0_20px_60px_rgb(3_5_26/0.35)] sm:p-8">
              <figcaption className="eyebrow mb-6">Illustration · standing</figcaption>
              <PercentileDiagram />
            </figure>
          </div>
          <StepList steps={STEPS} onBand className="mt-12" />
        </div>
      </section>

      {/* What we measure: deep ink (tint in light) with a ruler along the top */}
      <section id="measure" aria-labelledby="measure-h" className="relative isolate overflow-hidden bg-section-quiet px-gutter py-section">
        <div className="ruler-ticks" aria-hidden />
        <div className="glow-primary -top-1/4 -right-[12%] h-[85%] w-3/5" aria-hidden />
        <div className="glow-coral -bottom-1/4 -left-[8%] h-1/2 w-1/3" aria-hidden />
        <div className="grain" aria-hidden />
        <div className="mx-auto flex max-w-text flex-col items-start gap-8">
          <p className="eyebrow">What we measure</p>
          <h2 id="measure-h" className="max-w-4xl text-display">
            Every reading, compared with coins <span className="accent-mark">exactly as old</span> as yours.
          </h2>
          <p className="max-w-2xl text-small text-muted">Volume is left out on purpose: wash trading makes it cheap to fake, so it can&apos;t push a coin up the board.</p>
          <MeasureGlyphs measures={MEASURES} className="w-full" />
          <Link href="/how" className="btn btn-outline btn-lg">
            See how it&apos;s measured
          </Link>
        </div>
      </section>

      {/* The real launch form with its live preview, on a light section in both themes */}
      <section id="launch" aria-labelledby="launch-h" className="surface-light px-gutter py-section">
        <div className="mx-auto max-w-text">
          <SectionHead
            id="launch-h"
            title="From idea to a live coin."
            note="You pay only Solana's network fee and pump.fun's creation cost. The coin's key is made in this browser and never leaves it."
          />
          <div className="mt-10 md:mt-12">
            <LaunchForm />
          </div>
        </div>
      </section>

      {/* Today's top coins: the full-bleed ink section */}
      <section id="today" aria-labelledby="today-h" className="relative isolate overflow-hidden bg-section-ink px-gutter py-section text-on-panel">
        <div className="grain" aria-hidden />
        <div className="mx-auto max-w-page">
          <SectionHead
            onPanel
            id="today-h"
            eyebrow={preview ? "Preview · sampled pump.fun coins today" : "Launched on Yardstick today"}
            title="Today's top coins."
            action={
              <Link href="/today" className="inline-flex shrink-0 items-center gap-2 text-small font-medium transition-opacity duration-(--dur-fast) hover:opacity-60">
                See the full table <ArrowUpRight size={16} aria-hidden />
              </Link>
            }
          />
          {rows === null ? (
            <div className="mt-10 flex flex-col items-start gap-6 rounded-card p-8 shadow-[inset_0_0_0_1px_var(--rule-strong)] sm:flex-row sm:items-center sm:justify-between">
              <p className="text-title">Today&apos;s coins couldn&apos;t load. Refresh to try again.</p>
              <CheckCoinButton className="btn btn-on-panel" />
            </div>
          ) : top.length === 0 ? (
            <EmptyTopCoins />
          ) : (
            <ol className="mt-10 grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 lg:grid-cols-6">
              {top.map((r, i) => (
                <li key={r.mint}>
                  <CoinCard
                    onPanel
                    href={`/coin/${r.mint}`}
                    rank={i + 1}
                    image={r.image}
                    name={r.name}
                    symbol={r.symbol}
                    sub={`${fmtAge(r.ageSeconds)} old`}
                    figure={r.mcapSol !== null ? `${fmtSol(r.mcapSol)} SOL` : undefined}
                    standing={r.percentile}
                  />
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {/* Coral band */}
      <div className="bg-accent px-gutter py-3 text-on-accent">
        <p className="mx-auto flex max-w-page flex-wrap justify-center gap-x-5 gap-y-1 font-mono text-mono tracking-[0.16em] uppercase">
          <span>Ranked by standing, not volume</span>
          <span aria-hidden>·</span>
          <span>No prizes</span>
          <span aria-hidden>·</span>
          <span>Resets at UTC midnight</span>
        </p>
      </div>

      {/* Today's board: deep ink (page colour in light) */}
      <section id="board" aria-label="Today's board" className="relative isolate overflow-hidden bg-section-deep px-gutter py-section">
        <div className="grain" aria-hidden />
        <BoardPanel leader={leader} coinsToday={rows?.length ?? 0} failed={rows === null} basis={preview && !ranked ? "holders" : "standing"} launchHref="#launch" />
      </section>
    </>
  );
}

/** The pump.fun baseline at a glance: real figures, each hidden while its sample is under the minimum. */
function WeekStats({ week }: { week: BaselineWeek | null }) {
  if (!week) return null;
  const min = DATA.minSampleForPercentile;
  const stats = [
    week.tracked >= min && { label: "pump.fun coins tracked", value: fmtInt(week.tracked) },
    week.tracked >= min && { label: "Graduated", value: fmtInt(week.graduated) },
    week.medianHolders1h !== null && week.holders1hSample >= min && { label: "Median holders at 1h", value: fmtInt(week.medianHolders1h) },
  ].filter((s): s is { label: string; value: string } => Boolean(s));
  if (stats.length === 0) return null;
  return (
    <div className="shrink-0">
      <p className="font-mono text-mono tracking-[0.16em] text-on-band-muted uppercase">pump.fun · last 7 days · what coins are compared with</p>
      <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-4 border-t border-on-band/30 pt-4">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-label text-on-band-muted">{s.label}</dt>
            <dd className="num mt-1 text-stat">{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Day one: a podium waiting for its first coin (no stand-in coins), the message and the two ways in. */
function EmptyTopCoins() {
  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center lg:gap-14">
      <EmptyPodium className="w-full max-w-xl" />
      <div className="flex flex-col items-start gap-5">
        <p className="text-title">No launches yet today.</p>
        <p className="text-small text-panel-muted">The first coin launched through Yardstick today takes the 01 spot. Coins are ranked by standing against pump.fun coins of the same age, and the list starts fresh at UTC midnight.</p>
        <div className="flex flex-wrap gap-3">
          <a href="#launch" className="btn btn-on-panel">
            Launch a coin <ArrowUpRight size={16} aria-hidden />
          </a>
          <CheckCoinButton className="btn btn-panel-ghost" />
        </div>
      </div>
    </div>
  );
}
