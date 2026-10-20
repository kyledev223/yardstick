export type Step = { label: string; text: string };

/**
 * Numbered steps under a rule: "01 / LAUNCH" in mono, then one sentence. Four columns on wide screens.
 * `onBand`: on the ultramarine band, the number sits in a coral chip.
 */
export function StepList({ steps, onPanel = false, onBand = false, className = "" }: { steps: Step[]; onPanel?: boolean; onBand?: boolean; className?: string }) {
  const rule = onBand ? "border-on-band/30" : onPanel ? "border-panel-muted/30" : "border-rule";
  return (
    <ol className={`grid gap-10 border-t pt-8 sm:grid-cols-2 lg:grid-cols-4 ${rule} ${className}`}>
      {steps.map((s, i) => (
        <li key={s.label}>
          {onBand ? (
            <span className="flex items-center gap-3">
              <span className="num grid size-9 place-items-center rounded-pill bg-accent font-mono text-label font-medium text-on-accent">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-mono text-mono tracking-[0.12em] uppercase">{s.label}</span>
            </span>
          ) : (
            <span className={`font-mono text-mono uppercase ${onPanel ? "text-panel-muted" : "text-muted"}`}>
              {String(i + 1).padStart(2, "0")} / {s.label}
            </span>
          )}
          <p className={`mt-4 max-w-xs text-small ${onBand ? "text-on-band-muted" : ""}`}>{s.text}</p>
        </li>
      ))}
    </ol>
  );
}
