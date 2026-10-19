import { NextRequest } from "next/server";
import { fail, ok, toErrorResponse } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { flushRpcUsage } from "@/lib/data/budget";
import { finalizeLaunch } from "@/lib/launch/finalize";

/** Launch status. Polling this also finalizes the launch (no cron needed for that). */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/launch/[id]">) {
  try {
    const session = await requireSession();
    const { id } = await ctx.params;
    let launch = await db().launch.findUnique({ where: { id } });
    if (!launch || launch.userId !== session.userId) return fail("launch-not-found", 404);
    if (launch.status === "relayed" || (launch.status === "confirmed" && !launch.coinId)) {
      try {
        launch = await finalizeLaunch(launch);
      } catch {
        // RPC hiccup; the next poll retries
      }
    }
    return ok({
      status: launch.status,
      mint: launch.mint,
      signature: launch.signature,
      errorCode: launch.errorCode,
      reason: launch.reason,
      coinReady: Boolean(launch.coinId),
    });
  } catch (err) {
    return toErrorResponse(err);
  } finally {
    await flushRpcUsage().catch(() => {});
  }
}
