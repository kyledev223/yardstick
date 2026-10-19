import { after } from "next/server";
import { ok, toErrorResponse } from "@/lib/api";
import { todayStats } from "@/lib/data/lists";
import { maybeTick } from "@/lib/jobs/tick";

export async function GET() {
  try {
    const stats = await todayStats();
    after(() => maybeTick("landing"));
    return ok({ stats });
  } catch (err) {
    return toErrorResponse(err);
  }
}
