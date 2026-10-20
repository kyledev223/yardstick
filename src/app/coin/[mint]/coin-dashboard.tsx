"use client";
import { CheckCircle2, ExternalLink, Share2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CoinImage } from "@/components/coin-image";
import { CheckCoinButton } from "@/components/command-search";
import { MetricBar, PercentileBar } from "@/components/percentile-bar";
import { Sparkline } from "@/components/sparkline";
import { TrajectoryChart } from "@/components/trajectory-chart";
import { api, type ApiError } from "@/lib/client/api";
import { DATA, pumpUrl, solscanToken, solscanTx, type GroupKey, type MetricKey } from "@/lib/config";
import type { CoinView, GroupStanding, MetricCard } from "@/lib/data/dashboard";
import { fmtAge, fmtInt, fmtPct, fmtRatio, fmtSol, fmtUsd, ordinal, shortAddr } from "@/lib/format";
import { GROUP_LABEL, METRIC_META } from "@/lib/metrics-meta";

const MILESTONE_LABEL: Record<string, string> = {
  holders50: "First seen with 50 holders",
  curve25: "Curve 25% full",
  curve50: "Curve 50% full",
  graduated: "Graduated to PumpSwap",
};

const NOTE_TONE = {
  look: { word: "Worth a look", cls: "tag-accent" },
  good: { word: "Good", cls: "tag-tint text-up" },
  info: { word: "Info", cls: "tag-tint text-muted" },
} as const;

const linkPill = "tag tag-tint min-h-8 gap-1.5 px-3 text-label transition-colors duration-(--dur-fast) hover:bg-tint-strong";
const statLabel = "font-mono text-mono tracking-[0.12em] text-muted uppercase";

/** UTC date and time, identical on server and browser. */
const utcStamp = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

