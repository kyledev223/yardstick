"use client";
import { Pause, Play } from "lucide-react";
import Link from "next/link";
import { useState, type CSSProperties } from "react";
import type { LiveCoin } from "@/lib/data/lists";
import { fmtAge } from "@/lib/format";

/** Fewer than this and the strip doesn't show: a handful of coins would look like a pick, not a sample. */
export const LIVE_STRIP_MIN = 8;

function Chip({ coin, copy = false }: { coin: LiveCoin; copy?: boolean }) {
  return (
    <li className="shrink-0 pr-2">
      {/* The accessible name is the visible text plus "old": "$PANDA 17h 51m old". */}
      <Link href={`/coin/${coin.mint}`} tabIndex={copy ? -1 : undefined} className="tag tag-outline gap-2 py-1.5 transition-colors duration-(--dur-fast) hover:bg-tint">
        <span className="max-w-[10ch] truncate text-ink">${coin.symbol}</span>{" "}
        <span className="num text-muted">
          {fmtAge(coin.ageSeconds)}
          <span className="sr-only"> old</span>
        </span>
      </Link>
    </li>
  );
}

/**
 * "Live on pump.fun": recently sampled real pump.fun coins (symbol and age only, no images), sliding slowly, each
 * linking to its dashboard. Labelled as pump.fun coins, not Yardstick launches and not recommendations. The data
 * (livePumpCoins) leaves out flagged, banned-word and hidden coins. Hidden when there are too few.
 */
export function LiveStrip({ coins }: { coins: LiveCoin[] }) {
  const [paused, setPaused] = useState(false);
  if (coins.length < LIVE_STRIP_MIN) return null;
  return (
    <section aria-labelledby="live-h" className="relative border-t border-rule">
      <div className="mx-auto flex max-w-page flex-col gap-3 px-gutter py-4 md:flex-row md:items-center md:gap-6">
        <div className="flex shrink-0 items-center justify-between gap-3 md:block">
          <h2 id="live-h" className="tag tag-accent">
            <span className="size-1.5 rounded-pill bg-on-accent" aria-hidden /> Live on pump.fun
          </h2>
          <p className="mt-1.5 max-w-[16rem] text-label text-muted max-md:hidden">Random pump.fun coins we sampled. Not Yardstick launches, not recommendations.</p>
          <p className="text-label text-muted md:hidden">Not Yardstick launches, not picks</p>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {/* isolate: the moving track gets its own stacking context, so it never paints over the pause button. */}
          <div className="marquee relative isolate min-w-0 flex-1" data-paused={paused} style={{ "--marquee-dur": `${coins.length * 3.5}s` } as CSSProperties}>
            <div className="marquee-track">
              <ul className="flex">
                {coins.map((c) => (
                  <Chip key={c.mint} coin={c} />
                ))}
              </ul>
              <ul className="marquee-copy flex" aria-hidden>
                {coins.map((c) => (
                  <Chip key={c.mint} coin={c} copy />
                ))}
              </ul>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPaused(!paused)}
            aria-pressed={paused}
            aria-label={paused ? "Play the pump.fun strip" : "Pause the pump.fun strip"}
            className="btn btn-ghost btn-sm relative z-10 size-8 shrink-0 p-0 motion-reduce:hidden"
          >
            {paused ? <Play size={14} aria-hidden /> : <Pause size={14} aria-hidden />}
          </button>
        </div>
      </div>
    </section>
  );
}
