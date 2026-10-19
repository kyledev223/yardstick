-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CoinSource" AS ENUM ('yardstick', 'baseline', 'external');

-- CreateEnum
CREATE TYPE "LaunchStatus" AS ENUM ('pending', 'built', 'relayed', 'confirmed', 'failed', 'expired');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthNonce" (
    "nonce" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthNonce_pkey" PRIMARY KEY ("nonce")
);

-- CreateTable
CREATE TABLE "Launch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "status" "LaunchStatus" NOT NULL DEFAULT 'pending',
    "errorCode" TEXT,
    "reason" TEXT,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "twitter" TEXT,
    "telegram" TEXT,
    "website" TEXT,
    "imageUri" TEXT,
    "metadataUri" TEXT NOT NULL,
    "devBuyLamports" BIGINT NOT NULL DEFAULT 0,
    "mint" TEXT,
    "signature" TEXT,
    "blockhash" TEXT,
    "lastValidBlockHeight" BIGINT,
    "relayedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "coinId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Launch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coin" (
    "id" TEXT NOT NULL,
    "mint" TEXT NOT NULL,
    "bondingCurve" TEXT NOT NULL,
    "source" "CoinSource" NOT NULL,
    "creator" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "uri" TEXT,
    "imageUrl" TEXT,
    "description" TEXT,
    "twitter" TEXT,
    "telegram" TEXT,
    "website" TEXT,
    "descLength" INTEGER,
    "metaFetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "createSlot" BIGINT,
    "tokenProgram" TEXT,
    "devBuyLamports" BIGINT,
    "graduatedAt" TIMESTAMP(3),
    "peakMcapSol" DOUBLE PRECISION,
    "bestPercentile" DOUBLE PRECISION,
    "trackingUntil" TIMESTAMP(3) NOT NULL,
    "trackingStopped" BOOLEAN NOT NULL DEFAULT false,
    "lastViewedAt" TIMESTAMP(3),
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Coin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL,
    "coinId" TEXT NOT NULL,
    "ageBucket" TEXT NOT NULL,
    "ageSeconds" INTEGER NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "holders" INTEGER,
    "uniqueBuyers" INTEGER,
    "buys" INTEGER,
    "sells" INTEGER,
    "buySol" DOUBLE PRECISION,
    "sellSol" DOUBLE PRECISION,
    "netInflowSol" DOUBLE PRECISION,
    "buySellCountRatio" DOUBLE PRECISION,
    "buySellSolRatio" DOUBLE PRECISION,
    "curveProgress" DOUBLE PRECISION,
    "mcapSol" DOUBLE PRECISION,
    "top10Pct" DOUBLE PRECISION,
    "devHoldPct" DOUBLE PRECISION,
    "devSold" BOOLEAN,
    "devSoldSol" DOUBLE PRECISION,
    "devSoldPct" DOUBLE PRECISION,
    "sniperPct" DOUBLE PRECISION,
    "freshWalletPct" DOUBLE PRECISION,
    "freshSampled" INTEGER,
    "tradesCounted" INTEGER,
    "tradesCapped" BOOLEAN NOT NULL DEFAULT false,
    "graduated" BOOLEAN NOT NULL DEFAULT false,
    "percentile" DOUBLE PRECISION,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeCursor" (
    "coinId" TEXT NOT NULL,
    "paginationToken" TEXT,
    "lastSignature" TEXT,
    "lastSlot" BIGINT,
    "tradeCount" INTEGER NOT NULL DEFAULT 0,
    "capped" BOOLEAN NOT NULL DEFAULT false,
    "caughtUpAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeCursor_pkey" PRIMARY KEY ("coinId")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "coinId" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "slot" BIGINT NOT NULL,
    "blockTime" TIMESTAMP(3) NOT NULL,
    "user" TEXT NOT NULL,
    "isBuy" BOOLEAN NOT NULL,
    "lamports" BIGINT NOT NULL,
    "tokens" BIGINT NOT NULL,
    "vSol" BIGINT NOT NULL,
    "vTokens" BIGINT NOT NULL,
    "rSol" BIGINT NOT NULL,
    "rTokens" BIGINT NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "coinId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Distribution" (
    "id" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "ageBucket" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "breakpoints" DOUBLE PRECISION[],
    "sampleSize" INTEGER NOT NULL,
    "gradMedian" DOUBLE PRECISION,
    "gradSampleSize" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Distribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchActivity" (
    "hour" TIMESTAMP(3) NOT NULL,
    "creates" INTEGER NOT NULL DEFAULT 0,
    "coveredSeconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LaunchActivity_pkey" PRIMARY KEY ("hour")
);

