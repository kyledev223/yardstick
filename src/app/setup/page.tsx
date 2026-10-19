import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LookupTableSetup } from "./lookup-table-setup";

export const metadata: Metadata = { title: "Site setup", robots: { index: false } };

/**
 * One-time owner task, local only: run `npm run dev` and open http://localhost:3000/setup.
 * The table is created on mainnet from the owner's wallet, so it works for the deployed site too.
 */
export default function SetupPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="mx-auto max-w-page px-gutter pt-6 md:pt-10">
      <h1 className="text-display">Site setup: lookup table</h1>
      <p className="mt-6 max-w-measure text-lead text-muted">
        For the site owner, once. A launch with a dev buy needs more accounts than fit in a basic Solana transaction. A lookup table lets the transaction refer to pump.fun&apos;s fixed
        accounts by a short index, so it fits. This page only runs on a local copy of the site; the deployed site returns &ldquo;not found&rdquo;.
      </p>
      <div className="mt-10 max-w-wide">
        <LookupTableSetup />
      </div>
    </div>
  );
}
