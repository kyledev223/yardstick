"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[80svh] items-center px-gutter pt-header pb-24">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
        <p className="eyebrow">Something went wrong</p>
        <h1 className="text-cta">This page didn&apos;t load.</h1>
        <p className="max-w-md text-small text-muted">Something failed on the server while reading data. It&apos;s usually temporary.</p>
        <button type="button" onClick={reset} className="btn btn-primary">
          Try again
        </button>
      </div>
    </div>
  );
}
