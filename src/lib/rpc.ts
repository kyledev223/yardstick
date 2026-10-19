import "server-only";
import { Connection } from "@solana/web3.js";
import { rpcEndpoints } from "./env";

export type RpcErrorCode = "rpc-rate-limited" | "rpc-forbidden" | "rpc-timeout" | "rpc-network" | "rpc-unsupported" | "rpc-error";

export class RpcError extends Error {
  constructor(
    public code: RpcErrorCode,
    message: string,
    public host: string,
    public retryable: boolean,
  ) {
    super(message);
    this.name = "RpcError";
  }
}

/** Hostname only. Never log or return a URL: it may carry an API key. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "invalid-url";
  }
}

export function redact(text: string): string {
  return text.replace(/api[-_]?key=[^&\s"']+/gi, "api-key=***").replace(/https?:\/\/[^\s"']+/g, (u) => hostOf(u));
}

/** Decide whether an error is the endpoint's fault (retry / fail over) or a real answer. */
export function classifyRpcError(err: unknown, host = ""): RpcError {
  if (err instanceof RpcError) return err;
  const msg = redact(String((err as { message?: string })?.message ?? err));
  const status = (err as { status?: number })?.status;
  const code = (err as { code?: number | string })?.code;
  if (status === 429 || code === 429 || code === -32005 || /429|too many requests|rate limit/i.test(msg))
    return new RpcError("rpc-rate-limited", msg, host, true);
  if (status === 401 || status === 403 || /\b40[13]\b|forbidden|unauthori[sz]ed/i.test(msg))
    return new RpcError("rpc-forbidden", msg, host, true);
  if (code === -32601 || /method not found|not supported|unsupported method/i.test(msg))
    return new RpcError("rpc-unsupported", msg, host, true);
  if (/timeout|timed out|aborted|ETIMEDOUT/i.test(msg)) return new RpcError("rpc-timeout", msg, host, true);
  if (/fetch failed|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|socket|network|\b50[234]\b/i.test(msg))
    return new RpcError("rpc-network", msg, host, true);
  return new RpcError("rpc-error", msg, host, false);
}

// ---- Credit accounting (Helius counts credits; the public RPC is free but rate-limited) ----

const pending = new Map<string, { credits: number; calls: number; errors: number }>();
let processCredits = 0;

export function creditCost(method: string, resultCount = 0): number {
  if (method === "getProgramAccounts" || method.startsWith("getTokenAccounts") || method.startsWith("getAsset")) return 10;
  if (method === "getTransactionsForAddress") return Math.max(10, Math.ceil(resultCount / 100) * 10);
  return 1;
}

function record(host: string, credits: number, error: boolean) {
  const cost = host.includes("helius") ? credits : 0;
  processCredits += cost;
  const cur = pending.get(host) ?? { credits: 0, calls: 0, errors: 0 };
  cur.credits += cost;
  cur.calls += 1;
  if (error) cur.errors += 1;
  pending.set(host, cur);
}

/** Credits spent by this process since start (used for per-tick budgets). */
export function creditsSpent(): number {
  return processCredits;
}

/** Take the counters accumulated since the last drain (written to RpcUsage by the caller). */
export function drainRpcUsage(): { host: string; credits: number; calls: number; errors: number }[] {
  const out = [...pending.entries()].map(([host, v]) => ({ host, ...v }));
  pending.clear();
  return out;
}

// ---- Raw JSON-RPC with fail-over ----

type CallOpts = {
  /** Only use endpoints whose host matches (e.g. "helius" for DAS methods). */
  hostIncludes?: string;
  timeoutMs?: number;
  /** Override credit counting, e.g. for paged results. */
  credits?: (result: unknown) => number;
};

const unsupported = new Set<string>(); // `${host}:${method}`

// Minimum gap between calls to the public endpoint, which rate-limits bursts.
const nextSlot = new Map<string, number>();
async function pace(host: string) {
  if (host !== "api.mainnet-beta.solana.com") return;
  const now = Date.now();
  const at = Math.max(now, nextSlot.get(host) ?? 0);
  nextSlot.set(host, at + 150);
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}

export function endpointsFor(hostIncludes?: string): string[] {
  const all = rpcEndpoints();
  return hostIncludes ? all.filter((u) => hostOf(u).includes(hostIncludes)) : all;
}

export async function rpcCall<T>(method: string, params: unknown[] | Record<string, unknown>, opts: CallOpts = {}): Promise<T> {
  const endpoints = endpointsFor(opts.hostIncludes);
  if (endpoints.length === 0) throw new RpcError("rpc-unsupported", `No endpoint supports ${method}`, "", false);
  let last: RpcError | null = null;
  for (const url of endpoints) {
    const host = hostOf(url);
    if (unsupported.has(`${host}:${method}`)) continue;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await pace(host);
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
          signal: AbortSignal.timeout(opts.timeoutMs ?? 15000),
          cache: "no-store",
        });
        if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
        const body = (await res.json()) as { result?: T; error?: { code: number; message: string } };
        if (body.error) throw Object.assign(new Error(body.error.message), { code: body.error.code });
        record(host, opts.credits ? opts.credits(body.result) : creditCost(method), false);
        return body.result as T;
      } catch (err) {
        const e = classifyRpcError(err, host);
        record(host, 1, true);
        last = e;
        if (!e.retryable) throw e;
        if (e.code === "rpc-unsupported") {
          unsupported.add(`${host}:${method}`);
          break;
        }
        if (e.code === "rpc-forbidden") break; // retrying won't help; next endpoint
        if (attempt === 0) await new Promise((r) => setTimeout(r, 300 + Math.random() * 300));
      }
    }
  }
  throw last ?? new RpcError("rpc-error", "All RPC endpoints failed", "", false);
}

export function isMethodSupported(method: string, hostIncludes?: string): boolean {
  return endpointsFor(hostIncludes).some((u) => !unsupported.has(`${hostOf(u)}:${method}`));
}

// ---- web3.js Connection with fail-over ----

const connections = new Map<string, Connection>();
function connectionFor(url: string): Connection {
  let c = connections.get(url);
  if (!c) {
    c = new Connection(url, { commitment: "confirmed", disableRetryOnRateLimit: true });
    connections.set(url, c);
  }
  return c;
}

/**
 * Run `fn` against each endpoint in order: retry once on rate limits, 403s, timeouts
 * and network errors, then fail over. Real errors (e.g. a rejected transaction) throw at once.
 */
export async function withRpc<T>(fn: (conn: Connection, host: string) => Promise<T>, opts: { credits?: number } = {}): Promise<T> {
  let last: RpcError | null = null;
  for (const url of rpcEndpoints()) {
    const host = hostOf(url);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const out = await fn(connectionFor(url), host);
        record(host, opts.credits ?? 1, false);
        return out;
      } catch (err) {
        const e = classifyRpcError(err, host);
        record(host, 1, true);
        if (!e.retryable) throw err;
        last = e;
        if (e.code === "rpc-forbidden" || e.code === "rpc-unsupported") break;
        if (attempt === 0) await new Promise((r) => setTimeout(r, 300 + Math.random() * 300));
      }
    }
  }
  throw last ?? new RpcError("rpc-error", "All RPC endpoints failed", "", false);
}
