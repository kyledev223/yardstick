import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const A = "https://mainnet.helius-rpc.com/?api-key=SECRET123";
const B = "https://backup.example.com";

type Reply = { status?: number; body?: unknown; throws?: Error };

function mockFetch(script: Record<string, Reply[]>) {
  const calls: string[] = [];
  const fn = vi.fn(async (url: string) => {
    const host = new URL(url).hostname;
    calls.push(host);
    const r = script[host]?.shift() ?? { status: 500 };
    if (r.throws) throw r.throws;
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200 });
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

async function freshRpc() {
  vi.resetModules();
  return import("@/lib/rpc");
}

// The first import transforms rpc.ts and loads web3.js; do it once up front with its own budget, so it isn't
// charged to the first test's 5s timeout on a busy machine (each test then re-imports a fresh copy cheaply).
beforeAll(async () => {
  await import("@/lib/rpc");
}, 60_000);

// Retry back-off uses setTimeout: fake it, so retries don't wait in real time. A slow, timed-out test could
// otherwise keep retrying in the background and eat the next test's scripted replies.
beforeEach(() => {
  process.env.SOLANA_RPC_URL = `${A},${B}`;
  delete process.env.HELIUS_API_KEY;
  vi.useFakeTimers({ toFake: ["setTimeout"] });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Lets a call run through its retry back-off without waiting. */
async function settled<T>(p: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return p;
}

describe("rpcCall fail-over", () => {
  it("retries once on 429, then fails over to the next endpoint", async () => {
    const { rpcCall } = await freshRpc();
    const calls = mockFetch({
      "mainnet.helius-rpc.com": [{ status: 429 }, { status: 429 }],
      "backup.example.com": [{ body: { result: 42 } }],
    });
    await expect(settled(rpcCall("getSlot", []))).resolves.toBe(42);
    expect(calls).toEqual(["mainnet.helius-rpc.com", "mainnet.helius-rpc.com", "backup.example.com"]);
  });

  it("fails over immediately on 403", async () => {
    const { rpcCall } = await freshRpc();
    const calls = mockFetch({ "mainnet.helius-rpc.com": [{ status: 403 }], "backup.example.com": [{ body: { result: "ok" } }] });
    await expect(rpcCall("getSlot", [])).resolves.toBe("ok");
    expect(calls).toEqual(["mainnet.helius-rpc.com", "backup.example.com"]);
  });

  it("retries network errors and timeouts", async () => {
    const { rpcCall } = await freshRpc();
    mockFetch({ "mainnet.helius-rpc.com": [{ throws: new TypeError("fetch failed") }, { body: { result: 1 } }] });
    await expect(settled(rpcCall("getSlot", []))).resolves.toBe(1);
  });

  it("does not retry real errors", async () => {
    const { rpcCall, RpcError } = await freshRpc();
    const calls = mockFetch({ "mainnet.helius-rpc.com": [{ body: { error: { code: -32002, message: "Transaction simulation failed: custom program error 0x1771" } } }] });
    const err = (await rpcCall("sendTransaction", []).catch((e) => e)) as InstanceType<typeof RpcError>;
    expect(err).toBeInstanceOf(RpcError);
    expect(err.code).toBe("rpc-error");
    expect(calls).toHaveLength(1);
  });

  it("skips endpoints that don't support a method, and remembers it", async () => {
    const { rpcCall, isMethodSupported } = await freshRpc();
    const calls = mockFetch({
      "mainnet.helius-rpc.com": [{ body: { error: { code: -32601, message: "Method not found" } } }],
      "backup.example.com": [{ body: { result: [] } }, { body: { result: [] } }],
    });
    await rpcCall("getTransactionsForAddress", []);
    await rpcCall("getTransactionsForAddress", []);
    expect(calls).toEqual(["mainnet.helius-rpc.com", "backup.example.com", "backup.example.com"]);
    expect(isMethodSupported("getTransactionsForAddress", "helius")).toBe(false);
  });

  it("restricts DAS-style methods to matching hosts", async () => {
    const { rpcCall } = await freshRpc();
    const calls = mockFetch({ "mainnet.helius-rpc.com": [{ body: { result: { token_accounts: [] } } }] });
    await rpcCall("getTokenAccounts", { mint: "x" }, { hostIncludes: "helius" });
    expect(calls).toEqual(["mainnet.helius-rpc.com"]);
  });

  it("always appends the public RPC last", async () => {
    vi.resetModules();
    const { rpcEndpoints } = await import("@/lib/env");
    expect(rpcEndpoints().at(-1)).toBe("https://api.mainnet-beta.solana.com");
  });

  it("counts credits only for Helius", async () => {
    const { rpcCall, drainRpcUsage } = await freshRpc();
    mockFetch({ "mainnet.helius-rpc.com": [{ body: { result: { token_accounts: [] } } }], "backup.example.com": [{ body: { result: 1 } }] });
    await rpcCall("getTokenAccounts", { mint: "x" }, { hostIncludes: "helius" });
    await rpcCall("getSlot", [], { hostIncludes: "backup" });
    const usage = Object.fromEntries(drainRpcUsage().map((u) => [u.host, u.credits]));
    expect(usage["mainnet.helius-rpc.com"]).toBe(10);
    expect(usage["backup.example.com"]).toBe(0);
  });
});

describe("error classification and redaction", () => {
  it("classifies common failures", async () => {
    const { classifyRpcError } = await freshRpc();
    expect(classifyRpcError(new Error("429 Too Many Requests")).code).toBe("rpc-rate-limited");
    expect(classifyRpcError(Object.assign(new Error("x"), { status: 403 })).code).toBe("rpc-forbidden");
    expect(classifyRpcError(new Error("The operation was aborted due to timeout")).code).toBe("rpc-timeout");
    expect(classifyRpcError(new Error("fetch failed")).code).toBe("rpc-network");
    expect(classifyRpcError(new Error("Blockhash not found")).retryable).toBe(false);
  });

  it("never leaks API keys", async () => {
    const { redact, classifyRpcError, hostOf } = await freshRpc();
    expect(redact(`failed to POST ${A}`)).not.toContain("SECRET123");
    expect(classifyRpcError(new Error(`request to ${A} failed`)).message).not.toContain("SECRET123");
    expect(hostOf(A)).toBe("mainnet.helius-rpc.com");
  });
});
