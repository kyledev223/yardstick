import type { Metadata } from "next";
import { AGE_BUCKETS, COMPOSITE_WEIGHTS, DATA, METRICS } from "@/lib/config";
import { METRIC_META } from "@/lib/metrics-meta";

export const metadata: Metadata = { title: "How it works" };

const FAQ = [
  ["Is it free?", "Yes. Yardstick takes no platform fee, no fee share and no referral cut. Launching costs only the Solana network fee and pump.fun's own creation cost (about 0.02 SOL), plus any dev buy you choose, paid from your wallet."],
  ["Do you hold my keys?", "No. You sign with your own wallet. The new coin's key is generated in your browser and used once to sign the create transaction; it's never sent to the server. Yardstick never asks for a recovery phrase."],
  ["Does my coin appear on pump.fun?", "Yes. It's created by pump.fun's own program, so it trades on pump.fun and shows up there like any other coin."],
  ["Is this financial advice?", "No. Yardstick describes how coins have done at the same age. It doesn't predict prices or say what anyone should buy or sell."],
  ["Why does it say “Not enough data yet”?", `A percentile needs at least ${DATA.minSampleForPercentile} coins measured at the same age in the last 7 days. Early on, or at ages where few coins have been sampled, there isn't enough to compare against honestly.`],
] as const;

/** A section with its heading in the left columns and its content on the right. */
function Section({ id, title, children }: { id: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="grid scroll-mt-6 gap-6 border-t-2 border-ink pt-8 lg:grid-cols-12 lg:gap-10" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="text-headline lg:col-span-4">
        {title}
      </h2>
      <div className="min-w-0 space-y-4 lg:col-span-8">{children}</div>
    </section>
  );
}

export default function HowPage() {
  return (
    <article className="mx-auto max-w-page px-gutter pt-6 md:pt-10">
      <h1 className="text-display">
        How Yardstick <span className="pill pill-teal">measures</span>
      </h1>
      <p className="mt-6 max-w-measure text-lead text-muted">Being open about the method is part of the product. Here is everything the numbers are built from, including their limits.</p>

      <div className="mt-section-sm space-y-section-sm">
        <Section id="age" title={<>What &ldquo;same age&rdquo; means</>}>
          <p className="max-w-measure text-lead">
            Coins are measured at fixed ages after creation: <span className="num font-semibold">{AGE_BUCKETS.map((b) => b.key).join(", ")}</span>. A reading counts for an age only if it was taken
            within a short window after it (5 minutes, or a quarter of the age, whichever is longer). A coin that&apos;s 2h 14m old is compared with coins measured at 2h, the nearest fixed age.
          </p>
          <p className="max-w-measure text-muted">
            When a coin graduates, its final reading is carried forward to the later ages. Without that, the comparison at 24h would quietly leave out the coins that did best.
          </p>
        </Section>

        <Section id="groups" title={<>Who you&apos;re compared with</>}>
          <ul className="grid gap-3 md:grid-cols-2">
            <li className="rounded-lg bg-surface p-5 ring-1 ring-rule">
              <p className="font-bold">pump.fun baseline</p>
              <p className="mt-2 text-muted">
                A random sample of newly created pump.fun coins, found by reading pump&apos;s create transactions on-chain. Thousands of coins launch every day, so Yardstick samples a few hundred at
                most (fewer on quiet RPC days) and measures them exactly like its own launches. Only SOL-priced, standard coins are sampled, to match what Yardstick launches.
              </p>
            </li>
            <li className="rounded-lg bg-surface p-5 ring-1 ring-rule">
              <p className="font-bold">Yardstick launches</p>
              <p className="mt-2 text-muted">Every coin launched through this site.</p>
            </li>
          </ul>
          <p className="max-w-measure text-muted">Both use a rolling 7-day window, and every percentile shows how many coins it&apos;s based on.</p>
        </Section>

        <Section id="metrics" title="The metrics">
          <dl className="grid gap-3 md:grid-cols-2">
            {METRICS.map((m) => (
              <div key={m} className="rounded-lg bg-surface p-5 ring-1 ring-rule">
                <dt className="font-bold">{METRIC_META[m].label}</dt>
                <dd className="mt-2 text-muted">
                  {METRIC_META[m].how}
                  {METRIC_META[m].lowerIsBetter && " Lower is healthier, so its bar is flipped."}
                </dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="score" title="The composite score">
          <p className="max-w-measure">
            For a coin at a given age, each metric becomes a percentile among the comparison group at that age. The score is a weighted average of those percentiles; for metrics where lower is
            healthier, 100 minus the percentile is used. The headline &ldquo;Top X%&rdquo; is where that score falls among the scores of the same group, so it&apos;s a real percentile, not an average of
            averages.
          </p>
          <div className="overflow-x-auto rounded-lg bg-surface px-5 ring-1 ring-rule">
            <table className="num w-full min-w-[28rem] text-left">
              <thead>
                <tr className="border-b-2 border-ink">
                  <th className="py-3 font-sans font-bold">Metric</th>
                  <th className="py-3 text-right font-sans font-bold">Weight</th>
                  <th className="py-3 pl-6 font-sans font-bold">Direction</th>
                </tr>
              </thead>
              <tbody>
                {COMPOSITE_WEIGHTS.map((w) => (
                  <tr key={w.metric} className="border-b border-rule last:border-0">
                    <td className="py-3 font-sans">{METRIC_META[w.metric].label}</td>
                    <td className="py-3 text-right font-bold">{Math.round(w.weight * 100)}%</td>
                    <td className="py-3 pl-6 font-sans text-muted">{w.inverted ? "lower is better" : "higher is better"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="max-w-measure text-sm text-muted">
            Trading volume is deliberately not a factor: wash trading can inflate volume cheaply, so it can&apos;t push a coin up the table. If metrics covering less than 60% of the weight are available,
            no score is shown.
          </p>
        </Section>

        <Section id="limits" title="Limits and sampling">
          <ul className="max-w-measure list-disc space-y-3 pl-5 marker:text-teal">
            <li>Yardstick runs on free data plans. Each coin&apos;s trades are read up to a cap; past it, trade-based metrics are labelled &ldquo;based on the first N trades&rdquo;.</li>
            <li>Holder counts and the top-10 share come from token accounts at the moment of reading, so they can lag the target age by a few minutes.</li>
            <li>
              Fresh-wallet share checks a sample of up to {DATA.freshSampleSize} buyers per coin. Busy wallets (25 or more transactions) are counted as not fresh, which can undercount new bot wallets.
            </li>
            <li>Coins you look up that weren&apos;t launched here are only measured while someone views them, so they have a current reading but no fixed-age history.</li>
            <li>&ldquo;Coins that graduated&rdquo; comparisons need at least {DATA.minSampleForGraduated} graduated coins at that age; otherwise the median coin is used and the note says so.</li>
          </ul>
        </Section>

        <Section id="faq" title="FAQ">
          <dl className="space-y-3">
            {FAQ.map(([q, a]) => (
              <div key={q} className="rounded-lg bg-surface p-5 ring-1 ring-rule">
                <dt className="font-bold">{q}</dt>
                <dd className="mt-2 text-muted">{a}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>
    </article>
  );
}
