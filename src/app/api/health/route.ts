import { NextResponse } from "next/server";
import { healthReport } from "@/lib/health";

export const maxDuration = 30;

export async function GET() {
  const report = await healthReport();
  return NextResponse.json(report, { status: report.ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}
