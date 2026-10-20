import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { pumpSdk } from "@/lib/pump";
import { parsePumpTx, type RawTx } from "@/lib/pump-events";

// parsePumpTx loads the pump SDK (a large CommonJS require) on first use. Load it once up front with its own
// budget, so that cost isn't charged to the first test's 5s timeout on a busy machine.
beforeAll(() => {
  pumpSdk();
}, 60_000);

const dir = join(__dirname, "fixtures");
const load = (name: string) => JSON.parse(readFileSync(join(dir, name), "utf8")) as RawTx & { signature: string };
const files = readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("global"));

describe("parsePumpTx on recorded mainnet transactions", () => {
  it("decodes creates with mint, creator and SOL quote", () => {
    for (const f of files.filter((f) => /^create-\d/.test(f))) {
      const tx = load(f);
      const p = parsePumpTx(tx, tx.signature);
      expect(p.failed).toBe(false);
      expect(p.creates).toHaveLength(1);
      const c = p.creates[0];
      expect(c.mint).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
      expect(c.creator).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.tokenTotalSupply).toBe(1_000_000_000_000_000n);
      expect(c.timestamp).toBeGreaterThan(1_700_000_000);
      // A dev buy in the same transaction shows up as a trade on the same mint.
      for (const t of p.trades) {
        expect(t.mint).toBe(c.mint);
        expect(t.isBuy).toBe(true);
      }
    }
  });

  it("returns nothing for a failed transaction", () => {
    const tx = load("create-failed.json");
    const p = parsePumpTx(tx, tx.signature);
    expect(p.failed).toBe(true);
    expect(p.creates).toHaveLength(0);
    expect(p.trades).toHaveLength(0);
  });

  it("decodes buys and sells with consistent reserves", () => {
    const buys = files.filter((f) => f.startsWith("trade-buy"));
    const sells = files.filter((f) => f.startsWith("trade-sell"));
    expect(buys.length).toBeGreaterThan(0);
    expect(sells.length).toBeGreaterThan(0);
    for (const f of buys) {
      const p = parsePumpTx(load(f));
      expect(p.trades.some((t) => t.isBuy)).toBe(true);
    }
    for (const f of sells) {
      const p = parsePumpTx(load(f));
      expect(p.trades.some((t) => !t.isBuy)).toBe(true);
    }
    for (const f of [...buys, ...sells]) {
      for (const t of parsePumpTx(load(f)).trades) {
        expect(t.lamports).toBeGreaterThan(0n);
        expect(t.tokens).toBeGreaterThan(0n);
        expect(t.vSol).toBeGreaterThanOrEqual(30_000_000_000n); // virtual SOL starts at 30
        expect(t.vSol - t.rSol).toBe(30_000_000_000n); // real = virtual − initial virtual
      }
    }
  });

  it("detects graduation (CompleteEvent) on the completing buy", () => {
    const p = parsePumpTx(load("graduation.json"));
    expect(p.completes).toEqual(["FkxsbEaJsniL9shyfZzUKAGkPXEm6iovCykiyKhwpump"]);
    const last = p.trades.filter((t) => t.mint === p.completes[0]).at(-1)!;
    expect(last.isBuy).toBe(true);
    expect(last.rTokens).toBe(0n); // curve sold out
  });

  it("numbers events within a transaction", () => {
    for (const f of files) {
      const p = parsePumpTx(load(f));
      expect(p.trades.map((t) => t.idx)).toEqual(p.trades.map((_, i) => i));
    }
  });
});
