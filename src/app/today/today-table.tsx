"use client";
import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
    <th scope="col" className={`py-3 font-bold ${cls}`} aria-sort={sort.key === key ? (sort.desc ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : true }))} className="inline-flex min-h-10 items-center gap-1 rounded-pill hover:text-teal-ink">
        {label}
        {sort.key === key && (sort.desc ? <ArrowDown size={14} strokeWidth={2.5} aria-hidden /> : <ArrowUp size={14} strokeWidth={2.5} aria-hidden />)}
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
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-pill bg-sunk px-4 font-semibold">
          <input type="checkbox" checked={graduated} onChange={(e) => setGraduated(e.target.checked)} className="h-5 w-5 accent-(--btn)" />
          Graduated only
        </label>
        <label className="inline-flex items-center gap-2 sm:ml-auto">
          <span className="font-semibold text-muted">Age</span>
          <select value={age} onChange={(e) => setAge(e.target.value as typeof age)} className="field w-auto rounded-pill py-2 pr-9 font-semibold">
            <option value="all">Any age</option>
            {AGE_BUCKETS.map((b) => (
              <option key={b.key} value={b.key}>
                {b.key}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div data-field="quiet" className="mt-6">
        {error ? (
          <p className="rounded-lg bg-surface p-6 text-muted ring-1 ring-rule">{error}</p>
        ) : !shown ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-16 rounded-lg" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-6 rounded-lg bg-surface p-6 ring-1 ring-rule md:p-8">
            <p className="text-title">{graduated ? "No graduated Yardstick launches in this range yet." : range === "today" ? "No launches yet today. Be the first." : "No launches in the last 7 days."}</p>
            <Link href="/launch" className="btn btn-primary">
              Launch a coin
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden rounded-xl bg-surface px-6 pb-2 ring-1 ring-rule md:block">
              <table className="w-full text-left">
                <caption className="sr-only">Yardstick launches ranked by standing among {GROUP_LABEL[group]}</caption>
                <thead className="text-sm text-ink">
                  <tr className="border-b-2 border-ink">
                    <th scope="col" className="w-12 py-3 font-bold">
                      #
                    </th>
                    <th scope="col" className="py-3 font-bold">
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
                    <tr key={r.mint} className="border-b border-rule last:border-0 hover:bg-soft">
                      <td className="num py-4 font-semibold text-muted">{i + 1}</td>
                      <td className="py-4">
                        <CoinCell r={r} />
                      </td>
                      <td className="num py-4 text-muted">{fmtAge(r.ageSeconds)}</td>
                      <td className="num py-4 text-right font-semibold">{fmtInt(r.holders)}</td>
                      <td className="num py-4 text-right font-semibold">{fmtSol(r.netInflowSol)}</td>
                      <td className="num py-4 text-right font-semibold">{r.graduated ? "done" : fmtPct(r.curveProgress)}</td>
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
                <li key={r.mint} className="rounded-lg bg-surface p-4 ring-1 ring-rule">
                  <div className="flex items-start gap-3">
                    <span className="num w-6 pt-2 font-semibold text-muted">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <CoinCell r={r} />
                      <dl className="num mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <dt className="font-sans text-micro text-muted">Age</dt>
                          <dd className="font-semibold">{fmtAge(r.ageSeconds)}</dd>
                        </div>
                        <div>
                          <dt className="font-sans text-micro text-muted">Holders</dt>
                          <dd className="font-semibold">{fmtInt(r.holders)}</dd>
                        </div>
                        <div>
                          <dt className="font-sans text-micro text-muted">Net SOL in</dt>
                          <dd className="font-semibold">{fmtSol(r.netInflowSol)}</dd>
                        </div>
                        <div>
                          <dt className="font-sans text-micro text-muted">Curve</dt>
                          <dd className="font-semibold">{r.graduated ? "done" : fmtPct(r.curveProgress)}</dd>
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
      {r.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={r.image} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-md object-cover ring-1 ring-rule" referrerPolicy="no-referrer" loading="lazy" />
      ) : (
        <span className="h-10 w-10 shrink-0 rounded-md bg-sunk" aria-hidden />
      )}
      <span className="min-w-0">
        <span className="block truncate font-bold group-hover:underline group-hover:underline-offset-4">{r.name}</span>
        <span className="num block text-sm text-muted">
          ${r.symbol}
          {r.graduated && <span className="ml-2 font-sans font-semibold text-up">graduated</span>}
        </span>
      </span>
    </Link>
  );
}

function Standing({ r }: { r: RankRow }) {
  if (r.percentile === null) return <span className="text-sm text-muted">Not enough data yet</span>;
  return (
    <div>
      <div className="num mb-1 font-bold">Top {Math.max(1, Math.round(100 - r.percentile))}%</div>
      <PercentileBar percentile={r.percentile} label={`${r.name} standing`} />
    </div>
  );
}
