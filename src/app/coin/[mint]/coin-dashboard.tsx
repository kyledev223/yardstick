"use client";
import { CheckCircle2, ExternalLink, Share2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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
  look: { word: "Worth a look", dot: "bg-yellow" },
  good: { word: "Good", dot: "bg-up" },
  info: { word: "Info", dot: "bg-rule-strong" },
} as const;

const linkChip = "inline-flex min-h-10 items-center gap-1.5 rounded-pill bg-sunk px-3.5 text-sm font-semibold text-ink transition-colors duration-(--dur-fast) hover:bg-rule";

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
      <div className="mx-auto max-w-page px-gutter py-section-sm">
        <p className="text-sm font-semibold text-muted">Coin</p>
        <h1 className="mt-2 text-display">
          Can&apos;t show <span className="pill pill-coral">this coin</span>
        </h1>
        <p className="mt-6 max-w-measure text-lead text-muted">{error.message}</p>
        <p className="addr mt-3 text-sm break-all text-muted">{mint}</p>
        <Link href="/" className="btn btn-secondary mt-8">
          Check another coin
        </Link>
      </div>
    );
  }
  if (!view) return <DashboardSkeleton />;

  const { coin, latest } = view;
  const age = Math.round((now - Date.parse(coin.createdAt)) / 1000);
  const st = view.standing[group];
  const external = coin.source === "external";
  const curvePct = latest?.graduated ? 100 : (latest?.curveProgress ?? 0);

  return (
    <div data-field="quiet" className="mx-auto max-w-page px-gutter pt-4 md:pt-8">
      {launchedSig && coin.source === "yardstick" && (
        <div role="status" className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg bg-surface px-5 py-4 ring-2 ring-up">
          <CheckCircle2 size={22} className="text-up" aria-hidden />
          <span className="font-semibold">Launched. Your coin is live on pump.fun.</span>
          <a href={pumpUrl(coin.mint)} target="_blank" rel="noreferrer" className="font-semibold text-teal-ink underline underline-offset-4">
            Open on pump.fun
          </a>
          <a href={solscanTx(launchedSig)} target="_blank" rel="noreferrer" className="font-semibold text-teal-ink underline underline-offset-4">
            Transaction on Solscan
          </a>
        </div>
      )}

      {/* Header */}
      <header className="grid gap-8 md:grid-cols-12">
        <div className="flex min-w-0 gap-5 md:col-span-7">
          {coin.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coin.image} alt="" width={96} height={96} className="h-20 w-20 shrink-0 rounded-lg object-cover ring-1 ring-rule sm:h-24 sm:w-24" referrerPolicy="no-referrer" />
          ) : (
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-sunk text-3xl font-extrabold text-muted sm:h-24 sm:w-24" aria-hidden>
              {coin.symbol.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {coin.source === "yardstick" && <span className="inline-flex min-h-7 items-center rounded-pill bg-btn px-3 text-micro font-bold text-on-btn">Launched on Yardstick</span>}
              {external && <span className="chip font-semibold">Looked up</span>}
            </div>
            <h1 className="mt-2 truncate text-[clamp(2rem,1.2rem+2.6vw,3.5rem)] leading-[1.05] font-extrabold tracking-[-0.04em]">{coin.name}</h1>
            {/* Clock-based text: server and browser can be a minute apart. */}
            <p className="num mt-1 text-lead text-muted" suppressHydrationWarning>
              ${coin.symbol} · {fmtAge(age)} old
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={pumpUrl(coin.mint)} target="_blank" rel="noreferrer" className={linkChip}>
                pump.fun <ExternalLink size={14} aria-hidden />
              </a>
              <a href={solscanToken(coin.mint)} target="_blank" rel="noreferrer" className={linkChip}>
                Solscan <ExternalLink size={14} aria-hidden />
              </a>
              <Link href={`/creator/${coin.creator}`} className={linkChip}>
                Creator <span className="addr font-normal">{shortAddr(coin.creator)}</span>
              </Link>
              <ShareButton name={coin.name} symbol={coin.symbol} />
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3 md:col-span-5">
          <div className="rounded-lg bg-surface p-5 ring-1 ring-rule">
            <dt className="text-sm text-muted">Market cap</dt>
            <dd className="num mt-1 text-figure">{latest?.mcapSol != null ? `${fmtSol(latest.mcapSol)} SOL` : "–"}</dd>
            <dd className="num mt-1 text-sm text-muted">{latest?.mcapUsd != null ? fmtUsd(latest.mcapUsd) : "USD unavailable"}</dd>
          </div>
          <div className="rounded-lg bg-surface p-5 ring-1 ring-rule">
            <dt className="text-sm text-muted">Bonding curve</dt>
            <dd className="num mt-1 text-figure">{latest?.graduated ? "Graduated" : latest?.curveProgress != null ? fmtPct(latest.curveProgress) : "–"}</dd>
            <dd className="mt-3">
              <div className="relative h-2.5 overflow-hidden rounded-pill bg-sunk" role="img" aria-label={`Curve ${latest?.curveProgress ?? 0}% full`}>
                <div className="grow-in absolute inset-y-0 left-0 rounded-pill bg-data-you" style={{ width: `${curvePct}%` }} />
              </div>
            </dd>
          </div>
        </dl>
      </header>

      {external && (
        <p className="mt-6 rounded-lg bg-soft px-5 py-4 text-sm text-muted">
          <strong className="font-semibold text-ink">Looked up, not launched here.</strong> This coin is measured only while someone has this page open, so readings are less frequent and
          there&apos;s no fixed-age history.
        </p>
      )}

      {/* Comparison group */}
      <div className="mt-10 flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-muted" id="group-label">
          Compare with
        </span>
        <div role="radiogroup" aria-labelledby="group-label" className="seg">
          {(["baseline", "yardstick"] as GroupKey[]).map((g) => (
            <button key={g} type="button" role="radio" aria-checked={group === g} onClick={() => setGroup(g)}>
              {GROUP_LABEL[g]}
            </button>
          ))}
        </div>
      </div>

      {/* Standing: the hero number */}
      <section aria-labelledby="standing-h" className="mt-4 grid gap-8 rounded-xl bg-surface p-6 ring-1 ring-rule md:grid-cols-12 md:p-10">
        <div className="md:col-span-5">
          <h2 id="standing-h" className="text-sm font-semibold text-muted">
            Standing among {GROUP_LABEL[group]}
          </h2>
          {!latest ? (
            <>
              <p className="mt-3 text-display">Measuring…</p>
              <p className="mt-3 text-muted">The first reading takes a few seconds. This page refreshes on its own.</p>
            </>
          ) : st.percentile === null ? (
            <>
              <p className="mt-3 text-headline">Not enough data yet</p>
              <p className="mt-3 text-muted">{notEnoughText(st, group)}</p>
            </>
          ) : (
            <>
              <p className="mt-1 flex items-baseline gap-3">
                <span className="text-headline">Top</span>
                <span className="num text-figure-hero">{Math.max(1, Math.round(100 - st.percentile))}%</span>
              </p>
              <p className="mt-2 text-lead">of coins at {st.bucket}</p>
            </>
          )}
        </div>
        <div className="md:col-span-7 md:self-center">
          <PercentileBar percentile={st.percentile} label="Overall standing" size="lg" showScale />
          <p className="mt-4 text-sm text-muted">
            {st.sampleSize > 0 ? (
              <>
                Compared with <span className="num font-semibold text-ink">{fmtInt(st.sampleSize)}</span> {group === "baseline" ? "sampled pump.fun coins" : "Yardstick launches"} at {st.bucket}, last 7
                days. Score combines holders, buyers, net SOL in, curve progress, concentration, snipers and fresh wallets.{" "}
                <Link href="/how#score" className="font-semibold text-teal-ink underline underline-offset-4">
                  How it&apos;s calculated
                </Link>
              </>
            ) : (
              <>The bar fills in once {DATA.minSampleForPercentile} coins at this age have an overall score.</>
            )}
          </p>
        </div>
      </section>

      {/* Metrics */}
      <section aria-labelledby="metrics-h" className="mt-section-sm">
        <h2 id="metrics-h" className="text-headline">
          Metrics at {view.bucket}
        </h2>
        <p className="mt-2 max-w-measure text-sm text-muted">
          Each bar runs from weakest (left) to strongest (right) among {GROUP_LABEL[group]}. The notch is the median; the shaded part is the middle half; the dot is this coin.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(["holders", "uniqueBuyers", "netInflowSol"] as MetricKey[]).map((k) => (
            <MetricCell key={k} card={view.metrics.find((m) => m.key === k)!} group={group} bucket={view.bucket} />
          ))}
          <BuySellCell view={view} group={group} bucket={view.bucket} />
          <MetricCell card={view.metrics.find((m) => m.key === "curveProgress")!} group={group} bucket={view.bucket} />
          <MetricCell card={view.metrics.find((m) => m.key === "top10Pct")!} group={group} bucket={view.bucket} />
          <DevCell view={view} group={group} bucket={view.bucket} />
          <MetricCell card={view.metrics.find((m) => m.key === "sniperPct")!} group={group} bucket={view.bucket} />
          <MetricCell
            card={view.metrics.find((m) => m.key === "freshWalletPct")!}
            group={group}
            bucket={view.bucket}
            note={latest?.freshSampled ? `Sample of ${latest.freshSampled} buyers` : "Not sampled yet"}
          />
        </div>
        {latest?.tradesCapped && (
          <p className="mt-4 text-sm text-muted">
            Trade-based metrics are based on the first <span className="num">{fmtInt(latest.tradesCounted)}</span> trades: reading every trade of a busy coin would exceed the free data plan.
          </p>
        )}
      </section>

      {/* Trajectory + notes */}
      <section className="mt-section-sm grid gap-10 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <TrajectoryPanel view={view} group={group} />
        </div>
        <div className="lg:col-span-4">
          <h2 className="text-headline">What to look at</h2>
          <p className="mt-2 text-sm text-muted">Descriptive comparisons, not advice.</p>
          {view.notes[group].length === 0 ? (
            <p className="mt-5 rounded-lg bg-soft p-5 text-sm text-muted">Notes appear once there&apos;s enough comparison data at this age.</p>
          ) : (
            <ul className="mt-5 space-y-3">
              {view.notes[group].map((n, i) => (
                <li key={i} className="rounded-lg bg-surface p-4 text-sm ring-1 ring-rule">
                  <span className="inline-flex items-center gap-2 text-micro font-bold">
                    <span className={`h-2.5 w-2.5 rounded-pill ${NOTE_TONE[n.tone].dot}`} aria-hidden />
                    {NOTE_TONE[n.tone].word}
                  </span>
                  <p className={`mt-1.5 ${n.tone === "info" ? "text-muted" : ""}`}>{n.text}</p>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-12 text-headline">Milestones</h2>
          <ol className="mt-5 space-y-2">
            {(["holders50", "curve25", "curve50", "graduated"] as const).map((k) => {
              const m = view.milestones.find((x) => x.kind === k);
              return (
                <li key={k} className="flex items-start gap-3 rounded-lg bg-surface p-4 text-sm ring-1 ring-rule">
                  <span className={`mt-1 h-3 w-3 shrink-0 rounded-pill ${m ? "bg-data-you" : "bg-sunk ring-1 ring-rule-strong"}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className={`block font-semibold ${m ? "" : "text-muted"}`}>{MILESTONE_LABEL[k]}</span>
                    <span className="num block text-muted">{m ? `at ${fmtAge((Date.parse(m.at) - Date.parse(coin.createdAt)) / 1000)} · ${utcStamp(m.at)}` : "not yet"}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <p className="mt-section-sm text-micro text-muted" suppressHydrationWarning>
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

function Cell({ title, children, help }: { title: string; children: React.ReactNode; help?: string }) {
  return (
    <div className="flex flex-col rounded-lg bg-surface p-5 ring-1 ring-rule">
      <h3 className="font-sans text-sm font-semibold tracking-normal text-muted" title={help}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function MetricCell({ card, group, bucket, note }: { card: MetricCard; group: GroupKey; bucket: string; note?: string }) {
  const meta = METRIC_META[card.key];
  const g = card.groups[group];
  return (
    <Cell title={meta.label} help={meta.short}>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="num text-figure">{card.value === null ? "–" : meta.format(card.value)}</p>
        <Sparkline points={card.spark} label={meta.label} />
      </div>
      <div className="mt-4">
        <MetricBar percentile={g.percentile} inverted={meta.lowerIsBetter} label={meta.label} />
      </div>
      <p className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-micro text-muted">
        <span>{percentileText(g.percentile, g.sampleSize, bucket)}</span>
        {g.median !== null && <span className="num">median {meta.format(g.median)}</span>}
      </p>
      {meta.lowerIsBetter && g.percentile !== null && <p className="mt-1 text-micro text-muted">Lower is healthier; the bar is flipped so right is healthier.</p>}
      {note && <p className="mt-1 text-micro text-muted">{note}</p>}
    </Cell>
  );
}

function BuySellCell({ view, group, bucket }: { view: CoinView; group: GroupKey; bucket: string }) {
  const byCount = view.metrics.find((m) => m.key === "buySellCountRatio")!;
  const bySol = view.metrics.find((m) => m.key === "buySellSolRatio")!;
  const l = view.latest;
  return (
    <Cell title="Buys and sells">
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="num text-figure">
          {l?.buys != null ? fmtInt(l.buys) : "–"}
          <span className="text-muted"> / </span>
          {l?.sells != null ? fmtInt(l.sells) : "–"}
        </p>
        <Sparkline points={byCount.spark} label="Buys per sell" />
      </div>
      <p className="num mt-1 text-micro text-muted">{l?.sells === 0 ? "No sells yet" : <>{fmtRatio(byCount.value)} by count; {fmtRatio(bySol.value)} by SOL</>}</p>
      <div className="mt-4">
        <MetricBar percentile={byCount.groups[group].percentile} label="Buys per sell" />
      </div>
      <p className="mt-2 text-micro text-muted">{percentileText(byCount.groups[group].percentile, byCount.groups[group].sampleSize, bucket)} (by count)</p>
    </Cell>
  );
}

function DevCell({ view, group, bucket }: { view: CoinView; group: GroupKey; bucket: string }) {
  const hold = view.metrics.find((m) => m.key === "devHoldPct")!;
  const d = view.latest?.dev;
  return (
    <Cell title="Creator wallet">
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="num text-figure">{d?.holdPct != null ? fmtPct(d.holdPct) : "–"}</p>
        <Sparkline points={hold.spark} label="Creator holds" />
      </div>
      <p className="mt-1 text-micro text-muted">
        of supply held.{" "}
        {d?.sold === null || d?.sold === undefined ? "Sells not known yet." : d.sold ? <span className="num">Has sold {fmtSol(d.soldSol ?? 0)} SOL worth ({fmtPct(d.soldPct ?? 0)} of supply).</span> : "No sells so far."}
      </p>
      <div className="mt-4">
        <MetricBar percentile={hold.groups[group].percentile} inverted label="Creator holds" />
      </div>
      <p className="mt-2 text-micro text-muted">{percentileText(hold.groups[group].percentile, hold.groups[group].sampleSize, bucket)}</p>
    </Cell>
  );
}

function TrajectoryPanel({ view, group }: { view: CoinView; group: GroupKey }) {
  const [metric, setMetric] = useState<"holders" | "mcapSol">("holders");
  const coin = view.trajectory.coin.map((p) => ({ age: p.age, value: p[metric] })).filter((p): p is { age: number; value: number } => p.value !== null);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-headline">Trajectory</h2>
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
      <div className="mt-5 rounded-lg bg-surface p-4 ring-1 ring-rule sm:p-6">
        {coin.length === 0 && view.trajectory.bands[group][metric].length === 0 ? (
          <p className="py-6 text-sm text-muted">No readings yet. The first fixed-age reading is at 5 minutes.</p>
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
      className={linkChip}
    >
      <Share2 size={14} aria-hidden /> {copied ? "Link copied" : "Share"}
    </button>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-page px-gutter pt-4 md:pt-8" aria-busy="true" aria-label="Loading coin">
      <div className="flex gap-5">
        <div className="skeleton h-20 w-20 rounded-lg sm:h-24 sm:w-24" />
        <div className="flex-1 space-y-3 pt-2">
          <div className="skeleton h-10 w-64 max-w-full" />
          <div className="skeleton h-4 w-36" />
        </div>
      </div>
      <p className="mt-8 text-sm text-muted">Reading this coin from Solana. A coin we haven&apos;t seen before takes a few seconds.</p>
      <div className="skeleton mt-6 h-48 rounded-xl" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton h-40 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
