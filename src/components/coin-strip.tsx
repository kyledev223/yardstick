import Link from "next/link";
import type { CSSProperties } from "react";
import type { CoinChip } from "@/lib/data/lists";
import { CoinImage } from "./coin-image";

type Slot = { left?: string; right?: string; top?: string; bottom?: string; tilt: number };

// Balanced arrangements around the hero headline for 1–6 cards: pairs mirror left/right, odd counts add a centred card.
const TL: Slot = { left: "6%", top: "19%", tilt: -6 };
const TR: Slot = { right: "7%", top: "16%", tilt: 5 };
const BL: Slot = { left: "15%", bottom: "16%", tilt: 3 };
const BR: Slot = { right: "15%", bottom: "13%", tilt: -4 };
const TC: Slot = { left: "calc(50% - 4rem)", top: "12%", tilt: 2 };
const BC: Slot = { left: "calc(50% + 6rem)", bottom: "6%", tilt: -2 };
const LAYOUTS: Slot[][] = [[], [TC], [TL, TR], [TL, TR, { ...BC, left: "calc(50% - 4rem)" }], [TL, TR, BL, BR], [TL, TR, BL, BR, TC], [TL, TR, BL, BR, TC, BC]];

/** A small white "print" of a coin: image, name and $SYMBOL in mono. */
function Print({ coin, className = "", style }: { coin: CoinChip; className?: string; style?: CSSProperties }) {
  return (
    <Link
      href={`/coin/${coin.mint}`}
      aria-label={`${coin.name} ($${coin.symbol})`}
      style={style}
      className={`block rounded-xl bg-card p-1.5 shadow-[0_16px_45px_var(--shadow)] ${className}`}
    >
      <CoinImage src={coin.image} symbol={coin.symbol} size={128} eager hideOnError className="aspect-square w-full rounded-lg" />
      <span className="flex items-center justify-between gap-2 px-1 pt-2 pb-1 font-mono text-[0.5625rem] leading-[0.85rem]">
        <span className="truncate">{coin.name}</span>
        <span className="shrink-0 text-muted">${coin.symbol}</span>
      </span>
    </Link>
  );
}

/**
 * "Recently launched on Yardstick": real recent coins floating around the hero (md and up, bobbing slowly),
 * and a scrolling row under the buttons on phones. Renders nothing without coins.
 */
export function CoinStrip({ coins }: { coins: CoinChip[] }) {
  const shown = coins.slice(0, 6);
  if (shown.length === 0) return null;
  const slots = LAYOUTS[shown.length];
  return (
    <nav aria-label="Recently launched on Yardstick" className="pointer-events-none absolute inset-0 hidden md:block">
      <ul>
        {shown.map((c, i) => {
          const { tilt, ...pos } = slots[i];
          return (
            <li key={c.mint} data-coin-print className="pointer-events-auto absolute w-28 lg:w-32" style={pos}>
              <Print coin={c} className="float" style={{ "--tilt": `${tilt}deg`, animationDelay: `calc(var(--float-stagger) * ${i})` } as CSSProperties} />
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Phone version: the same prints in a row that scrolls sideways. */
export function CoinRow({ coins }: { coins: CoinChip[] }) {
  if (coins.length === 0) return null;
  return (
    <nav aria-label="Recently launched on Yardstick" className="-mx-gutter w-[calc(100%+2*var(--gutter))] md:hidden">
      <p className="eyebrow mb-3">Recently launched</p>
      <ul className="flex snap-x gap-3 overflow-x-auto px-gutter pt-1 pb-6">
        {coins.slice(0, 6).map((c) => (
          <li key={c.mint} data-coin-print className="w-28 shrink-0 snap-start">
            <Print coin={c} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
