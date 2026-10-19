"use client";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Paste any pump.fun mint address (or a pump.fun / Solscan link) and open its dashboard. */
export function CheckForm({ autoFocus = false, compact = false }: { autoFocus?: boolean; compact?: boolean }) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = value.trim();
    const mint = raw.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/)?.[0] ?? "";
    if (!BASE58.test(mint)) {
      setError("That doesn't look like a Solana mint address. Paste the address from pump.fun or Solscan.");
      return;
    }
    setError(null);
    router.push(`/coin/${mint}`);
  };

  return (
    <form onSubmit={submit} noValidate className="w-full">
      <label htmlFor={id} className={compact ? "sr-only" : "label"}>
        Check a coin
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus={autoFocus}
          spellCheck={false}
          autoComplete="off"
          placeholder="Paste a pump.fun mint address"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-err` : undefined}
          className="field addr min-w-0 flex-1 rounded-pill px-5 text-[0.9375rem] placeholder:font-sans"
        />
        <button type="submit" className="btn min-h-12 bg-ink text-page hover:opacity-90">
          <Search size={18} strokeWidth={2.25} aria-hidden /> <span className={compact ? "sr-only sm:not-sr-only" : ""}>Check</span>
        </button>
      </div>
      {error && (
        <p id={`${id}-err`} className="mt-2 text-sm font-medium text-down">
          {error}
        </p>
      )}
    </form>
  );
}
