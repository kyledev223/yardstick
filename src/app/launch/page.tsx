import type { Metadata } from "next";
import { LaunchForm } from "./launch-form";

export const metadata: Metadata = { title: "Launch a coin" };

export default function LaunchPage() {
  return (
    <div className="mx-auto max-w-page px-gutter pt-6 md:pt-10">
      <h1 className="text-display">
        Launch a <span className="pill pill-teal">coin</span>
      </h1>
      <p className="mt-6 max-w-measure text-lead text-muted">
        Your coin is created on pump.fun from your own wallet. <strong className="font-semibold text-ink">No platform fee:</strong> you pay only Solana network fees and pump.fun&apos;s creation cost.
        The coin&apos;s key is generated in this browser and never leaves it.
      </p>
      <div className="mt-10">
        <LaunchForm />
      </div>
      <p className="mt-12 max-w-measure text-sm text-muted">
        <strong className="font-semibold text-ink">Not advice.</strong> Launching a coin isn&apos;t an investment, and Yardstick&apos;s comparisons aren&apos;t advice. Most meme coins lose all their
        value. Never share your recovery phrase with anyone; Yardstick will never ask for it.
      </p>
    </div>
  );
}
