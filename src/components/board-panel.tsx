import { ArrowUpRight, Ruler } from "lucide-react";
import Link from "next/link";
import type { RankRow } from "@/lib/data/lists";
import { fmtInt, fmtPct } from "@/lib/format";
import { CoinImage } from "./coin-image";
import { CheckCoinButton } from "./command-search";
import { Countdown } from "./countdown";
import { EmptyRings } from "./visuals/empty-states";

const statLabel = "font-mono text-mono tracking-[0.12em] text-muted uppercase";

/**
 * "Today's board": the coin standing highest today (by standing against the pump.fun baseline), shown on a
 * stage of two rings with two stat chips, plus the time until the board resets at UTC midnight.
 * Curiosity only: no prizes, no rewards, no winner wording.
 *
 * States: a leader; coins launched today but none with a standing yet; nobody yet today; failed to load.
 * `basis: "holders"` is only for the dev-only landing preview, where no sampled coin has a standing yet.
 */
export function BoardPanel({
  leader,
  coinsToday,
  failed = false,
  basis = "standing",
  launchHref = "/launch",
}: {
  leader: RankRow | null;
  coinsToday: number;
  failed?: boolean;
  basis?: "standing" | "holders";
  launchHref?: string;
}) {
  const top = leader?.percentile != null ? Math.max(1, Math.round(100 - leader.percentile)) : null;
  const state = failed ? "failed" : leader ? "leader" : coinsToday > 0 ? "measuring" : "empty";

  const headline = {
    leader: leader && (
      <>
        {leader.name} <span className="font-mono text-[0.5em] tracking-normal text-muted">${leader.symbol}</span> {basis === "holders" ? "has the most holders today." : "stands highest today."}
      </>
    ),
    measuring: "Today's standings are still being measured.",
    empty: "Nobody's on the board yet today.",
    failed: "Today's board couldn't load.",
  }[state];

  const body = {
    leader:
      basis === "holders"
        ? "Preview with sampled pump.fun coins. None has enough comparison data for a standing yet, so this preview picks the coin with the most holders. The live board ranks Yardstick launches by standing."
        : "Coins launched through Yardstick today, ranked by their standing against pump.fun coins of the same age. It's here for curiosity: there are no prizes and nothing is rewarded.",
    measuring: `${fmtInt(coinsToday)} ${coinsToday === 1 ? "coin has" : "coins have"} launched through Yardstick today. A standing appears once enough pump.fun coins of the same age have been measured to compare against. Meanwhile, check where any coin stands.`,
    empty: "Launch the first coin of the day, or check where any pump.fun coin stands right now. The board ranks today's Yardstick launches by standing and resets at UTC midnight. There are no prizes and nothing is rewarded.",
    failed: "Something failed while reading today's coins. Refresh in a moment, or check a coin directly.",
  }[state];

  return (
    <div className="mx-auto grid max-w-page gap-16 lg:grid-cols-2 lg:items-center">
      <div className="relative mx-auto aspect-square w-full max-w-xl">
        {leader ? (
          <>
            <div className="absolute inset-[8%] rounded-full border border-dashed border-rule-strong" aria-hidden />
            <div className="absolute inset-[22%] rounded-full border border-rule" aria-hidden />
            <Link href={`/coin/${leader.mint}`} aria-label={`${leader.name} ($${leader.symbol})`} className="absolute top-1/2 left-1/2 block size-44 -translate-x-1/2 -translate-y-1/2 rotate-3 sm:size-56">
              <CoinImage src={leader.image} symbol={leader.symbol} size={224} className="size-full rounded-3xl text-6xl shadow-[0_20px_70px_var(--shadow)]" />
            </Link>
            <div className="absolute top-[22%] left-[2%] rounded-xl bg-card px-3 py-2 shadow-[0_12px_35px_var(--shadow)]">
              <p className="font-mono text-[0.5625rem] text-muted uppercase">Holders</p>
              <p className="num mt-1 text-small font-medium">{fmtInt(leader.holders)}</p>
            </div>
            <div className="absolute right-[3%] bottom-[15%] rounded-xl bg-accent px-3 py-2 text-on-accent shadow-[0_12px_35px_var(--shadow)]">
              <p className="font-mono text-[0.5625rem] uppercase">Bonding curve</p>
              <p className="num mt-1 text-small font-medium">{leader.graduated ? "Graduated" : fmtPct(leader.curveProgress)}</p>
            </div>
          </>
        ) : (
          <EmptyRings label={state === "failed" ? "Couldn't load" : state === "measuring" ? "Measuring" : "No coins yet today"} className="absolute inset-0" />
        )}
      </div>

      <div>
        <div className="mb-8 grid size-11 place-items-center rounded-full bg-accent text-on-accent" aria-hidden>
          <Ruler size={20} />
        </div>
        <p className="eyebrow">Today&apos;s board</p>
        <h2 className="mt-4 max-w-xl text-display">{headline}</h2>
        <p className="mt-6 max-w-lg text-lead text-muted">{body}</p>
        <dl className="mt-8 grid grid-cols-2 gap-8 border-y border-rule py-6">
          <div>
            {state === "leader" && basis === "standing" ? (
              <>
                <dt className={statLabel}>Standing</dt>
                <dd className="num mt-2 text-stat text-primary-ink">Top {top}%</dd>
              </>
            ) : state === "leader" ? (
              <>
                <dt className={statLabel}>Holders</dt>
                <dd className="num mt-2 text-stat text-primary-ink">{fmtInt(leader!.holders)}</dd>
              </>
            ) : (
              <>
                <dt className={statLabel}>Launched today</dt>
                <dd className="num mt-2 text-stat">{state === "failed" ? "–" : fmtInt(coinsToday)}</dd>
              </>
            )}
          </div>
          <div>
            <dt className={statLabel}>Board resets in</dt>
            <dd className="mt-2 text-stat">
              <Countdown />
            </dd>
          </div>
        </dl>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          {state === "empty" ? (
            <>
              <Link href={launchHref} className="btn btn-primary">
                Launch a coin <ArrowUpRight size={16} aria-hidden />
              </Link>
              <CheckCoinButton />
            </>
          ) : state === "failed" ? (
            <CheckCoinButton className="btn btn-primary" />
          ) : (
            <>
              <Link href="/today" className="btn btn-ghost -ml-3">
                See today&apos;s board <ArrowUpRight size={16} aria-hidden />
              </Link>
              {state === "measuring" && <CheckCoinButton className="btn btn-outline" />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
