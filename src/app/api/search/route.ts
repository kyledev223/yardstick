import { NextRequest } from "next/server";
import { clientIp, fail, ok, toErrorResponse } from "@/lib/api";
import { searchCoins } from "@/lib/data/lists";
import { allow } from "@/lib/ratelimit";

/** ⌘K search: coins Yardstick tracks, by $SYMBOL or name. Reads only our DB, no RPC. */
export async function GET(req: NextRequest) {
  try {
    if (!(await allow(`search:${clientIp(req)}`, 300, 3600))) return fail("rate-limited", 429, "Too many searches from this network in the last hour. Try again later.");
    const q = req.nextUrl.searchParams.get("q") ?? "";
    return ok({ coins: await searchCoins(q) });
  } catch (err) {
    return toErrorResponse(err);
  }
}
