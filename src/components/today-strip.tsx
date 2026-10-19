"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { fmtInt } from "@/lib/format";

type Stats = { launches: number; medianHolders1h: number | null; holders1hSample: number; graduated: number };

/** Live numbers for today (UTC). Never shows placeholder figures: skeleton, then real data or an empty state. */
export function TodayStrip() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api<{ stats: Stats }>("/api/stats/today").then((r) => (r.ok ? setStats(r.stats) : setFailed(true)));
  }, []);

  if (failed) {
    return <p className="rounded-lg bg-surface p-6 text-muted ring-1 ring-rule">Today&apos;s numbers couldn&apos;t load. Refresh to try again.</p>;
  }
  if (!stats) {
    return (
      <div className="grid gap-3 sm:grid-cols-3" aria-busy="true" aria-label="Loading today's numbers">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg bg-surface p-6 ring-1 ring-rule">
            <div className="skeleton h-14 w-24" />
            <div className="skeleton mt-4 h-3 w-40" />
          </div>
        ))}
      </div>
    );
  }
  if (stats.launches === 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-6 rounded-lg bg-surface p-6 ring-1 ring-rule md:p-8">
        <p className="text-title">No launches yet today. Be the first.</p>
        <Link href="/launch" className="btn btn-primary">
          Launch a coin
        </Link>
      </div>
    );
  }
  const items = [
    { value: fmtInt(stats.launches), label: stats.launches === 1 ? "launch today" : "launches today" },
    {
      value: stats.medianHolders1h === null ? "–" : fmtInt(stats.medianHolders1h),
      label: stats.medianHolders1h === null ? "median holders at 1h (none an hour old yet)" : `median holders at 1h (${stats.holders1hSample} coins)`,
    },
    { value: fmtInt(stats.graduated), label: "graduated today" },
  ];
  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      {items.map((it) => (
        <div key={it.label} className="flex flex-col-reverse rounded-lg bg-surface p-6 ring-1 ring-rule">
          <dt className="mt-2 text-sm text-muted">{it.label}</dt>
          <dd className="num text-[clamp(3rem,2rem+3vw,4.5rem)] leading-none font-extrabold tracking-[-0.04em]">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
