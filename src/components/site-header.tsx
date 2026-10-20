import Link from "next/link";
import { SearchIconButton, SearchPill } from "./command-search";
import { Logo } from "./logo";
import { MainNav } from "./main-nav";
import { MobileMenu } from "./mobile-menu";
import { NetworkBadge } from "./network-badge";
import { SocialLinks } from "./social-links";
import { ThemeToggle } from "./theme-toggle";
import { WalletButton } from "./wallet-button";

/**
 * Fixed, inset, rounded header panel: translucent paper with a backdrop blur.
 * Below lg the nav, wallet and theme move into the menu; below sm a second row holds the badge and search.
 */
export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 px-4 pt-4 md:px-7">
      <div className="mx-auto flex max-w-[100rem] flex-col gap-2 rounded-2xl bg-paper/85 px-3 py-2 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3 lg:gap-7">
            <Link href="/" className="shrink-0 rounded-[0.6rem]" aria-label="Yardstick home">
              <Logo />
            </Link>
            <NetworkBadge className="hidden sm:inline-flex" />
            <MainNav className="hidden lg:block" />
          </div>
          <SearchPill className="hidden w-64 xl:flex" />
          <div className="flex shrink-0 items-center gap-2">
            <SearchIconButton className="hidden sm:grid xl:hidden" />
            <SocialLinks className="hidden lg:flex" />
            <ThemeToggle className="hidden lg:grid" />
            <span className="hidden lg:block">
              <WalletButton small />
            </span>
            <Link href="/launch" className="btn btn-primary btn-sm">
              Launch a coin
            </Link>
            <MobileMenu className="lg:hidden" />
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-rule pt-2 sm:hidden">
          <NetworkBadge />
          <SearchPill className="flex-1" />
        </div>
      </div>
    </header>
  );
}
