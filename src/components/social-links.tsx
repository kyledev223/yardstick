import { PROJECT_CA, pumpUrl, X_HANDLE } from "@/lib/config";

// lucide dropped brand icons, so both marks are drawn here.
function XMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/** A tilted capsule, half filled: pump.fun's pill. */
function PumpMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <g transform="rotate(-45 12 12)">
        <path d="M12 7.5H7.5a4.5 4.5 0 0 0 0 9H12z" fill="currentColor" />
        <rect x="3" y="7.5" width="18" height="9" rx="4.5" fill="none" stroke="currentColor" strokeWidth="2" />
      </g>
    </svg>
  );
}

const xHref = X_HANDLE ? `https://x.com/${X_HANDLE}` : "https://x.com";
const pumpHref = PROJECT_CA ? pumpUrl(PROJECT_CA) : "https://pump.fun";

const BTN = "grid h-8 w-8 place-items-center rounded-pill text-muted transition-colors duration-(--dur-fast) hover:bg-tint hover:text-ink";

/** The project's X account and its coin on pump.fun, as icon buttons. Set both in `src/lib/config.ts`. */
export function SocialLinks({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-1 ${className}`}>
      <a href={xHref} target="_blank" rel="noopener noreferrer" className={BTN} aria-label="Yardstick on X" title="X">
        <XMark size={14} />
      </a>
      <a href={pumpHref} target="_blank" rel="noopener noreferrer" className={BTN} aria-label="Yardstick on pump.fun" title="pump.fun">
        <PumpMark size={16} />
      </a>
    </span>
  );
}
