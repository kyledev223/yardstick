import "server-only";
import { NextResponse } from "next/server";
import { AppError, errorBody, type ErrorCode } from "./errors";
import { RpcError, redact } from "./rpc";

export function ok<T extends object>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, ...data }, init);
}

export function fail(code: ErrorCode, status = 400, message?: string, details?: unknown) {
  return NextResponse.json(errorBody(code, message, details), { status });
}

/** Turn any thrown error into a JSON error response with a short code. */
export function toErrorResponse(err: unknown) {
  if (err instanceof AppError) return fail(err.code, err.status, err.message, err.details);
  if (err instanceof RpcError) return fail(err.code, 503);
  console.error("[api]", redact(String((err as Error)?.stack ?? err)));
  return fail("server-error", 500);
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim();
}
