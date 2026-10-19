// Everything tunable lives here. See docs/YARDSTICK.md → "Customise later".

export const NETWORK_LABEL = "Solana mainnet";

export const PUMP_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
/** Pump's mint-authority PDA: only create transactions reference it. */
export const PUMP_MINT_AUTHORITY = "TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM";
export const COMPUTE_BUDGET_PROGRAM_ID = "ComputeBudget111111111111111111111111111111";
export const ASSOCIATED_TOKEN_PROGRAM_ID = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
export const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const NATIVE_MINT = "So11111111111111111111111111111111111111112";
export const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";

export const PUBLIC_RPC = "https://api.mainnet-beta.solana.com";
export const PUMP_IPFS_URL = "https://pump.fun/api/ipfs";

export const pumpUrl = (mint: string) => `https://pump.fun/coin/${mint}`;
export const solscanTx = (sig: string) => `https://solscan.io/tx/${sig}`;
export const solscanToken = (mint: string) => `https://solscan.io/token/${mint}`;
export const solscanAccount = (a: string) => `https://solscan.io/account/${a}`;

/** pump.fun coins have 1B supply with 6 decimals. */
export const TOKEN_DECIMALS = 6;
export const LAMPORTS_PER_SOL = 1_000_000_000;

// ---- Launch ----
export const LAUNCH = {
  nameMax: 32,
  symbolMax: 10,
  descriptionMax: 500,
  imageMaxBytes: 4 * 1024 * 1024,
  imageTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  devBuyMaxSol: 2,
  /** The SDK adds 1% to the dev buy as max cost; we accept up to this many bps over. */
  devBuySlippageBps: 100,
  computeUnitLimit: 300_000,
  computeUnitLimitWithBuy: 400_000,
  /** micro-lamports per CU; capped in the relay checker. */
  priorityMicroLamports: 200_000,
  priorityMicroLamportsMax: 2_000_000,
  /** Rough rent + fees for a create, used in the "not enough SOL" pre-check. */
  createCostSol: 0.025,
  pendingExpiryMinutes: 30,
  prepareLimitPerHourWallet: 10,
  prepareLimitPerHourIp: 20,
  bannedWords: [] as string[],
};

// ---- Snapshots ----
export const AGE_BUCKETS = [
  { key: "5m", seconds: 5 * 60 },
  { key: "15m", seconds: 15 * 60 },
  { key: "30m", seconds: 30 * 60 },
  { key: "1h", seconds: 3600 },
  { key: "2h", seconds: 2 * 3600 },
  { key: "4h", seconds: 4 * 3600 },
  { key: "8h", seconds: 8 * 3600 },
  { key: "12h", seconds: 12 * 3600 },
  { key: "24h", seconds: 24 * 3600 },
  { key: "48h", seconds: 48 * 3600 },
  { key: "7d", seconds: 7 * 24 * 3600 },
] as const;
export type AgeBucketKey = (typeof AGE_BUCKETS)[number]["key"];

/** A fixed-age snapshot counts only if taken within this window after the target age. */
export const snapshotWindowSeconds = (ageSeconds: number) => Math.max(5 * 60, Math.round(ageSeconds * 0.25));

export const TRACKING_DAYS = 7;
export const LATEST_REFRESH_SECONDS = 120;

// ---- Data collection ----
export const DATA = {
  /** Max trades ingested per coin; beyond this, trade metrics say "based on first N trades". */
  tradeCapYardstick: 5000,
  tradeCapBaseline: 1000,
  tradeCapExternal: 2000,
  /** Buyers sampled per coin for the fresh-wallet check. */
  freshSampleSize: 20,
  /** A wallet is "fresh" if its first transaction is within this many hours of its first buy. */
  freshWalletHours: 24,
  /** …or if it has fewer than this many transactions in total. */
  freshWalletMinTx: 5,
  /** Trades within this many slots of creation count as sniper buys. */
  sniperSlots: 2,
  minSampleForPercentile: 30,
  minSampleForGraduated: 10,
  distributionWindowDays: 7,
};

// ---- Composite score (shown on /how) ----
export const COMPOSITE_WEIGHTS: { metric: MetricKey; weight: number; inverted: boolean }[] = [
  { metric: "holders", weight: 0.25, inverted: false },
  { metric: "uniqueBuyers", weight: 0.2, inverted: false },
  { metric: "netInflowSol", weight: 0.2, inverted: false },
  { metric: "curveProgress", weight: 0.15, inverted: false },
  { metric: "top10Pct", weight: 0.1, inverted: true },
  { metric: "sniperPct", weight: 0.05, inverted: true },
  { metric: "freshWalletPct", weight: 0.05, inverted: true },
];

export const METRICS = [
  "holders",
  "uniqueBuyers",
  "netInflowSol",
  "buySellCountRatio",
  "buySellSolRatio",
  "curveProgress",
  "mcapSol",
  "top10Pct",
  "devHoldPct",
  "sniperPct",
  "freshWalletPct",
] as const;
export type MetricKey = (typeof METRICS)[number];

/** Metrics where a lower value is the healthier one. */
export const INVERTED_METRICS: ReadonlySet<MetricKey> = new Set(["top10Pct", "sniperPct", "freshWalletPct", "devHoldPct"]);

export const GROUPS = ["baseline", "yardstick"] as const;
export type GroupKey = (typeof GROUPS)[number];

export const PERCENTILE_POINTS = Array.from({ length: 19 }, (_, i) => (i + 1) * 5); // 5…95

// ---- Tick ----
export const TICK = {
  budgetMs: 8000,
  lockSeconds: 55,
  /** Minimum gap between page-load-triggered ticks. */
  minGapSeconds: 60,
  distributionEveryMinutes: 60,
  solPriceEveryMinutes: 10,
  /** Max RPC credits one tick may spend. */
  creditsPerTick: 600,
};
