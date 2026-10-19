import { NextRequest } from "next/server";
import { fail, ok, toErrorResponse } from "@/lib/api";
import { isWallet } from "@/lib/auth";
import { creatorProfile } from "@/lib/data/lists";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/creator/[wallet]">) {
  try {
    const { wallet } = await ctx.params;
    if (!isWallet(wallet)) return fail("validation-failed", 400, "Invalid wallet address");
    return ok(await creatorProfile(wallet));
  } catch (err) {
    return toErrorResponse(err);
  }
}
