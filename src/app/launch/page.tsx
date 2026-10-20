import type { Metadata } from "next";
import { PageHead } from "@/components/page-head";
import { LaunchForm } from "./launch-form";

export const metadata: Metadata = { title: "Launch a coin" };

export default function LaunchPage() {
  return (
    <>
      <PageHead
        eyebrow="Launch a coin"
        title="From idea to a live coin."
        note="Your coin is created on pump.fun from your own wallet. No platform fee: you pay only Solana network fees and pump.fun's creation cost. The coin's key is generated in this browser and never leaves it."
      />
      <div className="mx-auto mt-12 max-w-text px-gutter md:mt-16">
        <LaunchForm />
        <p className="mt-8 max-w-measure text-label text-muted">
          <strong className="font-medium text-ink">Not advice.</strong> Launching a coin isn&apos;t an investment, and Yardstick&apos;s comparisons aren&apos;t advice. Most meme coins lose all their
          value. Never share your recovery phrase with anyone; Yardstick will never ask for it.
        </p>
      </div>
    </>
  );
}
