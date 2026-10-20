"use client";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Logo } from "./logo";
import { MainNav } from "./main-nav";
import { NetworkBadge } from "./network-badge";
import { ThemeToggle } from "./theme-toggle";
import { WalletButton } from "./wallet-button";

/** Phones and tablets: a menu button that opens the nav, wallet and theme in a panel styled like the header. */
export function MobileMenu({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className={`grid h-8 w-8 place-items-center rounded-pill text-ink hover:bg-tint ${className}`}>
        <Menu size={18} aria-hidden />
      </button>
      <dialog
        ref={ref}
        onClose={close}
        onClick={(e) => e.target === ref.current && close()}
        aria-label="Menu"
        className="m-0 mx-auto mt-4 w-[calc(100vw-2rem)] max-w-xl rounded-2xl bg-card p-0 text-ink shadow-[0_24px_80px_var(--shadow),inset_0_0_0_1px_var(--rule)] backdrop:bg-[rgb(7_10_36/0.45)] backdrop:backdrop-blur-sm"
      >
        <div className="flex items-center justify-between px-3 py-2">
          <Link href="/" onClick={close} aria-label="Yardstick home">
            <Logo />
          </Link>
          <button type="button" onClick={close} aria-label="Close menu" className="grid h-8 w-8 place-items-center rounded-pill hover:bg-tint">
            <X size={18} aria-hidden />
          </button>
        </div>
        <MainNav large onNavigate={close} className="border-t border-rule px-5 py-4" />
        <div className="flex flex-wrap items-center gap-2 border-t border-rule px-4 py-4">
          <WalletButton />
          <ThemeToggle />
          <NetworkBadge className="ml-auto" />
        </div>
      </dialog>
    </>
  );
}
