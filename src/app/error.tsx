"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="px-gutter py-section-sm">
      <div className="mx-auto max-w-page">
        <p className="font-semibold text-muted">Something went wrong</p>
        <h1 className="mt-2 text-display">
          This page didn&apos;t <span className="pill pill-coral">load</span>
        </h1>
        <p className="mt-6 max-w-measure text-lead text-muted">Something failed on the server while reading data. It&apos;s usually temporary.</p>
        <button type="button" onClick={reset} className="btn btn-primary btn-lg mt-8">
          Try again
        </button>
      </div>
    </div>
  );
}
