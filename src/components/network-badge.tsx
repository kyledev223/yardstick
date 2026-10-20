import { NETWORK_LABEL } from "@/lib/config";

/** "Solana mainnet · real SOL": always visible in the header, so nobody mistakes the site for a test network. */
export function NetworkBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`tag tag-outline ${className}`} title="Every transaction on this site uses real SOL on Solana mainnet.">
      <span className="h-1.5 w-1.5 rounded-pill bg-up" aria-hidden />
      {NETWORK_LABEL} · real SOL
    </span>
  );
}