export function CoinDashboard({ mint, initial, launchedSig }: { mint: string; initial: CoinView | null; launchedSig: string | null }) {
  const [view, setView] = useState<CoinView | null>(initial);
  const [error, setError] = useState<ApiError | null>(null);
  const [group, setGroup] = useState<GroupKey>("baseline");
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const r = await api<{ view: CoinView }>(`/api/coin/${mint}`);
    if (r.ok) {
      setView(r.view);
      setError(null);
    } else setError(r.error);
  }, [mint]);

  useEffect(() => {
    // First call enrols unknown coins and kicks off a refresh; poll after that.
    const now0 = setTimeout(load, 0);
    const first = setTimeout(load, 8000);
    const t = setInterval(load, 45_000);
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearTimeout(now0);
      clearTimeout(first);
      clearInterval(t);
      clearInterval(tick);
    };
  }, [load]);

  if (!view && error) {
    return (
      <div className="mx-auto max-w-text px-gutter pt-[calc(var(--header-h)+4rem)]">
        <p className="eyebrow">Coin</p>
        <h1 className="mt-3 text-display">Can&apos;t show this coin.</h1>
        <p className="mt-6 max-w-measure text-lead text-muted">{error.message}</p>
        <p className="addr mt-3 text-label break-all text-muted">{mint}</p>
        <CheckCoinButton className="btn btn-primary mt-8">Check another coin</CheckCoinButton>
      </div>
    );
  }
  if (!view) return <DashboardSkeleton />;

  const { coin, latest } = view;
  const age = Math.round((now - Date.parse(coin.createdAt)) / 1000);
  const st = view.standing[group];
  const external = coin.source === "external";
  const curvePct = latest?.graduated ? 100 : (latest?.curveProgress ?? 0);
  const reading = latest?.tradesState === "catching-up";

  return (
    <div className="mx-auto max-w-page px-gutter pt-[calc(var(--header-h)+2rem)] md:pt-[calc(var(--header-h)+3rem)]">
      {launchedSig && coin.source === "yardstick" && (
        <div role="status" className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl bg-card px-5 py-4 shadow-[inset_0_0_0_1.5px_var(--up)]">
          <CheckCircle2 size={20} className="text-up" aria-hidden />
          <span className="font-medium">Launched. Your coin is live on pump.fun.</span>
          <a href={pumpUrl(coin.mint)} target="_blank" rel="noreferrer" className="link">
            Open on pump.fun
          </a>
          <a href={solscanTx(launchedSig)} target="_blank" rel="noreferrer" className="link">
            Transaction on Solscan
          </a>
        </div>
      )}

      {/* Header */}
      <header className="grid gap-10 lg:grid-cols-12 lg:items-end">
        <div className="flex min-w-0 flex-col gap-6 sm:flex-row sm:items-end lg:col-span-7">
          <CoinImage src={coin.image} symbol={coin.symbol} size={112} eager className="size-24 rounded-3xl text-4xl shadow-[0_18px_60px_var(--shadow)] sm:size-28" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {coin.source === "yardstick" && <span className="tag tag-primary">Launched on Yardstick</span>}
              {external && <span className="tag tag-tint">Looked up</span>}
              <span className="font-mono text-mono text-muted">${coin.symbol}</span>
            </div>
            <h1 className="mt-3 truncate text-display">{coin.name}</h1>
            {/* Clock-based text: server and browser can be a minute apart. */}
            <p className="num mt-2 text-lead text-muted" suppressHydrationWarning>
              {fmtAge(age)} old
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-8 border-y border-rule py-6 lg:col-span-5">
          <div>
            <dt className={statLabel}>Market cap</dt>
            <dd className="num mt-2 text-stat">{latest?.mcapSol != null ? `${fmtSol(latest.mcapSol)} SOL` : "–"}</dd>
            <dd className="num mt-1 text-label text-muted">{latest?.mcapUsd != null ? fmtUsd(latest.mcapUsd) : "USD unavailable"}</dd>
          </div>
          <div>
            <dt className={statLabel}>Bonding curve</dt>
            <dd className="num mt-2 text-stat">{latest?.graduated ? "Graduated" : latest?.curveProgress != null ? fmtPct(latest.curveProgress) : "–"}</dd>
            <dd className="mt-3">
              <div className="relative h-2 overflow-hidden rounded-pill bg-data-range" role="img" aria-label={`Curve ${latest?.curveProgress ?? 0}% full`}>
                <div className="absolute inset-y-0 left-0 rounded-pill bg-data-you" style={{ width: `${curvePct}%` }} />
              </div>
            </dd>
          </div>
        </dl>
      </header>

      <div className="mt-6 flex flex-wrap gap-2">
        <a href={pumpUrl(coin.mint)} target="_blank" rel="noreferrer" className={linkPill}>
          pump.fun <ExternalLink size={12} aria-hidden />
        </a>
        <a href={solscanToken(coin.mint)} target="_blank" rel="noreferrer" className={linkPill}>
          Solscan <ExternalLink size={12} aria-hidden />
        </a>
        <Link href={`/creator/${coin.creator}`} className={linkPill}>
          Creator <span className="addr">{shortAddr(coin.creator)}</span>
        </Link>
        <ShareButton name={coin.name} symbol={coin.symbol} />
      </div>

      {external && (
        <p className="mt-6 rounded-2xl bg-tint px-5 py-4 text-small text-muted">
          <strong className="font-medium text-ink">Looked up, not launched here.</strong> This coin is measured only while someone has this page open, so readings are less frequent and
          there&apos;s no fixed-age history.
        </p>
      )}

      {/* Standing: the hero number */}
      <section aria-labelledby="standing-h" className="card mt-12 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-6 py-4 sm:px-10">
          <h2 id="standing-h" className="eyebrow">
            Standing among {GROUP_LABEL[group]}
          </h2>
          <div role="radiogroup" aria-label="Compare with" className="seg">
            {(["baseline", "yardstick"] as GroupKey[]).map((g) => (
              <button key={g} type="button" role="radio" aria-checked={group === g} onClick={() => setGroup(g)}>
                {GROUP_LABEL[g]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-10 p-6 sm:p-10 md:grid-cols-12 md:items-center">
          <div className="md:col-span-5">
            {!latest ? (
              <>
                <p className="text-display">Measuring…</p>
                <p className="mt-3 text-small text-muted">The first reading takes a few seconds. This page refreshes on its own.</p>
              </>
            ) : st.percentile === null ? (
              <>
                <p className="text-display">Not enough data yet</p>
                <p className="mt-3 text-small text-muted">{notEnoughText(st, group)}</p>
              </>
            ) : (
              <>
                <p className="flex items-baseline gap-3 text-primary-ink">
                  <span className="text-display">Top</span>
                  <span className="num text-hero">{Math.max(1, Math.round(100 - st.percentile))}%</span>
                </p>
                <p className="mt-3 text-lead">of coins at {st.bucket}</p>
              </>
            )}
          </div>
          <div className="md:col-span-7">
            <PercentileBar percentile={st.percentile} label="Overall standing" size="lg" showScale />
            <p className="mt-4 text-small text-muted">
              {st.sampleSize > 0 ? (
                <>
                  Compared with <span className="num font-medium text-ink">{fmtInt(st.sampleSize)}</span> {group === "baseline" ? "sampled pump.fun coins" : "Yardstick launches"} at {st.bucket}, last
                  7 days. Score combines holders, buyers, net SOL in, curve progress, concentration, snipers and fresh wallets.{" "}
                  <Link href="/how#score" className="link">
                    How it&apos;s calculated
                  </Link>
                </>
              ) : (
                <>The bar fills in once {DATA.minSampleForPercentile} coins at this age have an overall score.</>
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Metrics */}
      <section aria-labelledby="metrics-h" className="mt-24">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-10">
          <div>
            <p className="eyebrow">Compared at the same age</p>
            <h2 id="metrics-h" className="mt-3 text-display">
              Metrics at {view.bucket}
            </h2>
          </div>
          <p className="max-w-sm text-small text-muted">
            Each bar runs from weakest (left) to strongest (right) among {GROUP_LABEL[group]}. The notch is the median; the shaded part is the middle half; the dot is this coin.
          </p>
        </div>
        {latest?.tradesState === "catching-up" && (
          <p role="status" className="mt-8 max-w-text rounded-2xl bg-tint p-4 text-small shadow-[inset_0_0_0_1.5px_var(--accent)]">
            <strong className="font-medium">Still reading this coin&apos;s trades.</strong> Buys and sells, unique buyers, sniper share, fresh wallets and creator sells cover the first{" "}
            <span className="num">{fmtInt(latest.tradesCounted)}</span> trades read so far, so they can trail market cap, curve, net SOL in and holders, which are read live. They fill in over the
            next readings.
          </p>
        )}
        {latest?.tradesState === "capped" && (
          <p className="mt-8 max-w-text rounded-2xl bg-tint p-4 text-small">
            Trade-based metrics are based on the first <span className="num">{fmtInt(latest.tradesCounted)}</span> trades: reading every trade of a busy coin would exceed the free data plan.
          </p>
        )}
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(["holders", "uniqueBuyers", "netInflowSol"] as MetricKey[]).map((k) => (
            <MetricCell key={k} card={view.metrics.find((m) => m.key === k)!} group={group} bucket={view.bucket} partial={reading && TRADE_BASED.has(k)} />
          ))}
          <BuySellCell view={view} group={group} bucket={view.bucket} />
          <MetricCell card={view.metrics.find((m) => m.key === "curveProgress")!} group={group} bucket={view.bucket} />
          <MetricCell card={view.metrics.find((m) => m.key === "top10Pct")!} group={group} bucket={view.bucket} />
          <DevCell view={view} group={group} bucket={view.bucket} />
          <MetricCell card={view.metrics.find((m) => m.key === "sniperPct")!} group={group} bucket={view.bucket} partial={reading} />
          <MetricCell
            partial={reading}
            card={view.metrics.find((m) => m.key === "freshWalletPct")!}
            group={group}
            bucket={view.bucket}
            note={latest?.freshSampled ? `Sample of ${latest.freshSampled} buyers` : "Not sampled yet"}
          />
        </div>
      </section>

      {/* Trajectory + notes */}
      <section className="mt-24 grid gap-12 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <TrajectoryPanel view={view} group={group} />
        </div>
        <div className="lg:col-span-4">
          <p className="eyebrow">Descriptive, not advice</p>
          <h2 className="mt-3 text-title">What to look at</h2>
          {view.notes[group].length === 0 ? (
            <p className="mt-5 rounded-2xl bg-tint p-5 text-small text-muted">Notes appear once there&apos;s enough comparison data at this age.</p>
          ) : (
            <ul className="mt-5 space-y-2">
              {view.notes[group].map((n, i) => (
                <li key={i} className="card-sm p-4 text-small">
                  <span className={`tag ${NOTE_TONE[n.tone].cls}`}>{NOTE_TONE[n.tone].word}</span>
                  <p className={`mt-2 ${n.tone === "info" ? "text-muted" : ""}`}>{n.text}</p>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-12 text-title">Milestones</h2>
          <ol className="mt-5 border-t border-rule">
            {(["holders50", "curve25", "curve50", "graduated"] as const).map((k) => {
              const m = view.milestones.find((x) => x.kind === k);
              return (
                <li key={k} className="flex items-start gap-3 border-b border-rule py-3 text-small">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-pill ${m ? "bg-data-you" : "shadow-[inset_0_0_0_1px_var(--rule-strong)]"}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className={`block font-medium ${m ? "" : "text-muted"}`}>{MILESTONE_LABEL[k]}</span>
                    <span className="num block text-label text-muted">{m ? `at ${fmtAge((Date.parse(m.at) - Date.parse(coin.createdAt)) / 1000)} · ${utcStamp(m.at)}` : "not yet"}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <p className="mt-24 text-label text-muted" suppressHydrationWarning>
        {latest?.takenAt ? <>Last measured {fmtAge((now - Date.parse(latest.takenAt)) / 1000)} ago. </> : null}
        Refreshes every couple of minutes while this page is open. <span className="addr break-all">{coin.mint}</span>
      </p>
    </div>
  );
}

/** Why there's no standing yet, in plain words (see GroupStanding for measured vs scored). */
function notEnoughText(st: GroupStanding, group: GroupKey): string {
  const min = DATA.minSampleForPercentile;
  const coins = group === "baseline" ? "sampled pump.fun coins" : "Yardstick launches";
  if (st.sampleSize >= min) return "This coin doesn't have enough of its own metrics measured yet to be scored. This page refreshes on its own.";
  if (st.measured === 0) return `No ${coins} have been measured at ${st.bucket} in the last 7 days yet. A standing needs at least ${min}.`;
  if (st.measured < min) {
    return `${fmtInt(st.measured)} ${coins} ${st.measured === 1 ? "has" : "have"} been measured at ${st.bucket} in the last 7 days. Each metric needs at least ${min} coins at the same age before it can be ranked, so none has an overall score yet.`;
  }
  return `${fmtInt(st.measured)} ${coins} have been measured at ${st.bucket}, but only ${fmtInt(st.sampleSize)} have enough metrics for an overall score. A standing needs at least ${min} scored coins.`;
}

function percentileText(p: number | null, n: number, bucket: string) {
  if (p === null) return n > 0 ? `Not enough data yet (${n} coins at ${bucket})` : "Not enough data yet";
  return `${ordinal(p)} percentile at ${bucket}`;
}

/** Metrics computed from decoded trades (they can trail while trades are still being read). */
const TRADE_BASED = new Set<MetricKey>(["uniqueBuyers", "buySellCountRatio", "buySellSolRatio", "sniperPct", "freshWalletPct"]);

function Cell({ title, children, help, partial }: { title: string; children: React.ReactNode; help?: string; partial?: boolean }) {
  return (
    <div className="card-sm flex flex-col p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={statLabel} title={help}>
          {title}
        </h3>
        {partial && <span className="tag tag-accent">Still reading trades</span>}
      </div>
      {children}
    </div>
  );
}

function MetricCell({ card, group, bucket, note, partial }: { card: MetricCard; group: GroupKey; bucket: string; note?: string; partial?: boolean }) {
  const meta = METRIC_META[card.key];
  const g = card.groups[group];
  return (
    <Cell title={meta.label} help={meta.short} partial={partial}>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="num text-stat">{card.value === null ? "–" : meta.format(card.value)}</p>
        <Sparkline points={card.spark} label={meta.label} />
      </div>
      <div className="mt-4">
        <MetricBar percentile={g.percentile} inverted={meta.lowerIsBetter} label={meta.label} />
      </div>
      <p className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-label text-muted">
        <span>{percentileText(g.percentile, g.sampleSize, bucket)}</span>
        {g.median !== null && <span className="num">median {meta.format(g.median)}</span>}
      </p>
      {meta.lowerIsBetter && g.percentile !== null && <p className="mt-1 text-label text-muted">Lower is healthier; the bar is flipped so right is healthier.</p>}
      {note && <p className="mt-1 text-label text-muted">{note}</p>}
    </Cell>
  );
}

function BuySellCell({ view, group, bucket }: { view: CoinView; group: GroupKey; bucket: string }) {
  const byCount = view.metrics.find((m) => m.key === "buySellCountRatio")!;
  const bySol = view.metrics.find((m) => m.key === "buySellSolRatio")!;
  const l = view.latest;
  return (
    <Cell title="Buys and sells" partial={l?.tradesState === "catching-up"}>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="num text-stat">
          {l?.buys != null ? fmtInt(l.buys) : "–"}
          <span className="text-muted"> / </span>
          {l?.sells != null ? fmtInt(l.sells) : "–"}
        </p>
        <Sparkline points={byCount.spark} label="Buys per sell" />
      </div>
      <p className="num mt-1 text-label text-muted">{l?.sells === 0 ? "No sells yet" : <>{fmtRatio(byCount.value)} by count; {fmtRatio(bySol.value)} by SOL</>}</p>
      <div className="mt-4">
        <MetricBar percentile={byCount.groups[group].percentile} label="Buys per sell" />
      </div>
      <p className="mt-2 text-label text-muted">{percentileText(byCount.groups[group].percentile, byCount.groups[group].sampleSize, bucket)} (by count)</p>
    </Cell>
  );
}

function DevCell({ view, group, bucket }: { view: CoinView; group: GroupKey; bucket: string }) {
  const hold = view.metrics.find((m) => m.key === "devHoldPct")!;
  const d = view.latest?.dev;
  const reading = view.latest?.tradesState === "catching-up";
  return (
    <Cell title="Creator wallet">
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="num text-stat">{d?.holdPct != null ? fmtPct(d.holdPct) : "–"}</p>
        <Sparkline points={hold.spark} label="Creator holds" />
      </div>
      <p className="mt-1 text-label text-muted">
        of supply held.{" "}
        {d?.sold === null || d?.sold === undefined ? (
          "Sells not known yet."
        ) : d.sold ? (
          <span className="num">
            Has sold {fmtSol(d.soldSol ?? 0)} SOL worth ({fmtPct(d.soldPct ?? 0)} of supply){reading ? " in the trades read so far" : ""}.
          </span>
        ) : reading ? (
          "No sells in the trades read so far."
        ) : (
          "No sells so far."
        )}
      </p>
      <div className="mt-4">
        <MetricBar percentile={hold.groups[group].percentile} inverted label="Creator holds" />
      </div>
      <p className="mt-2 text-label text-muted">{percentileText(hold.groups[group].percentile, hold.groups[group].sampleSize, bucket)}</p>
    </Cell>
  );
}

function TrajectoryPanel({ view, group }: { view: CoinView; group: GroupKey }) {
  const [metric, setMetric] = useState<"holders" | "mcapSol">("holders");
  const coin = view.trajectory.coin.map((p) => ({ age: p.age, value: p[metric] })).filter((p): p is { age: number; value: number } => p.value !== null);
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Against {GROUP_LABEL[group]}</p>
          <h2 className="mt-3 text-title">Trajectory</h2>
        </div>
        <div role="radiogroup" aria-label="Chart metric" className="seg">
          {(
            [
              ["holders", "Holders"],
              ["mcapSol", "Market cap"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={metric === k} onClick={() => setMetric(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="card mt-5 p-4 sm:p-6">
        {coin.length === 0 && view.trajectory.bands[group][metric].length === 0 ? (
          <p className="py-6 text-small text-muted">No readings yet. The first fixed-age reading is at 5 minutes.</p>
        ) : (
          <TrajectoryChart coin={coin} band={view.trajectory.bands[group][metric]} metric={metric} groupLabel={GROUP_LABEL[group]} />
        )}
      </div>
    </div>
  );
}

function ShareButton({ name, symbol }: { name: string; symbol: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const url = window.location.href.split("?")[0];
        try {
          if (navigator.share) await navigator.share({ title: `${name} ($${symbol}) on Yardstick`, url });
          else {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }
        } catch {}
      }}
      className={linkPill}
    >
      <Share2 size={12} aria-hidden /> {copied ? "Link copied" : "Share"}
    </button>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-page px-gutter pt-[calc(var(--header-h)+2rem)] md:pt-[calc(var(--header-h)+3rem)]" aria-busy="true" aria-label="Loading coin">
      <div className="flex items-end gap-6">
        <div className="skeleton size-24 rounded-3xl sm:size-28" />
        <div className="flex-1 space-y-3">
          <div className="skeleton h-12 w-72 max-w-full" />
          <div className="skeleton h-4 w-36" />
        </div>
      </div>
      <p className="mt-8 text-small text-muted">Reading this coin from Solana. A coin we haven&apos;t seen before takes a few seconds.</p>
      <div className="skeleton mt-6 h-56 rounded-card" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-44 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
