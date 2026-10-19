import { after, NextRequest } from "next/server";
import { clientIp, fail, ok, toErrorResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { flushRpcUsage } from "@/lib/data/budget";
import { getOrEnrollCoin, isMint } from "@/lib/data/coins";
import { coinView, refreshLatest } from "@/lib/data/dashboard";
import { maybeTick } from "@/lib/jobs/tick";
import { allow } from "@/lib/ratelimit";

export const maxDuration = 30;

/** Dashboard data. Enrols unknown pump.fun mints as "external"; refreshes "latest" after responding. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/coin/[mint]">) {
  try {
    const { mint } = await ctx.params;
    if (!isMint(mint)) return fail("invalid-mint", 400);
    let coin = await db().coin.findUnique({ where: { mint } });
    if (!coin) {
      // Enrolling costs RPC credits: limit per IP.
      if (!(await allow(`enrol:${clientIp(_req)}`, 20, 3600))) return fail("rate-limited", 429, "Too many new coins looked up from this network in the last hour.");
      coin = await getOrEnrollCoin(mint);
    }
    const view = await coinView(coin);
    const c = coin;
    after(async () => {
      await refreshLatest(c).catch(() => {});
      await maybeTick("coin-view");
    });
    return ok({ view });
  } catch (err) {
    return toErrorResponse(err);
  } finally {
    await flushRpcUsage().catch(() => {});
  }
}
