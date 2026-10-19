/** The mark: a rounded bar with a dot sitting at a point along it, "where you stand". */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 44 24" className={className} aria-hidden="true">
      <rect x="0" y="4" width="44" height="16" rx="8" fill="var(--teal)" />
      <circle cx="30" cy="12" r="5" fill="currentColor" />
    </svg>
  );
}

/** Wordmark: mark + lowercase "yardstick" in the display weight. Inherits text colour. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display text-[1.375rem] leading-none font-extrabold tracking-[-0.045em] ${className}`}>
      <LogoMark className="h-[0.95em] w-auto" />
      <span>yardstick</span>
    </span>
  );
}
