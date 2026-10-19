import { clientIp, fail, ok, toErrorResponse } from "@/lib/api";
import { LAUNCH } from "@/lib/config";
import { runPreChecks } from "@/lib/data/prechecks";
import { allow } from "@/lib/ratelimit";

/** Pre-launch checks; called (debounced) as the user types. Reads only our DB, no RPC. */
export async function POST(req: Request) {
  try {
    if (!(await allow(`precheck:${clientIp(req)}`, 240, 3600))) return fail("rate-limited", 429);
    const b = (await req.json()) as Record<string, unknown>;
    const str = (v: unknown, max: number) => String(v ?? "").slice(0, max);
    const devBuy = Math.min(Math.max(Number(b.devBuySol) || 0, 0), LAUNCH.devBuyMaxSol);
    const checks = await runPreChecks({
      name: str(b.name, LAUNCH.nameMax),
      symbol: str(b.symbol, LAUNCH.symbolMax),
      description: str(b.description, LAUNCH.descriptionMax),
      hasImage: Boolean(b.hasImage),
      twitter: Boolean(b.twitter),
      telegram: Boolean(b.telegram),
      website: Boolean(b.website),
      devBuySol: devBuy,
    });
    return ok({ checks });
  } catch (err) {
    return toErrorResponse(err);
  }
}
