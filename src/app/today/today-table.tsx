"use client";
import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CoinImage } from "@/components/coin-image";
import { CheckCoinButton } from "@/components/command-search";
import { PercentileBar } from "@/components/percentile-bar";
import { api } from "@/lib/client/api";
import { AGE_BUCKETS, type AgeBucketKey, type GroupKey } from "@/lib/config";
import type { RankRow } from "@/lib/data/lists";
import { fmtAge, fmtInt, fmtPct, fmtSol } from "@/lib/format";
import { GROUP_LABEL } from "@/lib/metrics-meta";

type SortKey = "percentile" | "ageSeconds" | "holders" | "netInflowSol" | "curveProgress";

export function TodayTable() {
  const [range, setRange] = useState<"today" | "7d">("today");
  const [group, setGroup] = useState<GroupKey>("baseline");
  const [graduated, setGraduated] = useState(false);
  // "all", or one fixed snapshot age: a coin matches the age its latest reading is compared at.
  const [age, setAge] = useState<"all" | AgeBucketKey>("all");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "percentile", desc: true });
  const [rows, setRows] = useState<RankRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(null);
    api<{ rows: RankRow[] }>(`/api/today?range=${range}&group=${group}${graduated ? "&graduated=1" : ""}`).then((r) => (r.ok ? (setRows(r.rows), setError(null)) : setError(r.error.message)));
  }, [range, group, graduated]);

  const shown = useMemo(() => {
    if (!rows) return null;
    const out = rows.filter((r) => age === "all" || r.bucket === age);
    // Missing values (e.g. "Not enough data yet") always sort last, whichever direction.
    out.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av === null || bv === null) return av === bv ? 0 : av === null ? 1 : -1;
      return sort.desc ? bv - av : av - bv;
    });
    return out;
  }, [rows, age, sort]);

  const th = (key: SortKey, label: string, cls = "") => (
    <th scope="col" className={`py-3 font-normal ${cls}`} aria-sort={sort.key === key ? (sort.desc ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : true }))} className="inline-flex min-h-8 items-center gap-1 rounded-md font-mono text-mono tracking-[0.12em] uppercase transition-opacity duration-(--dur-fast) hover:opacity-50">
        {label}
        {sort.key === key && (sort.desc ? <ArrowDown size={12} strokeWidth={2.5} aria-hidden /> : <ArrowUp size={12} strokeWidth={2.5} aria-hidden />)}
      </button>
    </th>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-label="Time range" className="seg">
          {(
            [
              ["today", "Today"],
              ["7d", "Last 7 days"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={range === k} onClick={() => setRange(k)}>
              {l}
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Rank against" className="seg">
          {(["baseline", "yardstick"] as GroupKey[]).map((g) => (
            <button key={g} type="button" role="radio" aria-checked={group === g} onClick={() => setGroup(g)}>
              {g === "baseline" ? "Baseline" : GROUP_LABEL[g]}
            </button>
          ))}
        </div>
        <label className="inline-flex min-h-[2.375rem] cursor-pointer items-center gap-2 rounded-field bg-tint px-3 text-[0.8125rem] font-medium">
          <input type="checkbox" checked={graduated} onChange={(e) => setGraduated(e.target.checked)} className="h-4 w-4 accent-(--primary)" />
          Graduated only
        </label>
        <label className="inline-flex items-center gap-2 sm:ml-auto">
          <span className="font-mono text-mono tracking-[0.12em] text-muted uppercase">Age</span>
          <select value={age} onChange={(e) => setAge(e.target.value as typeof age)} className="field w-auto pr-9 font-medium">
            <option value="all">Any age</option>
            {AGE_BUCKETS.map((b) => (
              <option key={b.key} value={b.key}>
                {b.key}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6">
        {error ? (
          <p className="card p-6 text-muted">{error}</p>
        ) : !shown ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-16 rounded-2xl" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="card flex flex-wrap items-center justify-between gap-6 p-6 md:p-8">
            <div className="max-w-xl">
              <p className="text-title">{graduated ? "No graduated Yardstick launches in this range yet." : range === "today" ? "No launches yet today. Be the first." : "No launches in the last 7 days."}</p>
              <p className="mt-2 text-small text-muted">
                {graduated ? "A coin graduates when its bonding curve fills." : "The table starts fresh at UTC midnight."} Launch a coin to put it on the board, or check where any pump.fun coin stands.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/launch" className="btn btn-primary">
                Launch a coin
              </Link>
              <CheckCoinButton className="btn btn-outline" />
            </div>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="card hidden px-6 pb-2 md:block">
              <table className="w-full text-left">
                <caption className="sr-only">Yardstick launches ranked by standing among {GROUP_LABEL[group]}</caption>
                <thead className="text-muted">
                  <tr className="border-b border-rule">
                    <th scope="col" className="w-12 py-3 font-mono text-mono font-normal tracking-[0.12em] uppercase">
                      #
                    </th>
                    <th scope="col" className="py-3 font-mono text-mono font-normal tracking-[0.12em] uppercase">
                      Coin
                    </th>
                    {th("ageSeconds", "Age")}
                    {th("holders", "Holders", "text-right")}
                    {th("netInflowSol", "Net SOL in", "text-right")}
                    {th("curveProgress", "Curve", "text-right")}
                    {th("percentile", "Standing", "w-64 pl-8")}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r, i) => (
                    <tr key={r.mint} className="border-b border-rule text-small transition-colors duration-(--dur-fast) last:border-0 hover:bg-tint/60">
                      <td className="num py-4 font-mono text-mono text-muted">{String(i + 1).padStart(2, "0")}</td>
                      <td className="py-4">
                        <CoinCell r={r} />
                      </td>
                      <td className="num py-4 text-muted">{fmtAge(r.ageSeconds)}</td>
                      <td className="num py-4 text-right font-medium">{fmtInt(r.holders)}</td>
                      <td className="num py-4 text-right font-medium">{fmtSol(r.netInflowSol)}</td>
                      <td className="num py-4 text-right font-medium">{r.graduated ? "done" : fmtPct(r.curveProgress)}</td>
                      <td className="py-4 pl-8">
                        <Standing r={r} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phones: stacked cards */}
            <ol className="space-y-3 md:hidden">
              {shown.map((r, i) => (
                <li key={r.mint} className="card-sm p-4">
                  <div className="flex items-start gap-3">
                    <span className="num w-6 pt-3 font-mono text-mono text-muted">{String(i + 1).padStart(2, "0")}</span>
                    <div className="min-w-0 flex-1">
                      <CoinCell r={r} />
                      <dl className="num mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-small">
                        <div>
                          <dt className="font-mono text-mono tracking-[0.12em] text-muted uppercase">Age</dt>
                          <dd className="font-medium">{fmtAge(r.ageSeconds)}</dd>
                        </div>
                        <div>
                          <dt className="font-mono text-mono tracking-[0.12em] text-muted uppercase">Holders</dt>
                          <dd className="font-medium">{fmtInt(r.holders)}</dd>
                        </div>
                        <div>
                          <dt className="font-mono text-mono tracking-[0.12em] text-muted uppercase">Net SOL in</dt>
                          <dd className="font-medium">{fmtSol(r.netInflowSol)}</dd>
                        </div>
                        <div>
                          <dt className="font-mono text-mono tracking-[0.12em] text-muted uppercase">Curve</dt>
                          <dd className="font-medium">{r.graduated ? "done" : fmtPct(r.curveProgress)}</dd>
                        </div>
                      </dl>
                      <div className="mt-4">
                        <Standing r={r} />
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}

function CoinCell({ r }: { r: RankRow }) {
  return (
    <Link href={`/coin/${r.mint}`} className="group flex items-center gap-3">
      <CoinImage src={r.image} symbol={r.symbol} size={40} className="h-10 w-10 rounded-xl" />
      <span className="min-w-0">
        <span className="block truncate font-medium group-hover:underline group-hover:underline-offset-4">{r.name}</span>
        <span className="block font-mono text-mono text-muted">
          ${r.symbol}
          {r.graduated && <span className="ml-2 text-up">graduated</span>}
        </span>
      </span>
    </Link>
  );
}

function Standing({ r }: { r: RankRow }) {
  if (r.percentile === null) return <span className="text-small text-muted">Not enough data yet</span>;
  return (
    <div>
      <div className="num mb-1 font-medium text-primary-ink">Top {Math.max(1, Math.round(100 - r.percentile))}%</div>
      <PercentileBar percentile={r.percentile} label={`${r.name} standing`} />
    </div>
  );
}
