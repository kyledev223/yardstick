import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AGE_BUCKETS, DATA } from "@/lib/config";
import { fmtInt } from "@/lib/format";
import { healthReport } from "@/lib/health";

export const metadata: Metadata = { title: "Status", description: "Whether Yardstick's database, Solana connection and background measuring are working." };

// Shapes of the parts of healthReport().checks this page reads. Hostnames, keys and raw errors are never shown.
type Check = { ok: boolean; ms: number };
type Tick = { minutesAgo: number; durationMs: number | null; ok: boolean; yardstickSnapshots: { due?: number; done?: number } | null; baselineSnapshots: { due?: number; done?: number } | null } | null;
type Lut = { configured: false } | { configured: true; ok: boolean; frozen?: boolean } | null;
type Usage = { creditsToday: number; budget: number; baselineDailyTarget: number; last7Days: { day: string; credits: number; calls: number; errors: number; baselineSampled: number }[] };
type Samples = { perAge: Record<"baseline" | "yardstick", Record<string, number>> };

type State = "ok" | "problem" | "info";
const STATE = {
  ok: { word: "Working", dot: "bg-up" },
  problem: { word: "Needs attention", dot: "bg-down" },
  info: { word: "Not set up", dot: "bg-rule-strong" },
} as const;

function Card({ title, state, children }: { title: string; state: State; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-lg bg-surface p-5 ring-1 ring-rule">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-bold tracking-normal">{title}</h3>
        <span className="inline-flex min-h-7 shrink-0 items-center gap-2 rounded-pill bg-sunk px-3 text-micro font-bold">
          <span className={`h-2.5 w-2.5 rounded-pill ${STATE[state].dot}`} aria-hidden />
          {STATE[state].word}
        </span>
      </div>
      <div className="mt-2 text-sm text-muted">{children}</div>
    </div>
  );
}

const ago = (min: number) => (min < 1 ? "less than a minute ago" : min < 90 ? `${min} min ago` : `${Math.round(min / 60)} h ago`);

