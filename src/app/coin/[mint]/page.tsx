import type { Metadata } from "next";
import { connection } from "next/server";
import { db, hasDatabase } from "@/lib/db";
import { isMint } from "@/lib/data/coins";
import { coinView, type CoinView } from "@/lib/data/dashboard";
import { CoinDashboard } from "./coin-dashboard";

export async function generateMetadata({ params }: PageProps<"/coin/[mint]">): Promise<Metadata> {
  const { mint } = await params;
  const coin = hasDatabase() && isMint(mint) ? await db().coin.findUnique({ where: { mint }, select: { name: true, symbol: true } }).catch(() => null) : null;
  return {
    title: coin ? `${coin.name} ($${coin.symbol})` : "Coin",
    description: coin ? `How ${coin.name} compares with other pump.fun coins at the same age.` : "How this pump.fun coin compares with others at the same age.",
  };
}

export default async function CoinPage({ params, searchParams }: PageProps<"/coin/[mint]">) {
  await connection();
  const { mint } = await params;
  const sp = await searchParams;
  const launched = typeof sp.launched === "string" ? sp.launched : null;
  let initial: CoinView | null = null;
  if (hasDatabase() && isMint(mint)) {
    const coin = await db().coin.findUnique({ where: { mint } }).catch(() => null);
    if (coin) initial = await coinView(coin).catch(() => null);
  }
  return <CoinDashboard mint={mint} initial={initial} launchedSig={launched} />;
}
