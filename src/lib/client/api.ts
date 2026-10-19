"use client";

export type ApiError = { code: string; message: string; details?: unknown };
export type ApiResult<T> = ({ ok: true } & T) | { ok: false; error: ApiError };

/** fetch() that always resolves to { ok, ...data } or { ok: false, error }. */
export async function api<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, { ...init, headers: init?.body instanceof FormData ? init.headers : { "content-type": "application/json", ...init?.headers } });
    const body = await res.json().catch(() => null);
    if (body && typeof body.ok === "boolean") return body;
    return { ok: false, error: { code: "server-error", message: `Unexpected response (${res.status}).` } };
  } catch {
    return { ok: false, error: { code: "network", message: "Couldn't reach Yardstick. Check your connection and try again." } };
  }
}

export const post = <T,>(url: string, body: unknown) => api<T>(url, { method: "POST", body: JSON.stringify(body) });
