export type Step = { label: string; text: string };

/** Numbered steps under a rule: "01 / LAUNCH" in mono, then one sentence. Four columns on wide screens. */
export function StepList({ steps, onPanel = false, className = "" }: { steps: Step[]; onPanel?: boolean; className?: string }) {
  return (
    <ol className={`grid gap-10 border-t pt-8 sm:grid-cols-2 lg:grid-cols-4 ${onPanel ? "border-panel-muted/30" : "border-rule"} ${className}`}>
      {steps.map((s, i) => (
        <li key={s.label}>
          <span className={`font-mono text-mono uppercase ${onPanel ? "text-panel-muted" : "text-muted"}`}>
            {String(i + 1).padStart(2, "0")} / {s.label}
          </span>
          <p className="mt-4 max-w-xs text-small">{s.text}</p>
        </li>
      ))}
    </ol>
  );
}
