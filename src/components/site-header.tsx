import Link from "next/link";
import { NETWORK_LABEL } from "@/lib/config";
import { Logo } from "./logo";
import { MainNav } from "./main-nav";
import { ThemeToggle } from "./theme-toggle";
import { WalletButton } from "./wallet-button";

function NetworkBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`chip font-semibold ${className}`} title="Every transaction on this site uses real SOL on Solana mainnet.">
      <span className="h-2 w-2 rounded-pill bg-up" aria-hidden />
      {NETWORK_LABEL} · real SOL
    </span>
  );
}

export function SiteHeader() {
  return (
    <header>
      <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-6 gap-y-3 px-gutter pt-4 pb-2 md:py-6">
        <Link href="/" className="rounded-pill text-ink" aria-label="Yardstick home">
          <Logo />
        </Link>
        <MainNav className="order-3 w-full md:order-none md:w-auto" />
        <div className="ml-auto flex items-center gap-2">
          <NetworkBadge className="hidden lg:inline-flex" />
          <ThemeToggle />
          <WalletButton />
        </div>
        {/* Below lg the badge gets its own line so it's always visible. */}
        <NetworkBadge className="order-4 lg:hidden" />
      </div>
    </header>
  );
}
