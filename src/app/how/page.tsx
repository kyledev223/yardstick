import type { Metadata } from "next";
import { PageHead } from "@/components/page-head";
import { StepList } from "@/components/step-list";
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

const STEPS = [
  { label: "Launch", text: "A name, a symbol and an image, then one transaction from your own wallet creates the coin on pump.fun." },
  { label: "Measure", text: "From five minutes old, Yardstick reads holders, buyers, net SOL in, the curve and warning signs at fixed ages." },
  { label: "Compare", text: "Each reading is ranked against pump.fun coins and Yardstick launches of exactly the same age." },
  { label: "Improve", text: "Plain notes point at the metrics where your coin trails coins that went on to graduate." },
];

/** A section with a numbered mono label and its heading on the left, content on the right, under a rule. */
function Section({ id, n, title, children }: { id: string; n: number; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="grid gap-6 border-t border-rule pt-8 lg:grid-cols-12 lg:gap-10" aria-labelledby={`${id}-h`}>
      <div className="lg:col-span-4">
        <p className="font-mono text-mono text-muted uppercase">{String(n).padStart(2, "0")} / Method</p>
        <h2 id={`${id}-h`} className="mt-4 text-[clamp(1.75rem,1.4rem+1.4vw,2.5rem)] leading-none tracking-[-0.05em]">
          {title}
        </h2>
      </div>
      <div className="min-w-0 space-y-4 lg:col-span-8">{children}</div>
    </section>
  );
}

export default function HowPage() {
  return (
    <article>
      <PageHead eyebrow="How it works" title="How Yardstick measures." note="Being open about the method is part of the product. Here is everything the numbers are built from, including their limits." />
      <div className="mx-auto max-w-text px-gutter">
      <StepList steps={STEPS} className="mt-16" />

      <div className="mt-24 space-y-24">
        <Section id="age" n={1} title={<>What &ldquo;same age&rdquo; means</>}>
          <p className="max-w-measure text-lead">
            Coins are measured at fixed ages after creation: <span className="num font-medium">{AGE_BUCKETS.map((b) => b.key).join(", ")}</span>. A reading counts for an age only if it was taken
            within a short window after it (5 minutes, or a quarter of the age, whichever is longer). A coin that&apos;s 2h 14m old is compared with coins measured at 2h, the nearest fixed age.
          </p>
          <p className="max-w-measure text-muted">
            When a coin graduates, its final reading is carried forward to the later ages. Without that, the comparison at 24h would quietly leave out the coins that did best.
          </p>
        </Section>

        <Section id="groups" n={2} title={<>Who you&apos;re compared with</>}>
          <ul className="grid gap-3 md:grid-cols-2">
            <li className="card-sm p-5">
              <p className="font-medium">pump.fun baseline</p>
              <p className="mt-2 text-small text-muted">
                A random sample of newly created pump.fun coins, found by reading pump&apos;s create transactions on-chain. Thousands of coins launch every day, so Yardstick samples a few hundred at
                most (fewer on quiet RPC days) and measures them exactly like its own launches. Only SOL-priced, standard coins are sampled, to match what Yardstick launches.
              </p>
            </li>
            <li className="card-sm p-5">
              <p className="font-medium">Yardstick launches</p>
              <p className="mt-2 text-small text-muted">Every coin launched through this site.</p>
            </li>
          </ul>
          <p className="max-w-measure text-muted">Both use a rolling 7-day window, and every percentile shows how many coins it&apos;s based on.</p>
        </Section>

        <Section id="metrics" n={3} title="The metrics">
          <dl className="grid gap-3 md:grid-cols-2">
            {METRICS.map((m) => (
              <div key={m} className="card-sm p-5">
                <dt className="font-medium">{METRIC_META[m].label}</dt>
                <dd className="mt-2 text-small text-muted">
                  {METRIC_META[m].how}
                  {METRIC_META[m].lowerIsBetter && " Lower is healthier, so its bar is flipped."}
                </dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="score" n={4} title="The composite score">
          <p className="max-w-measure">
            For a coin at a given age, each metric becomes a percentile among the comparison group at that age. The score is a weighted average of those percentiles; for metrics where lower is
            healthier, 100 minus the percentile is used. The headline &ldquo;Top X%&rdquo; is where that score falls among the scores of the same group, so it&apos;s a real percentile, not an average of
            averages.
          </p>
          <div className="panel overflow-x-auto px-6 py-2">
            <table className="num w-full min-w-[28rem] text-left">
              <thead>
                <tr className="border-b border-panel-muted/30 text-panel-muted">
                  <th className="py-3 font-mono text-mono font-normal tracking-[0.12em] uppercase">Metric</th>
                  <th className="py-3 text-right font-mono text-mono font-normal tracking-[0.12em] uppercase">Weight</th>
                  <th className="py-3 pl-6 font-mono text-mono font-normal tracking-[0.12em] uppercase">Direction</th>
                </tr>
              </thead>
              <tbody>
                {COMPOSITE_WEIGHTS.map((w) => (
                  <tr key={w.metric} className="border-b border-panel-muted/30 text-small last:border-0">
                    <td className="py-3 font-sans">{METRIC_META[w.metric].label}</td>
                    <td className="py-3 text-right font-medium text-panel-accent">{Math.round(w.weight * 100)}%</td>
                    <td className="py-3 pl-6 font-sans text-panel-muted">{w.inverted ? "lower is better" : "higher is better"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="max-w-measure text-small text-muted">
            Trading volume is deliberately not a factor: wash trading can inflate volume cheaply, so it can&apos;t push a coin up the table. If metrics covering less than 60% of the weight are available,
            no score is shown.
          </p>
        </Section>

        <Section id="limits" n={5} title="Limits and sampling">
          <ul className="max-w-measure list-disc space-y-3 pl-5 marker:text-primary-ink">
            <li>Yardstick runs on free data plans. Each coin&apos;s trades are read up to a cap; past it, trade-based metrics are labelled &ldquo;based on the first N trades&rdquo;.</li>
            <li>Holder counts and the top-10 share come from token accounts at the moment of reading, so they can lag the target age by a few minutes.</li>
            <li>
              Fresh-wallet share checks a sample of up to {DATA.freshSampleSize} buyers per coin. Busy wallets (25 or more transactions) are counted as not fresh, which can undercount new bot wallets.
            </li>
            <li>Coins you look up that weren&apos;t launched here are only measured while someone views them, so they have a current reading but no fixed-age history.</li>
            <li>&ldquo;Coins that graduated&rdquo; comparisons need at least {DATA.minSampleForGraduated} graduated coins at that age; otherwise the median coin is used and the note says so.</li>
          </ul>
        </Section>

        <Section id="faq" n={6} title="FAQ">
          <dl className="space-y-3">
            {FAQ.map(([q, a]) => (
              <div key={q} className="card-sm p-5">
                <dt className="font-medium">{q}</dt>
                <dd className="mt-2 text-small text-muted">{a}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>
      </div>
    </article>
  );
}
