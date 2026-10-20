"use client";
import { ArrowRight, CornerDownLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { api } from "@/lib/client/api";
import { shortAddr } from "@/lib/format";
import { CoinImage } from "./coin-image";

type Hit = { mint: string; name: string; symbol: string; image: string | null; source: string };

const MINT = /[1-9A-HJ-NP-Za-km-z]{32,44}/;
const SOURCE_LABEL: Record<string, string> = { yardstick: "Launched here", baseline: "Sampled", external: "Looked up" };

// One dialog for the whole site; any trigger opens it.
let isOpen = false;
const listeners = new Set<() => void>();
function setOpen(v: boolean) {
  isOpen = v;
  listeners.forEach((l) => l());
}
export const openSearch = () => setOpen(true);
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** True on Apple platforms, where the shortcut is ⌘K rather than Ctrl K. */
function useIsMac() {
  return useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => true,
  );
}

/** The header's search pill: looks like a field, opens the dialog. */
export function SearchPill({ className = "" }: { className?: string }) {
  const mac = useIsMac();
  return (
    <button
      type="button"
      onClick={openSearch}
      aria-keyshortcuts="Meta+K Control+K"
      className={`flex h-8 min-w-0 items-center gap-3 rounded-pill bg-tint px-4 text-left text-label text-muted transition-colors duration-(--dur-fast) hover:bg-tint-strong ${className}`}
    >
      <Search size={14} aria-hidden className="shrink-0" />
      <span className="flex-1 truncate">Check a coin</span>
      <kbd className="hidden font-mono text-mono sm:inline" aria-hidden>
        {mac ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  );
}

/** Icon-only trigger for mid-size headers where the pill doesn't fit. */
export function SearchIconButton({ className = "" }: { className?: string }) {
  return (
    <button type="button" onClick={openSearch} aria-label="Check a coin" aria-keyshortcuts="Meta+K Control+K" className={`grid h-8 w-8 place-items-center rounded-pill bg-tint text-muted hover:bg-tint-strong hover:text-ink ${className}`}>
      <Search size={15} aria-hidden />
    </button>
  );
}

/** "Check a coin" call-to-action button. */
export function CheckCoinButton({ className = "btn btn-ghost", children = "Check a coin" }: { className?: string; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={openSearch} className={className}>
      {children}
    </button>
  );
}

export function CommandSearch() {
  const router = useRouter();
  const open = useSyncExternalStore(subscribe, () => isOpen, () => false);
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [q, setQ] = useState("");
  // Results remember the query they answer, so stale ones are never shown.
  const [results, setResults] = useState<{ q: string; hits: Hit[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  // ⌘K / Ctrl+K anywhere toggles the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!isOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      inputRef.current?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  const mint = q.match(MINT)?.[0] ?? null;
  const term = q.trim();
  const hits = !mint && results?.q === term ? results.hits : null;

  // Search tracked coins as the user types (not for pasted mints).
  useEffect(() => {
    if (mint || term.replace(/^\$/, "").length < 1) return;
    let live = true;
    const t = setTimeout(() => {
      api<{ coins: Hit[] }>(`/api/search?q=${encodeURIComponent(term)}`).then((r) => {
        if (!live) return;
        if (r.ok) {
          setResults({ q: term, hits: r.coins });
          setError(null);
        } else setError(r.error.message);
        setActive(0);
      });
    }, 180);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [term, mint]);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setResults(null);
    setError(null);
    setActive(0);
  }, []);

  const go = (m: string) => {
    close();
    router.push(`/coin/${m}`);
  };

  const options: { key: string; mint: string }[] = mint ? [{ key: "mint", mint }] : (hits ?? []).map((h) => ({ key: h.mint, mint: h.mint }));
  const optId = (i: number) => `${listId}-${i}`;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" && options.length) {
      e.preventDefault();
      setActive((a) => (a + 1) % options.length);
    } else if (e.key === "ArrowUp" && options.length) {
      e.preventDefault();
      setActive((a) => (a - 1 + options.length) % options.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (options[active]) go(options[active].mint);
    }
  };

  return (
    <dialog
      ref={ref}
      onClose={close}
      onClick={(e) => e.target === ref.current && close()}
      aria-label="Check a coin"
      className="mx-auto mt-[12vh] w-[min(36rem,calc(100vw-2rem))] overflow-hidden rounded-card bg-card p-0 text-ink shadow-[0_24px_80px_var(--shadow),inset_0_0_0_1px_var(--rule)] backdrop:bg-[rgb(7_10_36/0.45)] backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center gap-3 border-b border-rule px-4">
        <Search size={16} className="shrink-0 text-muted" aria-hidden />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={options.length > 0}
          aria-controls={listId}
          aria-activedescendant={options.length ? optId(active) : undefined}
          aria-autocomplete="list"
          aria-label="Mint address or $SYMBOL"
          placeholder="Paste a mint address or type a $SYMBOL"
          spellCheck={false}
          autoComplete="off"
          className="h-14 min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-muted"
        />
        <kbd className="tag tag-tint hidden sm:inline-flex" aria-hidden>
          esc
        </kbd>
      </div>

      <ul id={listId} role="listbox" aria-label="Coins" className="max-h-[50vh] overflow-y-auto p-2">
        {mint ? (
          <Option id={optId(0)} selected={active === 0} onPick={() => go(mint)} onHover={() => setActive(0)}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-on-primary">
              <ArrowRight size={16} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Open this coin&apos;s dashboard</span>
              <span className="addr block truncate text-label text-muted">{shortAddr(mint, 6)}</span>
            </span>
          </Option>
        ) : (
          hits?.map((h, i) => (
            <Option key={h.mint} id={optId(i)} selected={active === i} onPick={() => go(h.mint)} onHover={() => setActive(i)}>
              <CoinImage src={h.image} symbol={h.symbol} className="h-9 w-9 rounded-lg" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{h.name}</span>
                <span className="block font-mono text-mono text-muted">${h.symbol}</span>
              </span>
              <span className={`tag ${h.source === "yardstick" ? "tag-primary" : "tag-tint"}`}>{SOURCE_LABEL[h.source] ?? h.source}</span>
            </Option>
          ))
        )}
      </ul>

      <div className="px-4 pb-4 text-label text-muted" aria-live="polite">
        {error ? (
          <p className="text-down">{error}</p>
        ) : !term ? (
          <p>Paste any pump.fun mint address (or a pump.fun or Solscan link), or search the coins Yardstick tracks by symbol or name.</p>
        ) : hits && hits.length === 0 && !mint ? (
          <p>No tracked coin matches &ldquo;{term}&rdquo;. Paste its mint address to check any pump.fun coin.</p>
        ) : options.length > 0 ? (
          <p className="flex items-center gap-1.5">
            <CornerDownLeft size={12} aria-hidden /> to open · ↑↓ to move
          </p>
        ) : null}
      </div>
    </dialog>
  );
}

function Option({ id, selected, onPick, onHover, children }: { id: string; selected: boolean; onPick: () => void; onHover: () => void; children: React.ReactNode }) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={selected}
      onClick={onPick}
      onMouseMove={onHover}
      className={`flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-small ${selected ? "bg-tint" : ""}`}
    >
      {children}
    </li>
  );
}
