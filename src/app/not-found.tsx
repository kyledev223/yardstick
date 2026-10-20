import Link from "next/link";
import { CheckCoinButton } from "@/components/command-search";

export default function NotFound() {
  return (
    <div className="flex min-h-[80svh] items-center px-gutter pt-header pb-24">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
        <p className="eyebrow">404 · Page not found</p>
        <h1 className="text-cta">Off the scale.</h1>
        <p className="max-w-md text-small text-muted">There&apos;s no page at this address. To check a coin, paste its mint address or search its symbol.</p>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <CheckCoinButton className="btn btn-primary" />
          <Link href="/" className="btn btn-ghost">
            Go to the home page
          </Link>
        </div>
      </div>
    </div>
  );
}
