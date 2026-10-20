import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CoinCard } from "@/components/coin-card";
import { CheckCoinButton } from "@/components/command-search";
import { EmptyRings } from "@/components/visuals/empty-states";
import { isWallet } from "@/lib/auth";
import { hasDatabase } from "@/lib/db";
import { creatorProfile } from "@/lib/data/lists";
import { fmtPct, fmtSol, shortAddr } from "@/lib/format";
import { solscanAccount } from "@/lib/config";

export async function generateMetadata({ params }: PageProps<"/creator/[wallet]">): Promise<Metadata> {
  const { wallet } = await params;
  return { title: `Creator ${shortAddr(wallet)}` };
}

const OUTCOME = {
  graduated: { label: "Graduated", cls: "tag-primary" },
  active: { label: "Active", cls: "tag-accent" },
  faded: { label: "Faded", cls: "tag-tint text-muted" },
} as const;

const statLabel = "font-mono text-mono tracking-[0.12em] text-muted uppercase";

export default async function CreatorPage({ params }: PageProps<"/creator/[wallet]">) {
  await connection();
  const { wallet } = await params;
  if (!isWallet(wallet)) notFound();
  const data = hasDatabase() ? await creatorProfile(wallet) : { coins: [], launches: 0, graduationRate: null };

  return (
    <div className="mx-auto max-w-page px-gutter pt-[calc(var(--header-h)+2.5rem)] md:pt-[calc(var(--header-h)+4.5rem)]">
      <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
        <div className="min-w-0 lg:col-span-7">
          <p className="eyebrow">Creator</p>
          <h1 className="addr mt-3 text-[clamp(1.25rem,0.9rem+1.6vw,2.25rem)] leading-snug font-medium break-all">{wallet}</h1>
          <a href={solscanAccount(wallet)} target="_blank" rel="noreferrer" className="tag tag-tint mt-5 min-h-8 px-3 text-label hover:bg-tint-strong">
            View on Solscan <ExternalLink size={12} aria-hidden />
          </a>
        </div>
        <dl className="grid grid-cols-2 gap-8 border-y border-rule py-6 lg:col-span-5">
          <div>
            <dt className={statLabel}>Launches on Yardstick</dt>
            <dd className="num mt-2 text-stat">{data.launches}</dd>
          </div>
          <div>
            <dt className={statLabel}>Graduated</dt>
            <dd className="num mt-2 text-stat">{data.graduationRate === null ? "–" : fmtPct(data.graduationRate, 0)}</dd>
          </div>
        </dl>
      </div>

      {data.coins.length === 0 ? (
        <div className="card mt-16 flex flex-wrap items-center justify-between gap-6 p-6 md:p-8">
          <EmptyRings className="size-28 shrink-0" />
          <div className="max-w-xl flex-1">
            <p className="text-title">No coins launched through Yardstick from this wallet yet.</p>
            <p className="mt-2 text-small text-muted">Coins this wallet launches here show up on this page with their best standing. To look at a coin launched elsewhere, check it by its address.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/launch" className="btn btn-primary">
              Launch a coin
            </Link>
            <CheckCoinButton className="btn btn-outline" />
          </div>
        </div>
      ) : (
        <section aria-labelledby="coins-h" className="mt-24">
          <p className="eyebrow">Newest first</p>
          <h2 id="coins-h" className="mt-3 text-display">
            Coins
          </h2>
          <ul className="mt-12 grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 lg:grid-cols-6">
            {data.coins.map((c) => (
              <li key={c.mint}>
                <CoinCard
                  href={`/coin/${c.mint}`}
                  image={c.image}
                  name={c.name}
                  symbol={c.symbol}
                  sub={new Date(c.createdAt).toISOString().slice(0, 10)}
                  figure={c.peakMcapSol ? `peak ${fmtSol(c.peakMcapSol)} SOL` : "peak –"}
                  tag={<span className={`tag ${OUTCOME[c.outcome].cls}`}>{OUTCOME[c.outcome].label}</span>}
                />
                <p className="num mt-2 text-small">
                  <span className="text-muted">Best </span>
                  <span className={`font-medium ${c.bestPercentile !== null ? "text-primary-ink" : ""}`}>{c.bestPercentile !== null ? `top ${Math.max(1, Math.round(100 - c.bestPercentile))}%` : "–"}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
