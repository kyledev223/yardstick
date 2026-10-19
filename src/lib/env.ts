import "server-only";
import { PUBLIC_RPC } from "./config";

function list(v: string | undefined): string[] {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function int(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** RPC endpoints in priority order. The public endpoint is always last. */
export function rpcEndpoints(): string[] {
  const urls = list(process.env.SOLANA_RPC_URL);
  const helius = process.env.HELIUS_API_KEY?.trim();
  if (helius && !urls.some((u) => u.includes("helius"))) {
    urls.unshift(`https://mainnet.helius-rpc.com/?api-key=${helius}`);
  }
  if (!urls.includes(PUBLIC_RPC)) urls.push(PUBLIC_RPC);
  return urls;
}

export const env = {
  get siteUrl() {
    const v = process.env.SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    return v.replace(/\/$/, "");
  },
  get cronSecret() {
    return process.env.CRON_SECRET || "";
  },
  get pinataJwt() {
    return process.env.PINATA_JWT || "";
  },
  get coingeckoKey() {
    return process.env.COINGECKO_API_KEY || "";
  },
  /** Helius free plan is 1M credits/month ≈ 33k/day; keep headroom. */
  get rpcDailyBudget() {
    return int(process.env.RPC_DAILY_BUDGET, 30000);
  },
  get baselineDailySample() {
    return int(process.env.BASELINE_DAILY_SAMPLE, 150);
  },
  get isProd() {
    return process.env.NODE_ENV === "production";
  },
};
