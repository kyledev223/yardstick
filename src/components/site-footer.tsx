import Link from "next/link";
import { LogoMark } from "./logo";

export function SiteFooter() {
  return (
    <footer className="px-gutter pt-section-sm pb-6">
      <div className="mx-auto grid max-w-page gap-6 rounded-xl bg-soft p-6 text-sm text-muted md:grid-cols-12 md:items-center md:gap-8 md:px-8 md:py-6">
        <LogoMark className="h-6 w-auto text-ink md:col-span-1" />
        <p className="md:col-span-7">
          <strong className="font-semibold text-ink">Data, not advice.</strong> Yardstick describes how coins have done at the same age. It doesn&apos;t predict prices or tell you to buy or sell
          anything. Meme coins are very risky; most go to zero. Only spend what you can afford to lose.
        </p>
        <nav aria-label="Footer" className="-mx-2 flex flex-wrap items-center gap-x-1 gap-y-1 md:col-span-4 md:justify-end">
          <Link href="/how" className="rounded-pill px-2 py-2 hover:text-ink">
            Method
          </Link>
          <Link href="/how#faq" className="rounded-pill px-2 py-2 hover:text-ink">
            FAQ
          </Link>
          <Link href="/status" className="rounded-pill px-2 py-2 hover:text-ink">
            Status
          </Link>
          <span className="px-2 py-2">No fees. Non-custodial.</span>
        </nav>
      </div>
    </footer>
  );
}
