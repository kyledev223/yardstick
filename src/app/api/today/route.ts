import { after, NextRequest } from "next/server";
import { ok, toErrorResponse } from "@/lib/api";
import { leaderboard } from "@/lib/data/lists";
import { maybeTick } from "@/lib/jobs/tick";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const range = sp.get("range") === "7d" ? "7d" : "today";
    const graduatedOnly = sp.get("graduated") === "1";
    const group = sp.get("group") === "yardstick" ? "yardstick" : "baseline";
    const rows = await leaderboard({ range, graduatedOnly, group });
    after(() => maybeTick("today"));
    return ok({ rows });
  } catch (err) {
    return toErrorResponse(err);
  }
}
