/** The mark: ruler ticks of rising height with a dot on the tallest, "where you stand". Colours come from props. */
export function LogoMark({ className = "", tick = "currentColor", dot = "var(--panel-accent)" }: { className?: string; tick?: string; dot?: string }) {
  return (
    <svg viewBox="0 0 20 16" className={className} aria-hidden="true">
      <rect x="1" y="9" width="2" height="6" rx="1" fill={tick} />
      <rect x="6" y="6" width="2" height="9" rx="1" fill={tick} />
      <rect x="11" y="3" width="2" height="12" rx="1" fill={tick} />
      <circle cx="17" cy="3" r="2.5" fill={dot} />
    </svg>
  );
}

/** Wordmark: an ink tile with the mark and lowercase "yardstick". Same in both themes. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex h-8 items-center gap-1.5 rounded-[0.6rem] bg-panel px-2.5 text-on-panel shadow-[inset_0_0_0_1px_var(--panel-edge)] ${className}`}>
      <LogoMark className="h-3.5 w-auto" />
      <span className="text-[0.9375rem] leading-none font-medium tracking-[-0.04em]">yardstick</span>
    </span>
  );
}
