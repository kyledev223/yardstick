import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { tick } from "@/lib/jobs/tick";

export const maxDuration = 60;

function authorised(req: NextRequest): boolean {
  const secret = env.cronSecret;
  if (!secret) return false;
  const header = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const given = header || req.nextUrl.searchParams.get("secret") || "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Pinged every 5 minutes by cron-job.org (Bearer CRON_SECRET or ?secret=). */
export async function GET(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ ok: false, error: { code: "unauthorised" } }, { status: 401 });
  const summary = await tick({ reason: "cron" });
  return NextResponse.json({ ok: !summary.error, summary }, { headers: { "cache-control": "no-store" } });
}
