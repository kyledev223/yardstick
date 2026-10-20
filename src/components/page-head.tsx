/** Section heading: mono eyebrow, a large tight title on the left and a short muted note on the right, aligned to the bottom. */
export function SectionHead({
  eyebrow,
  title,
  note,
  as: H = "h2",
  id,
  action,
  onPanel = false,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  note?: React.ReactNode;
  as?: "h1" | "h2";
  id?: string;
  action?: React.ReactNode;
  onPanel?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-10">
      <div className="min-w-0">
        {eyebrow && <p className={`eyebrow ${onPanel ? "text-panel-muted" : ""}`}>{eyebrow}</p>}
        <H id={id} className={`max-w-3xl text-display ${eyebrow ? "mt-3" : ""}`}>
          {title}
        </H>
      </div>
      {note && <p className={`max-w-xs shrink-0 text-small ${onPanel ? "text-panel-muted" : "text-muted"}`}>{note}</p>}
      {action && <div className="shrink-0 self-start md:self-end">{action}</div>}
    </div>
  );
}

/** Top of an inner page: clears the fixed header, then a SectionHead with an h1. */
export function PageHead(props: { eyebrow?: React.ReactNode; title: React.ReactNode; note?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-text px-gutter pt-[calc(var(--header-h)+2.5rem)] md:pt-[calc(var(--header-h)+4.5rem)]">
      <SectionHead as="h1" {...props} />
    </div>
  );
}
