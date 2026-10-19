import Link from "next/link";
import { CheckForm } from "@/components/check-form";

export default function NotFound() {
  return (
    <div data-field="full" className="px-gutter py-section-sm">
      <div className="mx-auto max-w-page">
        <p className="font-semibold text-muted">Page not found</p>
        <h1 className="mt-2 text-giant">
          Off the <span className="pill pill-coral">scale</span>
        </h1>
        <p className="mt-8 max-w-measure text-lead text-muted">There&apos;s no page at this address. To check a coin, paste its mint address.</p>
        <div className="mt-8 max-w-narrow">
          <CheckForm />
        </div>
        <Link href="/" className="btn btn-secondary mt-8">
          Go to the home page
        </Link>
      </div>
    </div>
  );
}
