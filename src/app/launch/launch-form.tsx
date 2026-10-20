"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";
import { Buffer } from "buffer";
import { AlertTriangle, CircleCheck, Eye, ImagePlus, Info, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/providers";
import { LaunchPreviewCard } from "@/components/launch-preview-card";
import { WalletDialog } from "@/components/wallet-button";
import { api, post, type ApiError } from "@/lib/client/api";
import { LAUNCH } from "@/lib/config";

type Check = { id: string; label: string; status: "good" | "look" | "info"; text: string };
type Phase = "idle" | "signin" | "upload" | "build" | "approve" | "send" | "confirm" | "done";

const PHASES: { key: Phase; label: string }[] = [
  { key: "signin", label: "Sign in with your wallet" },
  { key: "upload", label: "Upload image and details to IPFS" },
  { key: "build", label: "Build and dry-run the transaction" },
  { key: "approve", label: "Approve in your wallet" },
  { key: "send", label: "Send to Solana" },
  { key: "confirm", label: "Wait for confirmation" },
];

const STATUS = {
  good: { Icon: CircleCheck, word: "Good", cls: "tag-tint text-up" },
  look: { Icon: Eye, word: "Worth a look", cls: "tag-accent" },
  info: { Icon: Info, word: "Info", cls: "tag-tint text-muted" },
} as const;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function LaunchForm() {
  const router = useRouter();
  const { publicKey, signTransaction } = useWallet();
  const { sessionWallet, signIn } = useAuth();
  const [walletOpen, setWalletOpen] = useState(false);

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [website, setWebsite] = useState("");
  const [devBuy, setDevBuy] = useState("0");
  const [image, setImage] = useState<File | null>(null);

  const [checks, setChecks] = useState<Check[] | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<ApiError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [cost, setCost] = useState<{ balanceSol: number; estimatedCostSol: number } | null>(null);

  // Kept across retries: the prepared launch (per form content) and the mint keypair (never sent anywhere).
  const prepared = useRef<{ id: string; key: string } | null>(null);
  const mintKp = useRef<Keypair | null>(null);

  const devBuySol = Number(devBuy) || 0;
  const formKey = JSON.stringify([name, symbol, description, twitter, telegram, website, devBuySol, image?.name, image?.size]);

  const preview = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  // Pre-launch checks, debounced as the user types.
  const checkInput = useDebounced(
    useMemo(
      () => ({ name, symbol, description, hasImage: Boolean(image), twitter: Boolean(twitter.trim()), telegram: Boolean(telegram.trim()), website: Boolean(website.trim()), devBuySol }),
      [name, symbol, description, image, twitter, telegram, website, devBuySol],
    ),
    600,
  );
  useEffect(() => {
    let live = true;
    post<{ checks: Check[] }>("/api/launch/precheck", checkInput).then((r) => {
      if (live && r.ok) setChecks(r.checks);
    });
    return () => {
      live = false;
    };
  }, [checkInput]);

  const busy = phase !== "idle" && phase !== "done";

  async function run() {
    setError(null);
    setFieldErrors({});
    if (!publicKey || !signTransaction) {
      setWalletOpen(true);
      return;
    }
    const wallet = publicKey.toBase58();

    if (sessionWallet !== wallet) {
      setPhase("signin");
      const e = await signIn();
      if (e) return fail(e);
    }

    if (!prepared.current || prepared.current.key !== formKey) {
      setPhase("upload");
      const fd = new FormData();
      fd.set("name", name);
      fd.set("symbol", symbol);
      fd.set("description", description);
      if (twitter.trim()) fd.set("twitter", twitter.trim());
      if (telegram.trim()) fd.set("telegram", telegram.trim());
      if (website.trim()) fd.set("website", website.trim());
      fd.set("devBuySol", String(devBuySol));
      if (image) fd.set("image", image);
      const r = await api<{ launchId: string }>("/api/launch/prepare", { method: "POST", body: fd });
      if (!r.ok) {
        if (r.error.code === "validation-failed" && r.error.details && typeof r.error.details === "object") setFieldErrors(r.error.details as Record<string, string>);
        return fail(r.error);
      }
      prepared.current = { id: r.launchId, key: formKey };
      mintKp.current = Keypair.generate(); // new coin key, made here in the browser
    }
    const launchId = prepared.current.id;
    const mint = mintKp.current!;

    setPhase("build");
    const b = await post<{ transaction: string; version: "legacy" | 0; balanceSol: number; estimatedCostSol: number }>("/api/launch/build", { launchId, mint: mint.publicKey.toBase58() });
    if (!b.ok) return fail(b.error);
    setCost({ balanceSol: b.balanceSol, estimatedCostSol: b.estimatedCostSol });

    setPhase("approve");
    let signedB64: string;
    try {
      // Wallet signs first, then the mint key signs (some wallets drop signatures added before theirs).
      const bytes = Buffer.from(b.transaction, "base64");
      if (b.version === 0) {
        const signed = await signTransaction(VersionedTransaction.deserialize(bytes));
        signed.sign([mint]);
        signedB64 = Buffer.from(signed.serialize()).toString("base64");
      } else {
        const signed = await signTransaction(Transaction.from(bytes));
        signed.partialSign(mint);
        signedB64 = signed.serialize().toString("base64");
      }
    } catch (e) {
      const msg = String((e as Error)?.message ?? "");
      return fail(/reject|cancel|denied|declined/i.test(msg) ? { code: "wallet-rejected", message: "You cancelled the request in your wallet. Nothing was sent." } : { code: "wallet-error", message: `The wallet couldn't sign: ${msg || "unknown error"}.` });
    }

    setPhase("send");
    const s = await post<{ signature: string }>("/api/launch/relay", { launchId, transaction: signedB64 });
    if (!s.ok) return fail(s.error);

    setPhase("confirm");
    // Poll for up to ~2 minutes.
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise((r) => setTimeout(r, 2000));
      const st = await api<{ status: string; coinReady: boolean; errorCode: string | null; reason: string | null; mint: string | null }>(`/api/launch/${launchId}`);
      if (!st.ok) continue;
      if (st.status === "confirmed" && st.coinReady) {
        setPhase("done");
        router.push(`/coin/${st.mint}?launched=${encodeURIComponent(s.signature)}`);
        return;
      }
      if (st.status === "failed" || st.status === "expired") {
        prepared.current = null; // start a fresh launch next time
        return fail({ code: st.errorCode ?? "tx-failed", message: st.reason ?? "The launch didn't go through." });
      }
    }
    fail({ code: "confirm-timeout", message: "Still waiting for confirmation. It may yet land: check Solscan, then refresh this page in a minute." });
  }

  function fail(e: ApiError) {
    setError(e);
    setPhase("idle");
    // An expired blockhash just needs a rebuild; keep the prepared launch and mint key.
  }

  const inputCls = "field";
  const fe = (k: string) => fieldErrors[k] && <p className="mt-1.5 text-small font-medium text-down">{fieldErrors[k]}</p>;
  const ready = Boolean(name.trim() && symbol.trim());

  return (
    <div className="card grid overflow-hidden lg:grid-cols-[1.15fr_0.85fr]">
      <form
        className="space-y-8 p-6 sm:p-10"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) run();
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Yardstick launch studio</p>
            <h2 className="mt-2 text-title">Make your coin</h2>
          </div>
          <span className="tag tag-tint">Free · no fees</span>
        </div>

        <div className="grid gap-6 sm:grid-cols-[136px_1fr]">
          <div>
            <span className="label" id="img-label">
              Image
            </span>
            <label className="group relative grid aspect-square w-full max-w-[136px] cursor-pointer place-items-center overflow-hidden rounded-2xl border border-dashed border-rule-strong bg-tint transition-colors duration-(--dur-fast) hover:border-ink focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-1.5 text-label font-medium text-muted">
                  <ImagePlus size={22} strokeWidth={1.5} aria-hidden /> Add image
                </span>
              )}
              <input type="file" accept={LAUNCH.imageTypes.join(",")} aria-labelledby="img-label" className="sr-only" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
            </label>
            <p className="help">PNG, JPEG, WebP or GIF, up to 4 MB.</p>
            {fe("image")}
          </div>
          <div className="space-y-5">
            <div>
              <label htmlFor="name" className="label">
                Name
              </label>
              <input id="name" className={inputCls} value={name} maxLength={LAUNCH.nameMax} onChange={(e) => setName(e.target.value)} required autoComplete="off" />
              {fe("name")}
            </div>
            <div>
              <label htmlFor="symbol" className="label">
                Symbol
              </label>
              <input id="symbol" className={`${inputCls} uppercase`} value={symbol} maxLength={LAUNCH.symbolMax} onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} required autoComplete="off" />
              <p className="help">A–Z and 0–9, up to {LAUNCH.symbolMax} characters.</p>
              {fe("symbol")}
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="description" className="label">
            Description <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea id="description" rows={3} className={inputCls} value={description} maxLength={LAUNCH.descriptionMax} onChange={(e) => setDescription(e.target.value)} />
          <p className="num help text-right">
            {description.length}/{LAUNCH.descriptionMax}
          </p>
          {fe("description")}
        </div>

        <fieldset className="grid gap-4 sm:grid-cols-3">
          <legend className="label">
            Links <span className="font-normal text-muted">(optional)</span>
          </legend>
          {[
            ["twitter", "X / Twitter", "https://x.com/…", twitter, setTwitter],
            ["telegram", "Telegram", "https://t.me/…", telegram, setTelegram],
            ["website", "Website", "https://…", website, setWebsite],
          ].map(([id, label, ph, val, set]) => (
            <div key={id as string}>
              <label htmlFor={id as string} className="mb-1.5 block text-label text-muted">
                {label as string}
              </label>
              <input id={id as string} type="url" inputMode="url" placeholder={ph as string} className={inputCls} value={val as string} onChange={(e) => (set as (v: string) => void)(e.target.value)} />
              {fe(id as string)}
            </div>
          ))}
        </fieldset>

        <div>
          <label htmlFor="devbuy" className="label">
            Dev buy <span className="font-normal text-muted">(optional, in SOL)</span>
          </label>
          <input
            id="devbuy"
            type="number"
            min={0}
            max={LAUNCH.devBuyMaxSol}
            step="0.01"
            inputMode="decimal"
            className={`${inputCls} num max-w-[12rem]`}
            value={devBuy}
            onChange={(e) => setDevBuy(e.target.value)}
            aria-describedby="devbuy-help"
          />
          <p id="devbuy-help" className="help">
            Buys some of your coin in the same transaction, from your wallet. 0 means create only. Capped at {LAUNCH.devBuyMaxSol} SOL.
          </p>
          {devBuySol > 0 && (
            <p className="mt-3 flex gap-3 rounded-xl bg-tint p-4 text-small shadow-[inset_0_0_0_1.5px_var(--accent)]">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-ink" aria-hidden />
              <span>
                This spends {devBuySol} SOL of real money on your own coin, on top of the creation cost. Its value can drop to zero. A dev buy also shows up in the creator-wallet and top-10 metrics.
              </span>
            </p>
          )}
          {devBuySol > LAUNCH.devBuyMaxSol && <p className="mt-2 text-small font-medium text-down">Dev buy is capped at {LAUNCH.devBuyMaxSol} SOL.</p>}
          {fe("devBuySol")}
        </div>

        <div className="space-y-4 border-t border-rule pt-8">
          <p className="text-small text-muted">
            This creates a real coin on <strong className="font-medium text-ink">Solana mainnet</strong> with real SOL. You pay only the network fee and pump.fun&apos;s creation cost
            {devBuySol > 0 ? ", plus your dev buy" : ""}, about <span className="num">{(LAUNCH.createCostSol + devBuySol * 1.01).toFixed(3)}</span> SOL in total. Yardstick charges nothing.
          </p>
          {/* Without a wallet this is a plain button, so it opens the wallet picker even while the form is still empty. */}
          {!publicKey ? (
            <button type="button" onClick={() => setWalletOpen(true)} className="btn btn-primary btn-lg w-full sm:w-auto">
              Connect wallet to launch
            </button>
          ) : (
            <button type="submit" disabled={busy || devBuySol > LAUNCH.devBuyMaxSol || devBuySol < 0} className="btn btn-primary btn-lg w-full sm:w-auto">
              {busy && <Loader2 size={16} className="animate-spin" aria-hidden />}
              {busy ? (PHASES.find((p) => p.key === phase)?.label ?? "Working…") : error ? "Try again" : "Launch coin"}
            </button>
          )}

          {(busy || phase === "done") && (
            <ol className="space-y-2 text-small" aria-live="polite">
              {PHASES.map((p) => {
                const idx = PHASES.findIndex((x) => x.key === phase);
                const mine = PHASES.findIndex((x) => x.key === p.key);
                const state = phase === "done" || mine < idx ? "done" : mine === idx ? "now" : "todo";
                return (
                  <li key={p.key} className={`flex items-center gap-3 ${state === "now" ? "font-medium text-ink" : "text-muted"}`}>
                    <span className={`h-2.5 shrink-0 rounded-pill ${state === "done" ? "w-2.5 bg-data-you" : state === "now" ? "w-6 bg-primary" : "w-2.5 bg-tint shadow-[inset_0_0_0_1px_var(--rule-strong)]"}`} aria-hidden />
                    <span className="sr-only">{state === "done" ? "Done: " : state === "now" ? "Now: " : "Next: "}</span>
                    {p.label}
                    {state === "now" && p.key === "approve" && <span className="text-muted"> (check the wallet pop-up)</span>}
                  </li>
                );
              })}
            </ol>
          )}

          {error && (
            <div role="alert" className="rounded-xl bg-card p-4 text-small shadow-[inset_0_0_0_1.5px_var(--down)]">
              <p className="font-medium">{error.message}</p>
              {error.code === "insufficient-sol" && cost && (
                <p className="num mt-1 text-muted">
                  Balance {cost.balanceSol.toFixed(4)} SOL; needed about {cost.estimatedCostSol.toFixed(3)} SOL.
                </p>
              )}
              {error.code === "simulation-failed" && Array.isArray((error.details as { logs?: string[] })?.logs) && (
                <details className="mt-2">
                  <summary className="link inline-flex min-h-10 cursor-pointer items-center">Program logs</summary>
                  <pre className="addr mt-1 max-h-40 overflow-auto rounded-lg bg-tint p-3 text-xs whitespace-pre-wrap text-muted">{((error.details as { logs: string[] }).logs ?? []).join("\n")}</pre>
                </details>
              )}
              <p className="mt-2 text-label text-muted">
                Code: <span className="addr">{error.code}</span>
              </p>
            </div>
          )}
        </div>
      </form>

      <aside className="flex flex-col gap-10 bg-tint p-6 sm:p-10" aria-label="Launch preview and pre-launch check">
        <div className="flex items-center justify-between font-mono text-mono tracking-[0.14em] text-muted uppercase">
          <span>Launch preview</span>
          <span>pump.fun</span>
        </div>
        <LaunchPreviewCard image={preview} name={name.trim()} symbol={symbol} description={description.trim()} />

        <section aria-labelledby="checks-h" className="border-t border-rule pt-8">
          <h2 id="checks-h" className="eyebrow">
            Pre-launch check
          </h2>
          <p className="mt-2 text-label text-muted">Updates as you type. Based on coins Yardstick has measured in the last 7 days.</p>
          <ul className="mt-5 space-y-2" aria-live="polite">
            {checks === null
              ? [0, 1, 2, 3].map((i) => (
                  <li key={i} className="card-sm p-4">
                    <div className="skeleton h-4 w-28" />
                    <div className="skeleton mt-3 h-3 w-full" />
                  </li>
                ))
              : checks.map((c) => {
                  const s = STATUS[c.status];
                  return (
                    <li key={c.id} className="card-sm p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-small font-medium">{c.label}</span>
                        <span className={`tag shrink-0 ${s.cls}`}>
                          <s.Icon size={12} strokeWidth={2.25} aria-hidden /> {s.word}
                        </span>
                      </div>
                      <p className="mt-1.5 text-label text-muted">{c.text}</p>
                    </li>
                  );
                })}
          </ul>
        </section>

        <p className="mt-auto font-mono text-mono tracking-[0.12em] text-muted uppercase" aria-live="polite">
          {ready ? "Ready when your wallet is" : "Add a name and symbol to launch"}
        </p>
      </aside>
      <WalletDialog open={walletOpen} onClose={() => setWalletOpen(false)} />
    </div>
  );
}
