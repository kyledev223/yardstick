/** Position in a short sequence: dots for the other steps, a stretched bar for this one. */
export function StepDots({ step, of }: { step: number; of: number }) {
  return (
    <span className="inline-flex items-center gap-1.5" aria-hidden>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={`h-2.5 rounded-pill ${i + 1 === step ? "w-10 bg-teal" : "w-2.5 bg-sunk"}`} />
      ))}
    </span>
  );
}
