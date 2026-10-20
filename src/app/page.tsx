import { ArrowDown, ArrowUpRight, FlaskConical } from "lucide-react";
import Link from "next/link";
import { after, connection } from "next/server";
import { BoardPanel } from "@/components/board-panel";
import { CoinCard } from "@/components/coin-card";
import { CoinRow, CoinStrip } from "@/components/coin-strip";
import { CheckCoinButton } from "@/components/command-search";
import { SectionHead } from "@/components/page-head";
import { StepList } from "@/components/step-list";
import { hasDatabase } from "@/lib/db";
import { leaderboard, recentLaunches, type CoinChip, type RankRow } from "@/lib/data/lists";
import { fmtAge, fmtSol } from "@/lib/format";
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

export default async function Home({ searchParams }: PageProps<"/">) {
  await connection();
  // Dev-only: /?preview=baseline fills the page with sampled pump.fun coins (never in production; see src/lib/preview.ts).
  const preview = landingPreviewEnabled(process.env.NODE_ENV, (await searchParams).preview);
  const source = preview ? "baseline" : "yardstick";
  let recent: CoinChip[] = [];
  let rows: RankRow[] | null = [];
  if (hasDatabase()) {
    [recent, rows] = await Promise.all([recentLaunches(6, source).catch(() => []), leaderboard({ range: "today", graduatedOnly: false, group: "baseline", source }).catch(() => null)]);
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

      {/* Hero, with recent launches floating around it */}
      <section className="relative flex min-h-svh overflow-hidden px-gutter pt-header">
        <CoinStrip coins={recent} />
        <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center justify-center gap-6 pb-24 text-center">
          <h1 className="text-hero">
            Launch a coin.
            <br />
            See where it stands.
          </h1>
          <p className="max-w-md text-lead text-muted">Free. No fees. Your coin lives on pump.fun, and Yardstick shows how it compares with every coin of the same age.</p>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <a href="#launch" className="btn btn-primary">
              Launch a coin <ArrowUpRight size={16} aria-hidden />
            </a>
            <CheckCoinButton />
          </div>
          <div className="mt-6 w-full">
            <CoinRow coins={recent} />
          </div>
        </div>
        <a href="#how" className="eyebrow absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 transition-opacity duration-(--dur-fast) hover:opacity-50">
          How it works <ArrowDown size={12} aria-hidden />
        </a>
      </section>

      {/* Statement and the four steps */}
      <section id="how" aria-labelledby="how-h" className="flex min-h-svh items-center px-gutter py-section">
        <div className="mx-auto w-full max-w-text">
          <p className="eyebrow">How it works</p>
          <h2 id="how-h" className="mt-6 text-hero">
            Same age.
            <br />
            Same yardstick.
          </h2>
          <StepList steps={STEPS} className="mt-16" />
        </div>
      </section>

      {/* The real launch form with its live preview */}
      <section id="launch" aria-labelledby="launch-h" className="px-gutter py-section">
        <div className="mx-auto max-w-text">
          <SectionHead
            id="launch-h"
            title="From idea to a live coin."
            note="You pay only Solana's network fee and pump.fun's creation cost. The coin's key is made in this browser and never leaves it."
          />
          <div className="mt-12 md:mt-16">
            <LaunchForm />
          </div>
        </div>
      </section>

      {/* What we measure: the ink panel */}
      <section id="measure" aria-labelledby="measure-h" className="px-gutter py-section">
        <div className="panel mx-auto flex max-w-text flex-col items-start gap-8 p-8 sm:p-14">
          <p className="eyebrow text-panel-muted">What we measure</p>
          <h2 id="measure-h" className="max-w-4xl text-display">
            Every reading, compared with coins exactly as old as yours.
          </h2>
          <p className="max-w-2xl text-small text-panel-muted">Volume is left out on purpose: wash trading makes it cheap to fake, so it can&apos;t push a coin up the board.</p>
          <StepList steps={MEASURES} onPanel className="w-full" />
          <Link href="/how" className="btn btn-on-panel">
            See how it&apos;s measured
          </Link>
        </div>
      </section>

      {/* Today's top coins: full-bleed ink section */}
      <section id="today" aria-labelledby="today-h" className="bg-panel px-gutter py-section text-on-panel">
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
            <div className="mt-12 flex flex-col items-start gap-6 rounded-card p-8 shadow-[inset_0_0_0_1px_var(--rule-strong)] sm:flex-row sm:items-center sm:justify-between">
              <p className="text-title">Today&apos;s coins couldn&apos;t load. Refresh to try again.</p>
              <CheckCoinButton className="btn btn-on-panel" />
            </div>
          ) : top.length === 0 ? (
            <EmptyTopCoins />
          ) : (
            <ol className="mt-12 grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 lg:grid-cols-6">
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

      {/* Today's board */}
      <section id="board" aria-label="Today's board" className="px-gutter py-section">
        <BoardPanel leader={leader} coinsToday={rows?.length ?? 0} failed={rows === null} basis={preview && !ranked ? "holders" : "standing"} launchHref="#launch" />
      </section>
    </>
  );
}

/** Day one: six open slots (no stand-in coins) and the two ways in. */
function EmptyTopCoins() {
  return (
    <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center lg:gap-14">
      <ol aria-hidden className="grid grid-cols-3 gap-3 md:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className={`relative aspect-square rounded-2xl border border-dashed border-panel-muted/35 ${i >= 3 ? "max-md:hidden lg:max-xl:hidden" : ""}`}>
            <span className="num absolute top-2 left-2 rounded-pill px-2 py-1 font-mono text-mono text-panel-muted shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--panel-muted)_35%,transparent)]">
              {String(i + 1).padStart(2, "0")}
            </span>
          </li>
        ))}
      </ol>
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
