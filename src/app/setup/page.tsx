import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHead } from "@/components/page-head";
import { LookupTableSetup } from "./lookup-table-setup";

export const metadata: Metadata = { title: "Site setup", robots: { index: false } };

/**
 * One-time owner task, local only: run `npm run dev` and open http://localhost:3000/setup.
 * The table is created on mainnet from the owner's wallet, so it works for the deployed site too.
 */
export default function SetupPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <>
      <PageHead
        eyebrow="Site setup · local only"
        title="Lookup table."
        note="For the site owner, once. A launch with a dev buy needs more accounts than fit in a basic Solana transaction. A lookup table lets the transaction refer to pump.fun's fixed accounts by a short index, so it fits. This page only runs on a local copy of the site; the deployed site returns “not found”."
      />
      <div className="mx-auto mt-12 max-w-text px-gutter">
        <div className="max-w-3xl">
          <LookupTableSetup />
        </div>
      </div>
    </>
  );
}