export default async function StatusPage() {
  await connection();
  const r = await healthReport();
  const c = r.checks as Record<string, unknown>;
  const db = c.database as Check;
  const rpc = (c.rpc as Check[]) ?? [];
  const sdk = c.pumpSdk as Check;
  const ipfs = c.pumpIpfs as Check;
  const lut = c.lookupTable as Lut;
  const tick = (c.tick as Tick) ?? null;
  const dist = (c.distributions as { minutesAgo: number } | null) ?? null;
  const price = (c.solPrice as { usd: number; ageMinutes: number } | null) ?? null;
  const usage = (c.rpcUsage as Usage | undefined) ?? null;
  const samples = (c.samples as Samples | undefined) ?? null;
  const rpcUp = rpc.filter((x) => x.ok).length;
  const tickState: State = !tick ? "info" : !tick.ok || tick.minutesAgo > 15 ? "problem" : "ok";

  return (
    <div className="mx-auto max-w-page px-gutter pt-6 md:pt-10">
      <h1 className="text-display">
        System <span className={`pill ${r.ok ? "pill-teal" : "pill-coral"}`}>status</span>
      </h1>
      <p className="mt-6 max-w-measure text-lead">
        <strong className="font-semibold">{r.ok ? "Yardstick is working." : "Part of Yardstick isn't working right now."}</strong>{" "}
        <span className="text-muted">
          {r.hints.length ? `${r.hints.length} note${r.hints.length === 1 ? "" : "s"} below.` : "Nothing needs attention."} Checked just now; reload to check again.
        </span>
      </p>

      <section aria-labelledby="services-h" data-field="quiet" className="mt-section-sm">
        <h2 id="services-h" className="text-headline">
          Services
        </h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card title="Database" state={db?.ok ? "ok" : "problem"}>
            {db?.ok ? "Answering." : "Not answering. Launches, dashboards and rankings can't load."}
          </Card>
          <Card title="Solana connection" state={rpcUp === 0 ? "problem" : rpc[0]?.ok ? "ok" : "problem"}>
            <span className="num">
              {rpcUp} of {rpc.length}
            </span>{" "}
            endpoint{rpc.length === 1 ? "" : "s"} answering{rpcUp > 0 && !rpc[0]?.ok ? "; using a fallback." : "."}
          </Card>
          <Card title="Launch builder" state={sdk?.ok ? "ok" : "problem"}>
            {sdk?.ok ? "pump.fun's software loads and can build a create transaction." : "Can't build launch transactions right now."}
          </Card>
          <Card title="Image and metadata upload" state={ipfs?.ok ? "ok" : "problem"}>
            {ipfs?.ok ? "pump.fun's upload service is reachable." : "pump.fun's upload service isn't reachable from the server."}
          </Card>
          <Card title="Dev-buy launches" state={!lut || !lut.configured ? "info" : lut.ok && lut.frozen ? "ok" : "problem"}>
            {!lut || !lut.configured
              ? "Launches without a dev buy work. Launches with a dev buy may be too large until the site's lookup table is set."
              : lut.ok
                ? `The site's lookup table is in use${lut.frozen ? " and frozen" : " but not frozen"}.`
                : "The configured lookup table can't be used."}
          </Card>
          <Card title="SOL price" state={price ? "ok" : "info"}>
            {price ? (
              <>
                <span className="num">${price.usd.toFixed(2)}</span>, updated {ago(price.ageMinutes)}.
              </>
            ) : (
              "No price stored yet; USD values are hidden until it arrives."
            )}
          </Card>
        </div>
      </section>

      <section aria-labelledby="measuring-h" data-field="quiet" className="mt-section-sm">
        <h2 id="measuring-h" className="text-headline">
          Measuring
        </h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card title="Background job" state={tickState}>
            {!tick ? (
              "Has never run. It's started every 5 minutes by cron-job.org."
            ) : (
              <>
                Last ran {ago(tick.minutesAgo)}
                {tick.durationMs !== null && (
                  <>
                    , took <span className="num">{(tick.durationMs / 1000).toFixed(1)} s</span>
                  </>
                )}
                {tick.ok ? "." : ", and failed."}
              </>
            )}
          </Card>
          <Card title="Snapshots in the last run" state={tick ? "ok" : "info"}>
            {tick ? (
              <span className="num">
                Yardstick coins {tick.yardstickSnapshots?.done ?? 0} of {tick.yardstickSnapshots?.due ?? 0} due · baseline {tick.baselineSnapshots?.done ?? 0} of {tick.baselineSnapshots?.due ?? 0} due
              </span>
            ) : (
              "None yet."
            )}
          </Card>
          <Card title="Comparison data" state={!dist ? "info" : dist.minutesAgo > 90 ? "problem" : "ok"}>
            {dist ? <>Percentiles were recalculated {ago(dist.minutesAgo)} (hourly).</> : "Not calculated yet."}
          </Card>
        </div>

        {usage && (
          <div className="mt-8 overflow-x-auto rounded-lg bg-surface px-5 ring-1 ring-rule">
            <table className="num w-full min-w-[34rem] text-left text-sm">
              <caption className="pt-5 pb-1 text-left font-sans">
                <span className="block text-base font-bold text-ink">Data use, last 7 days (UTC)</span>
                <span className="text-muted">
                  Credits are counted on Helius only (the public endpoint is free), against a budget of {fmtInt(usage.budget)} a day. Target: {fmtInt(usage.baselineDailyTarget)} baseline coins a day.
                </span>
              </caption>
              <thead>
                <tr className="border-b-2 border-ink">
                  <th className="py-3 font-sans font-bold">Day</th>
                  <th className="py-3 text-right font-sans font-bold">Credits</th>
                  <th className="py-3 text-right font-sans font-bold">Requests</th>
                  <th className="py-3 text-right font-sans font-bold">Failed requests</th>
                  <th className="py-3 text-right font-sans font-bold">Baseline coins sampled</th>
                </tr>
              </thead>
              <tbody>
                {usage.last7Days.map((d) => (
                  <tr key={d.day} className="border-b border-rule last:border-0">
                    <td className="py-3">{d.day}</td>
                    <td className="py-3 text-right font-semibold">
                      {fmtInt(d.credits)} <span className="font-normal text-muted">({Math.round((d.credits / usage.budget) * 100)}%)</span>
                    </td>
                    <td className="py-3 text-right">{fmtInt(d.calls)}</td>
                    <td className="py-3 text-right">{fmtInt(d.errors)}</td>
                    <td className="py-3 text-right font-semibold">{fmtInt(d.baselineSampled)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {samples && (
          <div className="mt-3 overflow-x-auto rounded-lg bg-surface px-5 ring-1 ring-rule">
            <table className="num w-full min-w-[40rem] text-left text-sm">
              <caption className="pt-5 pb-1 text-left font-sans">
                <span className="block text-base font-bold text-ink">Coins measured at each age, last 7 days</span>
                <span className="text-muted">Percentiles appear at an age once a group has {DATA.minSampleForPercentile} coins there.</span>
              </caption>
              <thead>
                <tr className="border-b-2 border-ink">
                  <th className="py-3 font-sans font-bold">Group</th>
                  {AGE_BUCKETS.map((b) => (
                    <th key={b.key} className="py-3 text-right font-bold">
                      {b.key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(["baseline", "yardstick"] as const).map((g) => (
                  <tr key={g} className="border-b border-rule last:border-0">
                    <td className="py-3 font-sans">{g === "baseline" ? "pump.fun baseline" : "Yardstick launches"}</td>
                    {AGE_BUCKETS.map((b) => {
                      const n = samples.perAge[g]?.[b.key] ?? 0;
                      return (
                        <td key={b.key} className={`py-3 text-right ${n >= DATA.minSampleForPercentile ? "font-bold" : "text-muted"}`}>
                          {fmtInt(n)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="notes-h" className="mt-section-sm">
        <h2 id="notes-h" className="text-headline">
          Notes
        </h2>
        {r.hints.length === 0 ? (
          <p className="mt-6 rounded-lg bg-surface p-5 text-muted ring-1 ring-rule">Nothing needs attention.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {r.hints.map((h) => (
              <li key={h} className="rounded-lg bg-surface p-5 ring-1 ring-rule">
                {h}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 text-sm text-muted">
          For the site owner: the same checks as JSON are at{" "}
          <Link href="/api/health" className="font-semibold text-teal-ink underline underline-offset-4">
            /api/health
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
