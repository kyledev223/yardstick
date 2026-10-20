"use client";
import { WalletNotReadyError, WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import { ChevronDown, LogOut, Wallet, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { shortAddr } from "@/lib/format";
import { useAuth } from "./providers";

const INSTALL: Record<string, string> = {
  Phantom: "https://phantom.com/download",
  Solflare: "https://solflare.com/download",
  "OKX Wallet": "https://www.okx.com/web3",
};

/** Wallet picker. Wallets that aren't installed open install steps instead of a bare download link. */
export function WalletDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { wallets, select, wallet, connect, connected, connecting } = useWallet();
  const ref = useRef<HTMLDialogElement>(null);
  const [help, setHelp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (connected && open) onClose();
  }, [connected, open, onClose]);

  // After select(), connect once the adapter is the selected one.
  useEffect(() => {
    if (!pending.current || !wallet || connected || connecting) return;
    pending.current = false;
    connect().catch((e) => {
      if (e instanceof WalletNotReadyError || e?.name === "WalletNotReadyError") setHelp(wallet.adapter.name);
      else setError("The wallet didn't connect. Unlock it and try again.");
    });
  }, [wallet, connected, connecting, connect]);

  const choose = (name: WalletName, ready: WalletReadyState) => {
    setError(null);
    if (ready !== WalletReadyState.Installed && ready !== WalletReadyState.Loadable) {
      setHelp(name);
      return;
    }
    pending.current = true;
    select(name);
  };

  const shown = wallets.filter((w) => ["Phantom", "Solflare", "OKX Wallet"].includes(w.adapter.name));

  return (
    <dialog ref={ref} onClose={onClose} className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-card bg-card p-0 text-ink shadow-[0_24px_80px_var(--shadow),inset_0_0_0_1px_var(--rule)] backdrop:bg-[rgb(7_10_36/0.45)] backdrop:backdrop-blur-sm">
      <div className="flex items-center justify-between px-6 pt-5 pb-2">
        <h2 className="text-title">{help ? `Install ${help}` : "Connect a wallet"}</h2>
        <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-pill text-muted hover:bg-tint hover:text-ink" aria-label="Close">
          <X size={18} />
        </button>
      </div>
      {/* Wallet detection is browser-only, so render the contents only while open (avoids hydration mismatch). */}
      {!open ? null : help ? (
        <div className="space-y-3 px-6 pt-2 pb-6 text-sm">
          <p>{help} isn&apos;t installed in this browser. Wallet extensions work in Chrome, Brave, Edge, Arc and Firefox.</p>
          <ol className="list-decimal space-y-1.5 pl-5 text-muted">
            <li>
              Get the extension from{" "}
              <a className="text-ink underline underline-offset-2" href={INSTALL[help] ?? "#"} target="_blank" rel="noreferrer">
                {help}&apos;s official site
              </a>
              . Only install it from there.
            </li>
            <li>Create a wallet or import one inside the extension. Yardstick never asks for your recovery phrase.</li>
            <li>Pin the extension, then reload this page and connect again.</li>
          </ol>
          <button type="button" onClick={() => setHelp(null)} className="btn btn-outline mt-2">
            Back to wallets
          </button>
        </div>
      ) : (
        <ul className="px-3 pt-1 pb-4">
          {shown.map((w) => (
            <li key={w.adapter.name}>
              <button type="button" onClick={() => choose(w.adapter.name, w.readyState)} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-tint">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={w.adapter.icon} alt="" width={28} height={28} className="rounded-sm" />
                <span className="flex-1 font-medium">{w.adapter.name}</span>
                <span className="text-label text-muted">{w.readyState === WalletReadyState.Installed ? "Detected" : "Not installed"}</span>
              </button>
            </li>
          ))}
          {error && <li className="px-3 py-2 text-sm text-down">{error}</li>}
        </ul>
      )}
    </dialog>
  );
}

export function WalletButton({ small = false }: { small?: boolean }) {
  const size = small ? "btn-sm" : "";
  const { publicKey, disconnect, connecting } = useWallet();
  const { sessionWallet, signIn, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const wallet = publicKey?.toBase58() ?? null;
  const signedIn = Boolean(wallet && sessionWallet === wallet);

  if (!wallet) {
    return (
      <>
        <button type="button" onClick={() => setOpen(true)} className={`btn btn-ghost ${size}`}>
          <Wallet size={15} strokeWidth={1.75} aria-hidden /> {connecting ? "Connecting…" : "Connect wallet"}
        </button>
        <WalletDialog open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  if (!signedIn) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            const e = await signIn();
            if (e) setErr(e.message);
            setBusy(false);
          }}
          className={`btn btn-outline ${size}`}
          title={err ?? "Sign a message to prove you own this wallet. Free; no transaction."}
        >
          {busy ? "Check your wallet…" : `Sign in ${shortAddr(wallet)}`}
        </button>
        <button type="button" onClick={() => disconnect()} className="grid h-9 w-9 place-items-center rounded-pill text-muted hover:bg-tint hover:text-ink" aria-label="Disconnect wallet">
          <LogOut size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setMenu((m) => !m)} aria-expanded={menu} className={`btn btn-ghost addr gap-2 ${size}`}>
        <span className="h-2 w-2 rounded-pill bg-primary" aria-hidden />
        {shortAddr(wallet)}
        <ChevronDown size={14} aria-hidden />
      </button>
      {menu && (
        <div className="absolute right-0 z-20 mt-2 w-48 rounded-2xl bg-card p-1.5 shadow-[0_16px_45px_var(--shadow),inset_0_0_0_1px_var(--rule)]" onMouseLeave={() => setMenu(false)}>
          <Link href={`/creator/${wallet}`} onClick={() => setMenu(false)} className="flex min-h-10 items-center rounded-xl px-3 text-small font-medium hover:bg-tint">
            My coins
          </Link>
          <button
            type="button"
            onClick={async () => {
              setMenu(false);
              await signOut();
              await disconnect();
            }}
            className="flex min-h-10 w-full items-center rounded-xl px-3 text-left text-small font-medium hover:bg-tint"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
