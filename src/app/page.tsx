import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { CheckForm } from "@/components/check-form";
import { PercentileBar } from "@/components/percentile-bar";
import { StepDots } from "@/components/step-dots";
import { TodayStrip } from "@/components/today-strip";

/** Small, clearly labelled pieces of the real UI. They illustrate; they don't report. */
function StepFigure({ step }: { step: 1 | 2 | 3 }) {
  if (step === 1) {
    return (
      <div className="space-y-3 rounded-lg bg-surface p-5 ring-1 ring-rule" aria-hidden>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted">Name</span>
          <span className="h-3 w-28 rounded-pill bg-sunk" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted">Symbol</span>
          <span className="h-3 w-14 rounded-pill bg-sunk" />
        </div>
        <span className="btn btn-primary min-h-9 px-4 text-sm">Launch coin</span>
        <p className="text-micro text-muted">Example form</p>
      </div>
    );
  }
  if (step === 2) {
    return (
      <div className="rounded-lg bg-surface p-5 ring-1 ring-rule" aria-hidden>
        <p className="text-sm text-muted">Holders, compared at the same age</p>
        <div className="mt-4">
          <PercentileBar percentile={72} label="Example" showScale />
        </div>
        <p className="mt-3 text-micro text-muted">Example figure</p>
      </div>
    );
  }
  return (
    <div className="space-y-3 rounded-lg bg-surface p-5 text-sm ring-1 ring-rule" aria-hidden>
      <p className="flex gap-2.5">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-pill bg-yellow" />
        Top 10 wallets hold a larger share than coins that graduated did at this age.
      </p>
      <p className="flex gap-2.5 text-muted">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-pill bg-sunk" />
        No sells from the creator wallet so far.
      </p>
      <p className="text-micro text-muted">Example notes</p>
    </div>
  );
}

const STEPS = [
  { n: 1, title: "Launch", pill: "pill-teal", body: "Fill in a name, symbol and image. Your wallet signs one transaction and the coin is created on pump.fun, the same as launching there." },
  { n: 2, title: "Measure", pill: "pill-yellow", body: "From the first five minutes, the coin is compared with others of exactly the same age: Yardstick launches and a sample of all pump.fun coins." },
  { n: 3, title: "Improve", pill: "pill-coral", body: "Plain notes point at the metrics where your coin trails coins that went on to graduate, so you know what to look at next." },
] as const;

export default function Home() {
  return (
    <>
      {/* Hero: full-strength cursor field. */}
      <section data-field="full" className="px-gutter pt-section-sm pb-section-md">
        <div className="mx-auto max-w-page">
          <h1 className="text-[clamp(3rem,0.9rem+7.6vw,7.75rem)] leading-[1.06] font-extrabold tracking-[-0.045em]">
            <span className="block">
              <span className="pill pill-teal reveal-pill">Launch</span> <span className="reveal-word inline-block [--delay:120ms]">on pump.fun.</span>
            </span>
            <span className="block">
              <span className="reveal-word inline-block [--delay:240ms]">See where</span>{" "}
              <span className="pill pill-yellow reveal-pill [--delay:360ms]">you</span> <span className="reveal-word inline-block [--delay:480ms]">stand.</span>
            </span>
          </h1>

          <div className="mt-12 grid gap-10 md:mt-16 md:grid-cols-12">
            <div className="md:col-span-5">
              <p className="text-lead text-muted">
                <strong className="font-semibold text-ink">Is 140 holders after two hours good?</strong> Yardstick launches your coin on pump.fun, then shows how it compares with every other coin at
                the same age, and what to look at next.
              </p>
              <p className="mt-4 text-sm font-semibold">Free. No platform fee. Non-custodial.</p>
            </div>
            <div className="space-y-6 md:col-span-6 md:col-start-7">
              <Link href="/launch" className="btn btn-primary btn-lg">
                Launch a coin <ArrowRight size={20} strokeWidth={2.25} aria-hidden />
              </Link>
              <CheckForm />
            </div>
          </div>
        </div>
      </section>

      {/* Today: live numbers, quiet field. */}
      <section aria-labelledby="today-h" data-field="quiet" className="px-gutter py-section-sm">
        <div className="mx-auto max-w-page">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="today-h" className="text-headline">
              Today on Yardstick
            </h2>
            <Link href="/today" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-teal-ink underline-offset-4 hover:underline">
              See the full table <ArrowRight size={16} strokeWidth={2.25} aria-hidden />
            </Link>
          </div>
          <div className="mt-6">
            <TodayStrip />
          </div>
        </div>
      </section>

      {/* Three steps, numbered because they are a sequence. */}
      <section aria-labelledby="how-h" className="px-gutter py-section-md">
        <div className="mx-auto max-w-page">
          <h2 id="how-h" className="text-display">
            Launch <span className="text-muted">→</span> Measure <span className="text-muted">→</span> Improve
          </h2>
          <ol className="mt-12 grid gap-12 md:grid-cols-3 md:gap-8">
            {STEPS.map((s) => (
              <li key={s.n} className="flex flex-col">
                <div className="flex items-center gap-4">
                  <span className={`pill ${s.pill} num grid h-14 w-14 place-items-center p-0 text-title font-extrabold`} aria-hidden>
                    {s.n}
                  </span>
                  <StepDots step={s.n} of={3} />
                </div>
                <h3 className="mt-5 text-headline">
                  <span className="sr-only">Step {s.n}: </span>
                  {s.title}
                </h3>
                <p className="mt-3 max-w-measure text-muted">{s.body}</p>
                <div className="mt-6">
                  <StepFigure step={s.n} />
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Trust block. */}
      <section aria-labelledby="trust-h" className="px-gutter py-section-sm">
        <div className="mx-auto grid max-w-page gap-10 rounded-xl bg-ink p-8 text-page md:grid-cols-12 md:p-14">
          <h2 id="trust-h" className="text-display md:col-span-6">
            Free. <span className="pill pill-yellow">No fees.</span> Your coin lives on pump.fun.
          </h2>
          <ul className="space-y-5 text-lead md:col-span-5 md:col-start-8 md:self-end">
            <li>Yardstick takes no fee, no share and no referral cut. You pay only Solana network fees and pump.fun&apos;s own creation cost, from your own wallet.</li>
            <li>The site never holds your keys or funds and never asks for a recovery phrase. The new coin&apos;s key is made in your browser.</li>
            <li>Your coin is a normal pump.fun coin: it trades there and appears there like any other.</li>
          </ul>
        </div>
      </section>

      {/* Closing: full-strength field again. */}
      <section data-field="full" aria-labelledby="close-h" className="px-gutter pt-section-md pb-section-sm">
        <div className="mx-auto max-w-page">
          <h2 id="close-h" className="text-giant">
            Where do <span className="pill pill-coral">you</span> stand?
          </h2>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/launch" className="btn btn-primary btn-lg">
              Launch a coin
            </Link>
            <Link href="/how" className="btn btn-secondary btn-lg">
              How it measures
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
