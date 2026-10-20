import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { NETWORK_LABEL } from "@/lib/config";
import { CheckCoinButton } from "./command-search";

const LINKS = [
  ["/launch", "Launch"],
  ["/today", "Today"],
  ["/how", "How it works"],
  ["/how#faq", "FAQ"],
  ["/status", "Status"],
] as const;

/** Tint band: the closing call to action, a mono link row, the disclaimer and a giant wordmark cropped by the page edge. */
export function SiteFooter() {
  return (
    <footer className="overflow-hidden bg-tint px-gutter pt-section">
      <div className="mx-auto flex max-w-page flex-col items-center gap-6 text-center">
        <p className="eyebrow">Compared at the same age</p>
        <h2 className="max-w-3xl text-cta">Where does your coin stand?</h2>
        <p className="max-w-md text-small text-muted">Launch on pump.fun from your own wallet, or paste any coin&apos;s address, and see how it compares with coins of exactly the same age.</p>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Link href="/launch" className="btn btn-primary">
            Launch a coin <ArrowUpRight size={16} aria-hidden />
          </Link>
          <CheckCoinButton />
        </div>
      </div>

      <div className="mx-auto mt-24 max-w-page border-t border-rule py-5">
        <div className="flex flex-col gap-4 font-mono text-mono tracking-[0.12em] text-muted uppercase sm:flex-row sm:items-center sm:justify-between">
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-pill bg-up" aria-hidden />
              {NETWORK_LABEL} · real SOL
            </span>
            <span>Data, not advice</span>
            <span>Free. No fees.</span>
          </p>
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {LINKS.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="inline-flex min-h-6 items-center transition-opacity duration-(--dur-fast) hover:opacity-50">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="mt-4 max-w-3xl text-label text-muted">
          <strong className="font-medium text-ink">Data, not advice.</strong> Yardstick describes how coins have done at the same age. It doesn&apos;t predict prices or tell you to buy or sell
          anything. Meme coins are very risky; most go to zero. Only spend what you can afford to lose. No fees. Non-custodial.
        </p>
      </div>

      <p aria-hidden className="pointer-events-none mt-6 text-center text-[20.5vw] leading-[0.7] font-semibold tracking-[-0.08em] select-none">
        yardstick
      </p>
    </footer>
  );
}
