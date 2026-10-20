import Link from "next/link";
import { CoinImage } from "./coin-image";

/**
 * Ranked coin card: square image with a mono rank chip, name and a short line on the left,
 * $SYMBOL and a figure in mono on the right, and an optional standing underneath.
 * The image zooms slightly on hover and on keyboard focus.
 */
export function CoinCard({
  href,
  rank,
  image,
  name,
  symbol,
  sub,
  figure,
  standing,
  tag,
  onPanel = false,
}: {
  href: string;
  rank?: number;
  image: string | null;
  name: string;
  symbol: string;
  sub?: React.ReactNode;
  figure?: React.ReactNode;
  /** "Top X%" or null for "Not enough data yet"; omit to hide the line. */
  standing?: number | null;
  tag?: React.ReactNode;
  onPanel?: boolean;
}) {
  const quiet = onPanel ? "text-panel-muted" : "text-muted";
  return (
    <article className="group relative">
      <div className={`relative overflow-hidden rounded-2xl ${onPanel ? "bg-on-panel/10" : "bg-tint"}`}>
        <CoinImage
          src={image}
          symbol={symbol}
          size={240}
          tone={onPanel ? "panel" : "tint"}
          className="aspect-square w-full text-4xl transition-transform duration-(--dur-zoom) ease-(--ease-standard) group-focus-within:scale-[1.03] group-hover:scale-[1.03]"
        />
        {rank !== undefined && (
          <span className="num absolute top-2 left-2 rounded-pill bg-panel/75 px-2 py-1 font-mono text-mono text-on-panel backdrop-blur">{String(rank).padStart(2, "0")}</span>
        )}
        {tag && <span className="absolute top-2 right-2">{tag}</span>}
      </div>
      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-small font-medium">
            {/* The whole card is clickable through this link's overlay. */}
            <Link href={href} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-focus">
              {name}
            </Link>
          </h3>
          {sub && <p className={`text-label ${quiet}`}>{sub}</p>}
        </div>
        <div className={`num shrink-0 text-right font-mono text-mono leading-4 ${quiet}`}>
          <p>${symbol}</p>
          {figure && <p>{figure}</p>}
        </div>
      </div>
      {standing !== undefined && (
        <p className={`num mt-2 text-small font-medium ${standing === null ? quiet : onPanel ? "text-panel-accent" : "text-primary-ink"}`}>
          {standing === null ? "Not enough data yet" : `Top ${Math.max(1, Math.round(100 - standing))}%`}
        </p>
      )}
    </article>
  );
}