-- CreateTable
CREATE TABLE "WalletAge" (
    "wallet" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3),
    "txCount" INTEGER NOT NULL,
    "fresh" BOOLEAN NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletAge_pkey" PRIMARY KEY ("wallet")
);

-- CreateTable
CREATE TABLE "JobLock" (
    "name" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "lockedUntil" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobLock_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "summary" JSONB,
    "error" TEXT,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RpcUsage" (
    "day" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RpcUsage_pkey" PRIMARY KEY ("day","host")
);

-- CreateTable
CREATE TABLE "SolPrice" (
    "id" TEXT NOT NULL,
    "usd" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "KeyValue" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeyValue_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_wallet_key" ON "User"("wallet");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "AuthNonce_expiresAt_idx" ON "AuthNonce"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Launch_mint_key" ON "Launch"("mint");

-- CreateIndex
CREATE UNIQUE INDEX "Launch_signature_key" ON "Launch"("signature");

-- CreateIndex
CREATE UNIQUE INDEX "Launch_coinId_key" ON "Launch"("coinId");

-- CreateIndex
CREATE INDEX "Launch_userId_createdAt_idx" ON "Launch"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Launch_status_updatedAt_idx" ON "Launch"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Coin_mint_key" ON "Coin"("mint");

-- CreateIndex
CREATE INDEX "Coin_source_createdAt_idx" ON "Coin"("source", "createdAt");

-- CreateIndex
CREATE INDEX "Coin_creator_idx" ON "Coin"("creator");

-- CreateIndex
CREATE INDEX "Coin_symbol_idx" ON "Coin"("symbol");

-- CreateIndex
CREATE INDEX "Coin_createdAt_idx" ON "Coin"("createdAt");

-- CreateIndex
CREATE INDEX "Coin_trackingStopped_source_idx" ON "Coin"("trackingStopped", "source");

-- CreateIndex
CREATE INDEX "Snapshot_ageBucket_takenAt_idx" ON "Snapshot"("ageBucket", "takenAt");

-- CreateIndex
CREATE UNIQUE INDEX "Snapshot_coinId_ageBucket_key" ON "Snapshot"("coinId", "ageBucket");

-- CreateIndex
CREATE INDEX "Trade_coinId_blockTime_idx" ON "Trade"("coinId", "blockTime");

-- CreateIndex
CREATE INDEX "Trade_coinId_user_idx" ON "Trade"("coinId", "user");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_signature_idx_key" ON "Trade"("signature", "idx");

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_coinId_kind_key" ON "Milestone"("coinId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Distribution_group_ageBucket_metric_key" ON "Distribution"("group", "ageBucket", "metric");

-- CreateIndex
CREATE INDEX "JobRun_name_startedAt_idx" ON "JobRun"("name", "startedAt");

-- CreateIndex
CREATE INDEX "SolPrice_fetchedAt_idx" ON "SolPrice"("fetchedAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Launch" ADD CONSTRAINT "Launch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Launch" ADD CONSTRAINT "Launch_coinId_fkey" FOREIGN KEY ("coinId") REFERENCES "Coin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_coinId_fkey" FOREIGN KEY ("coinId") REFERENCES "Coin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeCursor" ADD CONSTRAINT "TradeCursor_coinId_fkey" FOREIGN KEY ("coinId") REFERENCES "Coin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_coinId_fkey" FOREIGN KEY ("coinId") REFERENCES "Coin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_coinId_fkey" FOREIGN KEY ("coinId") REFERENCES "Coin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

