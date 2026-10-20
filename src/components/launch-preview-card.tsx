import { ImagePlus } from "lucide-react";

/** Live preview of the coin being launched: updates on every keystroke. Empty fields show their labels, never sample content. */
export function LaunchPreviewCard({ image, name, symbol, description }: { image: string | null; name: string; symbol: string; description: string }) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-6 text-center">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="Selected coin image" className="size-40 rounded-3xl object-cover shadow-[0_18px_60px_var(--shadow)] sm:size-52" />
      ) : (
        <div className="grid size-40 place-items-center rounded-3xl border border-dashed border-rule-strong text-muted sm:size-52">
          <span className="flex flex-col items-center gap-2 text-label">
            <ImagePlus size={24} strokeWidth={1.5} aria-hidden />
            No image yet
          </span>
        </div>
      )}
      <div className="min-w-0 max-w-full">
        <p className={`truncate text-stat tracking-[-0.04em] ${name ? "" : "text-muted"}`}>{name || "Your coin"}</p>
        <p className="mt-1 font-mono text-label text-muted">
          ${symbol || "SYMBOL"} · pump.fun
        </p>
      </div>
      <p className="line-clamp-3 min-h-12 max-w-xs text-small text-muted">{description || "Your description appears here."}</p>
    </div>
  );
}
