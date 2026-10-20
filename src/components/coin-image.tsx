"use client";
import { useState } from "react";

/**
 * A coin's own image, or (when it has none, or it fails to load) its first letter on a quiet tile. Never a stand-in picture.
 * `tone="panel"` for ink sections. `hideOnError` removes the nearest `[data-coin-print]` ancestor instead of showing a letter
 * (the floating hero cards show real images only).
 */
export function CoinImage({
  src,
  symbol,
  className = "",
  size = 64,
  eager = false,
  tone = "tint",
  hideOnError = false,
}: {
  src: string | null;
  symbol: string;
  className?: string;
  size?: number;
  eager?: boolean;
  tone?: "tint" | "panel";
  hideOnError?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const fail = (el: HTMLImageElement | null) => {
    if (hideOnError) el?.closest<HTMLElement>("[data-coin-print]")?.setAttribute("hidden", "");
    else setFailed(src);
  };
  if (!src || failed === src) {
    return (
      <span className={`grid shrink-0 place-items-center font-medium ${tone === "panel" ? "bg-on-panel/10 text-panel-muted" : "bg-tint text-muted"} ${className}`} aria-hidden>
        {symbol.trim().slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    // Coin images live on IPFS gateways and pump.fun's CDN, so next/image's optimiser isn't used.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading={eager ? "eager" : "lazy"}
      referrerPolicy="no-referrer"
      onError={(e) => fail(e.currentTarget)}
      // Server-rendered images can fail before React attaches onError: check once on mount.
      ref={(el) => {
        if (el && el.complete && el.naturalWidth === 0) fail(el);
      }}
      className={`shrink-0 object-cover ${className}`}
    />
  );
}
