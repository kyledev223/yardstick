// Finds a recent graduation (CompleteEvent) and saves it as tests/fixtures/graduation.json.
// Usage: npx tsx scripts/find-graduation.ts
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Connection, PublicKey } from "@solana/web3.js";
const require = createRequire(import.meta.url);
const { OnlinePumpSdk, bondingCurvePda } = require("@pump-fun/pump-sdk");
const RPC = "https://api.mainnet-beta.solana.com";
const COMPLETE_B58_PREFIX = Buffer.from([228, 69, 165, 46, 81, 203, 154, 29, 95, 114, 97, 156, 212, 46, 152, 8]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function rpc(method: string, params: unknown[]) {
  for (let i = 0; i < 6; i++) {
    const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    if (r.status === 429) { await sleep(2000 * (i + 1)); continue; }
    const j = await r.json(); if (j.error) throw new Error(JSON.stringify(j.error)); return j.result;
  }
  throw new Error("rate limited");
}
const getTx = (s: string) => rpc("getTransaction", [s, { encoding: "json", maxSupportedTransactionVersion: 1 }]);
async function main() {
  const bs58 = (await import("bs58")).default;
  const global = await new OnlinePumpSdk(new Connection(RPC)).fetchGlobal();
  const wa = global.withdrawAuthority.toBase58();
  console.log("withdrawAuthority", wa);
  const sigs = await rpc("getSignaturesForAddress", [wa, { limit: 15 }]);
  for (const s of sigs.filter((x: { err: unknown }) => !x.err)) {
    await sleep(600);
    const tx = await getTx(s.signature);
    const mints = (tx.meta.postTokenBalances ?? []).map((b: { mint: string }) => b.mint).filter((m: string) => m !== "So11111111111111111111111111111111111111112");
    for (const mint of [...new Set<string>(mints)]) {
      const curve = bondingCurvePda(new PublicKey(mint)).toBase58();
      const csigs = await rpc("getSignaturesForAddress", [curve, { limit: 12 }]);
      for (const c of csigs.filter((x: { err: unknown }) => !x.err)) {
        await sleep(600);
        const ctx = await getTx(c.signature);
        const has = (ctx.meta.innerInstructions ?? []).some((g: { instructions: { data: string }[] }) =>
          g.instructions.some((ix) => { try { return Buffer.from(bs58.decode(ix.data)).subarray(0, 16).equals(COMPLETE_B58_PREFIX); } catch { return false; } }));
        if (has) {
          writeFileSync("tests/fixtures/graduation.json", JSON.stringify({ signature: c.signature, ...ctx }, null, 1));
          console.log("saved graduation", mint, c.signature);
          return;
        }
      }
    }
  }
  console.log("no graduation found in recent window");
}
main().catch((e) => { console.error(e); process.exit(1); });
