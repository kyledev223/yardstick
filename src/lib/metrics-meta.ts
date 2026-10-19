import type { MetricKey } from "./config";
import { fmtInt, fmtPct, fmtRatio, fmtSol } from "./format";

export type MetricMeta = {
  label: string;
  format: (v: number) => string;
  /** Lower is the healthier direction (shown inverted in the composite). */
  lowerIsBetter?: boolean;
  short: string;
  how: string;
};

export const METRIC_META: Record<MetricKey, MetricMeta> = {
  holders: {
    label: "Holders",
    format: fmtInt,
    short: "Wallets holding any of the coin",
    how: "Wallets with a non-zero balance, read from token accounts for the mint. The bonding curve's own account is excluded.",
  },
  uniqueBuyers: {
    label: "Unique buyers",
    format: fmtInt,
    short: "Different wallets that have bought",
    how: "Distinct wallets with at least one buy on the bonding curve, from decoded trade events.",
  },
  netInflowSol: {
    label: "Net SOL in",
    format: (v) => `${fmtSol(v)} SOL`,
    short: "Buys minus sells, in SOL",
    how: "The SOL held by the bonding curve (its real SOL reserves): every buy adds, every sell removes. Fees are not included.",
  },
  buySellCountRatio: {
    label: "Buys per sell",
    format: fmtRatio,
    short: "Number of buys for each sell",
    how: "Buy count divided by sell count (a coin with no sells yet uses 1 as the divisor).",
  },
  buySellSolRatio: {
    label: "SOL bought per SOL sold",
    format: fmtRatio,
    short: "Buy volume over sell volume",
    how: "SOL spent on buys divided by SOL received from sells.",
  },
  curveProgress: {
    label: "Curve progress",
    format: (v) => fmtPct(v),
    short: "How full the bonding curve is",
    how: "Share of the curve's sellable tokens already bought. At 100% the coin graduates to PumpSwap.",
  },
  mcapSol: {
    label: "Market cap",
    format: (v) => `${fmtSol(v)} SOL`,
    short: "Supply × current price",
    how: "Total supply × virtual SOL reserves ÷ virtual token reserves, from the bonding curve account.",
  },
  top10Pct: {
    label: "Top-10 share",
    format: (v) => fmtPct(v),
    lowerIsBetter: true,
    short: "Supply held by the 10 largest wallets",
    how: "Sum of the 10 largest balances as a share of total supply, excluding the bonding curve.",
  },
  devHoldPct: {
    label: "Creator holds",
    format: (v) => fmtPct(v),
    lowerIsBetter: true,
    short: "Supply in the creator's wallet",
    how: "The creator wallet's balance as a share of total supply.",
  },
  sniperPct: {
    label: "Sniper share",
    format: (v) => fmtPct(v),
    lowerIsBetter: true,
    short: "Supply bought in the first slots",
    how: "Tokens bought within 2 slots (about a second) of creation by wallets other than the creator, as a share of supply.",
  },
  freshWalletPct: {
    label: "Fresh-wallet share",
    format: (v) => fmtPct(v, 0),
    lowerIsBetter: true,
    short: "Buyers with brand-new or near-empty wallets",
    how: "From a sample of up to 20 buyers: a wallet counts as fresh if it has fewer than 5 transactions in total, or its whole history began within 24 hours of buying.",
  },
};

export const GROUP_LABEL = { baseline: "pump.fun baseline", yardstick: "Yardstick launches" } as const;
