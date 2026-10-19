// Records real mainnet pump transactions into tests/fixtures for the trade-parsing tests.
// Usage: npx tsx scripts/record-fixtures.ts   (uses the public RPC; no key needed)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PublicKey } from "@solana/web3.js";

const RPC = process.env.FIXTURE_RPC || "https://api.mainnet-beta.solana.com";
const PUMP = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const MINT_AUTHORITY = "TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM";
const MIGRATION_AUTHORITY = "39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg";
const OUT = join(process.cwd(), "tests", "fixtures");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    if (r.status === 429) {
      await sleep(1500 * (i + 1));
      continue;
    }
    const j = await r.json();
    if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`);
    return j.result as T;
  }
  throw new Error("rate limited");
}
type Sig = { signature: string; err: unknown; blockTime: number };
const getTx = (sig: string) => rpc<Record<string, unknown>>("getTransaction", [sig, { encoding: "json", maxSupportedTransactionVersion: 1, commitment: "confirmed" }]);
const save = (name: string, sig: string, tx: unknown) => {
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify({ signature: sig, ...(tx as object) }, null, 1));
  console.log("saved", name, sig.slice(0, 16));
};
const curveOf = (mint: string) => PublicKey.findProgramAddressSync([Buffer.from("bonding-curve"), new PublicKey(mint).toBuffer()], PUMP)[0].toBase58();

async function main() {
  mkdirSync(OUT, { recursive: true });

  // 1. Recent creates (plain and create+buy) plus one failed create.
  const creates = await rpc<Sig[]>("getSignaturesForAddress", [MINT_AUTHORITY, { limit: 60 }]);
  const failed = creates.find((s) => s.err);
  if (failed) save("create-failed", failed.signature, await getTx(failed.signature));
  let n = 0;
  let mintForTrades = "";
  for (const s of creates.filter((s) => !s.err)) {
    if (n >= 3) break;
    await sleep(500);
    const tx = (await getTx(s.signature)) as { meta: { postTokenBalances?: { mint: string }[] } };
    save(`create-${n}`, s.signature, tx);
    mintForTrades ||= tx.meta.postTokenBalances?.[0]?.mint ?? "";
    n++;
  }

  // 2. Trades on an older, active coin: walk back to find a busy curve with sells.
  const older = await rpc<Sig[]>("getSignaturesForAddress", [MINT_AUTHORITY, { limit: 1000 }]);
  for (const s of older.slice(-200).filter((x) => !x.err)) {
    await sleep(400);
    const tx = (await getTx(s.signature)) as { meta: { postTokenBalances?: { mint: string }[] } };
    const mint = tx.meta.postTokenBalances?.find((b) => b.mint.endsWith("pump"))?.mint ?? tx.meta.postTokenBalances?.[0]?.mint;
    if (!mint) continue;
    const sigs = await rpc<Sig[]>("getSignaturesForAddress", [curveOf(mint), { limit: 100 }]);
    if (sigs.length < 20) continue;
    let buys = 0, sells = 0;
    for (const t of sigs.filter((x) => !x.err).slice(0, 40)) {
      await sleep(400);
      const ttx = (await getTx(t.signature)) as { meta: { logMessages?: string[] } };
      const logs = (ttx.meta.logMessages ?? []).join("\n");
      if (/Instruction: Sell/.test(logs) && sells < 2) save(`trade-sell-${sells++}`, t.signature, ttx);
      else if (/Instruction: Buy/.test(logs) && buys < 2) save(`trade-buy-${buys++}`, t.signature, ttx);
      if (buys >= 2 && sells >= 2) break;
    }
    if (sells > 0) break;
  }

  // 3. A graduation: the migration authority signs migrate txs; the completing buy is just before.
  const migrations = await rpc<Sig[]>("getSignaturesForAddress", [MIGRATION_AUTHORITY, { limit: 10 }]);
  for (const m of migrations.filter((x) => !x.err)) {
    await sleep(500);
    const tx = (await getTx(m.signature)) as { meta: { postTokenBalances?: { mint: string }[] } };
    const mint = tx.meta.postTokenBalances?.find((b) => b.mint.endsWith("pump"))?.mint;
    if (!mint) continue;
    const sigs = await rpc<Sig[]>("getSignaturesForAddress", [curveOf(mint), { limit: 15 }]);
    for (const t of sigs.filter((x) => !x.err)) {
      await sleep(400);
      const ttx = (await getTx(t.signature)) as { meta: { logMessages?: string[] } };
      if ((ttx.meta.logMessages ?? []).some((l) => l.includes("Instruction: Buy"))) {
        const data = JSON.stringify(ttx);
        // CompleteEvent discriminator appears base58-encoded inside inner ix data; just save candidates.
        save(`graduation-candidate-${t.signature.slice(0, 6)}`, t.signature, ttx);
        if (data.length) break;
      }
    }
    break;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
