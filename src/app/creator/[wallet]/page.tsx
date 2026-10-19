import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
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
  graduated: { label: "Graduated", cls: "bg-btn text-on-btn" },
  active: { label: "Active", cls: "bg-yellow text-on-pill" },
  faded: { label: "Faded", cls: "bg-sunk text-muted" },
} as const;

export default async function CreatorPage({ params }: PageProps<"/creator/[wallet]">) {
  await connection();
  const { wallet } = await params;
  if (!isWallet(wallet)) notFound();
  const data = hasDatabase() ? await creatorProfile(wallet) : { coins: [], launches: 0, graduationRate: null };

  return (
    <div className="mx-auto max-w-page px-gutter pt-6 md:pt-10">
      <p className="font-semibold text-muted">Creator</p>
      <h1 className="addr mt-2 text-[clamp(1.25rem,0.9rem+1.6vw,2.25rem)] leading-snug font-medium tracking-normal break-all">{wallet}</h1>
      <a href={solscanAccount(wallet)} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-pill bg-sunk px-3.5 text-sm font-semibold hover:bg-rule">
        View on Solscan <ExternalLink size={14} aria-hidden />
      </a>

      <dl className="mt-10 grid max-w-2xl grid-cols-2 gap-3">
        <div className="rounded-lg bg-surface p-6 ring-1 ring-rule">
          <dt className="text-sm text-muted">Launches on Yardstick</dt>
          <dd className="num mt-1 text-[clamp(3rem,2rem+3vw,4.5rem)] leading-none font-extrabold tracking-[-0.04em]">{data.launches}</dd>
        </div>
        <div className="rounded-lg bg-surface p-6 ring-1 ring-rule">
          <dt className="text-sm text-muted">Graduated</dt>
          <dd className="num mt-1 text-[clamp(3rem,2rem+3vw,4.5rem)] leading-none font-extrabold tracking-[-0.04em]">{data.graduationRate === null ? "–" : fmtPct(data.graduationRate, 0)}</dd>
        </div>
      </dl>

      {data.coins.length === 0 ? (
        <div className="mt-10 flex flex-wrap items-center justify-between gap-6 rounded-lg bg-surface p-6 ring-1 ring-rule md:p-8">
          <p className="text-title">No coins launched through Yardstick from this wallet yet.</p>
          <Link href="/launch" className="btn btn-primary">
            Launch a coin
          </Link>
        </div>
      ) : (
        <section aria-labelledby="coins-h" data-field="quiet" className="mt-section-sm">
          <h2 id="coins-h" className="text-headline">
            Coins
          </h2>
          <ul className="mt-6 space-y-3">
            {data.coins.map((c) => (
              <li key={c.mint}>
                <Link
                  href={`/coin/${c.mint}`}
                  className="group grid grid-cols-[48px_1fr] items-center gap-x-4 gap-y-2 rounded-lg bg-surface p-4 ring-1 ring-rule hover:ring-ink sm:grid-cols-[48px_1fr_auto_10rem_10rem]"
                >
                  {c.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image} alt="" width={48} height={48} className="h-12 w-12 rounded-md object-cover ring-1 ring-rule" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="h-12 w-12 rounded-md bg-sunk" aria-hidden />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-bold group-hover:underline group-hover:underline-offset-4">{c.name}</span>
                    <span className="num block text-sm text-muted">
                      ${c.symbol} · {new Date(c.createdAt).toISOString().slice(0, 10)}
                    </span>
                  </span>
                  <span className={`col-start-2 inline-flex min-h-7 w-fit items-center rounded-pill px-3 text-micro font-bold sm:col-start-auto ${OUTCOME[c.outcome].cls}`}>{OUTCOME[c.outcome].label}</span>
                  <span className="col-start-2 text-sm sm:col-start-auto">
                    <span className="text-muted">Peak </span>
                    <span className="num font-semibold">{c.peakMcapSol ? `${fmtSol(c.peakMcapSol)} SOL` : "–"}</span>
                  </span>
                  <span className="col-start-2 text-sm sm:col-start-auto">
                    <span className="text-muted">Best </span>
                    <span className="num font-semibold">{c.bestPercentile !== null ? `top ${Math.max(1, Math.round(100 - c.bestPercentile))}%` : "–"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
