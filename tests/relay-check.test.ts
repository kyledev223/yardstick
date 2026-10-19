import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import BN from "bn.js";
import { AddressLookupTableAccount, ComputeBudgetProgram, Keypair, PublicKey, SystemProgram, Transaction, TransactionMessage, VersionedTransaction, type TransactionInstruction } from "@solana/web3.js";
import { beforeAll, describe, expect, it } from "vitest";
import { checkLaunchTx, decodeBuy, decodeCreateV2, normaliseV0, type RelayExpectation } from "@/lib/launch/relay-check";

const require = createRequire(import.meta.url);
const pump = require("@pump-fun/pump-sdk") as typeof import("@pump-fun/pump-sdk");

const BLOCKHASH = "GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi";
const NAME = "Yardstick Test";
const SYMBOL = "YARD";
const URI = "https://ipfs.io/ipfs/QmTestMetadata";
const DEV_BUY = 100_000_000n; // 0.1 SOL

let global: import("@pump-fun/pump-sdk").Global;

beforeAll(() => {
  const raw = JSON.parse(readFileSync(join(__dirname, "fixtures", "global-account.json"), "utf8"));
  global = new pump.PumpSdk().decodeGlobal({ data: Buffer.from(raw.data[0], "base64"), owner: new PublicKey(raw.owner), lamports: raw.lamports, executable: false, rentEpoch: 0 });
});

async function createIxs(user: PublicKey, mint: PublicKey, devBuy: bigint, overrides: Partial<{ name: string; uri: string; creator: PublicKey; mayhem: boolean }> = {}) {
  const sdk = new pump.PumpSdk();
  const base = { mint, name: overrides.name ?? NAME, symbol: SYMBOL, uri: overrides.uri ?? URI, creator: overrides.creator ?? user, user, mayhemMode: overrides.mayhem ?? false };
  if (devBuy === 0n) return [await sdk.createV2Instruction(base)];
  const amount = pump.getBuyTokenAmountFromSolAmount({ global, feeConfig: null, mintSupply: null, bondingCurve: null, amount: new BN(devBuy.toString()), quoteMint: PublicKey.default });
  return sdk.createV2AndBuyInstructions({ ...base, global, amount, solAmount: new BN(devBuy.toString()) });
}

function makeTx(user: Keypair, mint: Keypair, ixs: TransactionInstruction[], sign: Keypair[] = [user, mint]) {
  const tx = new Transaction({ feePayer: user.publicKey, blockhash: BLOCKHASH, lastValidBlockHeight: 1 });
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }), ...ixs);
  // Wallet signs first, then the mint partial-signs (as in the browser).
  if (sign.includes(user)) tx.partialSign(user);
  if (sign.includes(mint)) tx.partialSign(mint);
  return tx;
}

const expectFor = (user: Keypair, mint: Keypair, devBuy = 0n): RelayExpectation => ({
  feePayer: user.publicKey.toBase58(),
  mint: mint.publicKey.toBase58(),
  name: NAME,
  symbol: SYMBOL,
  uri: URI,
  devBuyLamports: devBuy,
  blockhash: BLOCKHASH,
});

describe("relay checker: create only", () => {
  it("accepts a correct, fully signed create", async () => {
    const user = Keypair.generate();
    const mint = Keypair.generate();
    const tx = makeTx(user, mint, await createIxs(user.publicKey, mint.publicKey, 0n));
    expect(checkLaunchTx(tx, expectFor(user, mint))).toEqual({ ok: true });
  });

  it("decodes the SDK's create_v2 arguments", async () => {
    const user = Keypair.generate();
    const mint = Keypair.generate();
    const [ix] = await createIxs(user.publicKey, mint.publicKey, 0n);
    const args = decodeCreateV2(ix.data)!;
    expect(args).toMatchObject({ name: NAME, symbol: SYMBOL, uri: URI, creator: user.publicKey.toBase58(), mayhem: false, cashback: false, creatorFeeBps: 0n, holderReward: false });
  });

  it("rejects the wrong fee payer", async () => {
    const user = Keypair.generate();
    const mint = Keypair.generate();
    const tx = makeTx(user, mint, await createIxs(user.publicKey, mint.publicKey, 0n));
    const r = checkLaunchTx(tx, { ...expectFor(user, mint), feePayer: Keypair.generate().publicKey.toBase58() });
    expect(r.ok).toBe(false);
  });

  it("rejects an extra instruction (e.g. a SOL transfer)", async () => {
    const user = Keypair.generate();
    const mint = Keypair.generate();
    const transfer = SystemProgram.transfer({ fromPubkey: user.publicKey, toPubkey: Keypair.generate().publicKey, lamports: 1_000_000 });
    const tx = makeTx(user, mint, [...(await createIxs(user.publicKey, mint.publicKey, 0n)), transfer]);
    const r = checkLaunchTx(tx, expectFor(user, mint));
    expect(r).toMatchObject({ ok: false });
    expect((r as { reason: string }).reason).toMatch(/unexpected program/);
  });

  it("rejects a mismatched mint", async () => {
    const user = Keypair.generate();
    const mint = Keypair.generate();
    const tx = makeTx(user, mint, await createIxs(user.publicKey, mint.publicKey, 0n));
    expect(checkLaunchTx(tx, { ...expectFor(user, mint), mint: Keypair.generate().publicKey.toBase58() }).ok).toBe(false);
  });

  it("rejects a mismatched URI or name", async () => {
    const user = Keypair.generate();
    const mint = Keypair.generate();
    const tx1 = makeTx(user, mint, await createIxs(user.publicKey, mint.publicKey, 0n, { uri: "https://evil.example/x.json" }));
    expect(checkLaunchTx(tx1, expectFor(user, mint)).ok).toBe(false);
    const tx2 = makeTx(user, mint, await createIxs(user.publicKey, mint.publicKey, 0n, { name: "Other" }));
    expect(checkLaunchTx(tx2, expectFor(user, mint)).ok).toBe(false);
  });

  it("rejects a different creator or mayhem mode", async () => {
    const user = Keypair.generate();
    const mint = Keypair.generate();
    const tx1 = makeTx(user, mint, await createIxs(user.publicKey, mint.publicKey, 0n, { creator: Keypair.generate().publicKey }));
    expect(checkLaunchTx(tx1, expectFor(user, mint)).ok).toBe(false);
    const tx2 = makeTx(user, mint, await createIxs(user.publicKey, mint.publicKey, 0n, { mayhem: true }));
    expect(checkLaunchTx(tx2, expectFor(user, mint)).ok).toBe(false);
  });

  it("rejects missing signatures", async () => {
    const user = Keypair.generate();
    const mint = Keypair.generate();
    const ixs = await createIxs(user.publicKey, mint.publicKey, 0n);
    expect(checkLaunchTx(makeTx(user, mint, ixs, [user]), expectFor(user, mint)).ok).toBe(false);
    expect(checkLaunchTx(makeTx(user, mint, ixs, [mint]), expectFor(user, mint)).ok).toBe(false);
  });

  it("rejects a tampered signature", async () => {
    const user = Keypair.generate();
    const mint = Keypair.generate();
    const tx = makeTx(user, mint, await createIxs(user.publicKey, mint.publicKey, 0n));
    tx.signatures[0].signature![5] ^= 0xff;
    const r = checkLaunchTx(tx, expectFor(user, mint));
    expect(r).toMatchObject({ ok: false, reason: "invalid signature" });
  });

  it("rejects a buy when no dev buy was requested", async () => {
    const user = Keypair.generate();
    const mint = Keypair.generate();
    const tx = makeTx(user, mint, await createIxs(user.publicKey, mint.publicKey, DEV_BUY));
    expect(checkLaunchTx(tx, expectFor(user, mint, 0n)).ok).toBe(false);
  });

  it("rejects a stale blockhash", async () => {
    const user = Keypair.generate();
    const mint = Keypair.generate();
    const tx = makeTx(user, mint, await createIxs(user.publicKey, mint.publicKey, 0n));
    expect(checkLaunchTx(tx, { ...expectFor(user, mint), blockhash: "11111111111111111111111111111111" }).ok).toBe(false);
  });

  it("rejects an excessive priority fee", async () => {
    const user = Keypair.generate();
    const mint = Keypair.generate();
    const tx = new Transaction({ feePayer: user.publicKey, blockhash: BLOCKHASH, lastValidBlockHeight: 1 });
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000_000 }), ...(await createIxs(user.publicKey, mint.publicKey, 0n)));
    tx.partialSign(user, mint);
    expect(checkLaunchTx(tx, expectFor(user, mint)).ok).toBe(false);
  });
});

describe("relay checker: create + dev buy", () => {
  it("accepts create + token account + buy at the entered amount", async () => {
    const user = Keypair.generate();
    const mint = Keypair.generate();
    const ixs = await createIxs(user.publicKey, mint.publicKey, DEV_BUY);
    expect(ixs).toHaveLength(3);
    const buy = decodeBuy(ixs[2].data)!;
    expect(buy.maxSolCost).toBe(DEV_BUY + DEV_BUY / 100n); // SDK adds 1%
    expect(buy.amount).toBeGreaterThan(0n);
    expect(checkLaunchTx(makeTx(user, mint, ixs), expectFor(user, mint, DEV_BUY))).toEqual({ ok: true });
  });

  it("rejects a buy for a larger amount than entered", async () => {
    const user = Keypair.generate();
    const mint = Keypair.generate();
    const ixs = await createIxs(user.publicKey, mint.publicKey, DEV_BUY * 3n);
    expect(checkLaunchTx(makeTx(user, mint, ixs), expectFor(user, mint, DEV_BUY)).ok).toBe(false);
  });

  it("rejects a buy for a smaller amount than entered", async () => {
    const user = Keypair.generate();
    const mint = Keypair.generate();
    const ixs = await createIxs(user.publicKey, mint.publicKey, DEV_BUY / 2n);
    expect(checkLaunchTx(makeTx(user, mint, ixs), expectFor(user, mint, DEV_BUY)).ok).toBe(false);
  });

  it("rejects two buys", async () => {
    const user = Keypair.generate();
    const mint = Keypair.generate();
    const ixs = await createIxs(user.publicKey, mint.publicKey, DEV_BUY);
    expect(checkLaunchTx(makeTx(user, mint, [...ixs, ixs[2]]), expectFor(user, mint, DEV_BUY)).ok).toBe(false);
  });

  it("rejects a buy from another wallet", async () => {
    const user = Keypair.generate();
    const mint = Keypair.generate();
    const other = Keypair.generate();
    const own = await createIxs(user.publicKey, mint.publicKey, DEV_BUY);
    const foreign = await createIxs(other.publicKey, mint.publicKey, DEV_BUY);
    // Swap in a buy whose user is someone else.
    expect(checkLaunchTx(makeTx(user, mint, [own[0], own[1], foreign[2]]), expectFor(user, mint, DEV_BUY)).ok).toBe(false);
  });

  it("rejects a dev-buy launch with the buy missing", async () => {
    const user = Keypair.generate();
    const mint = Keypair.generate();
    const ixs = await createIxs(user.publicKey, mint.publicKey, DEV_BUY);
    expect(checkLaunchTx(makeTx(user, mint, [ixs[0], ixs[1]]), expectFor(user, mint, DEV_BUY)).ok).toBe(false);
  });
});

describe("relay checker: v0 with lookup table", () => {
  function table(ixs: TransactionInstruction[], exclude: PublicKey[]) {
    const skip = new Set(exclude.map((k) => k.toBase58()));
    const addrs = new Map<string, PublicKey>();
    for (const ix of ixs) for (const k of ix.keys) if (!skip.has(k.pubkey.toBase58())) addrs.set(k.pubkey.toBase58(), k.pubkey);
    return new AddressLookupTableAccount({
      key: Keypair.generate().publicKey,
      state: { deactivationSlot: BigInt("18446744073709551615"), lastExtendedSlot: 0, lastExtendedSlotStartIndex: 0, addresses: [...addrs.values()] },
    });
  }
  async function build(user: Keypair, mint: Keypair, devBuy: bigint) {
    const ixs = [ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }), ...(await createIxs(user.publicKey, mint.publicKey, devBuy))];
    const alt = table(ixs, [user.publicKey, mint.publicKey]);
    const vtx = new VersionedTransaction(new TransactionMessage({ payerKey: user.publicKey, recentBlockhash: BLOCKHASH, instructions: ixs }).compileToV0Message([alt]));
    return { vtx, alt };
  }

  it("accepts a v0 create + dev buy signed by wallet then mint, and it fits", async () => {
    const user = Keypair.generate();
    const mint = Keypair.generate();
    const { vtx, alt } = await build(user, mint, DEV_BUY);
    vtx.sign([user]);
    vtx.sign([mint]);
    expect(vtx.serialize().length).toBeLessThanOrEqual(1232);
    const n = normaliseV0(vtx, [alt]);
    expect("error" in n).toBe(false);
    expect(checkLaunchTx(n as Exclude<typeof n, { error: string }>, expectFor(user, mint, DEV_BUY))).toEqual({ ok: true });
  });

  it("rejects a table other than the site's own", async () => {
    const user = Keypair.generate();
    const mint = Keypair.generate();
    const { vtx } = await build(user, mint, DEV_BUY);
    vtx.sign([user, mint]);
    const other = new AddressLookupTableAccount({ key: Keypair.generate().publicKey, state: { deactivationSlot: 0n, lastExtendedSlot: 0, lastExtendedSlotStartIndex: 0, addresses: [] } });
    expect(normaliseV0(vtx, [other])).toEqual({ error: "uses an unexpected lookup table" });
  });

  it("rejects missing or tampered v0 signatures", async () => {
    const user = Keypair.generate();
    const mint = Keypair.generate();
    const { vtx, alt } = await build(user, mint, DEV_BUY);
    vtx.sign([user]);
    const missing = normaliseV0(vtx, [alt]) as Exclude<ReturnType<typeof normaliseV0>, { error: string }>;
    expect(checkLaunchTx(missing, expectFor(user, mint, DEV_BUY))).toMatchObject({ ok: false, reason: "missing signature" });
    vtx.sign([mint]);
    vtx.signatures[1][3] ^= 0xff;
    const bad = normaliseV0(vtx, [alt]) as Exclude<ReturnType<typeof normaliseV0>, { error: string }>;
    expect(checkLaunchTx(bad, expectFor(user, mint, DEV_BUY))).toMatchObject({ ok: false, reason: "invalid signature" });
  });

  it("legacy create + dev buy with a full-length name would not fit", async () => {
    const user = Keypair.generate();
    const mint = Keypair.generate();
    const sdk = new pump.PumpSdk();
    const amount = pump.getBuyTokenAmountFromSolAmount({ global, feeConfig: null, mintSupply: null, bondingCurve: null, amount: new BN(DEV_BUY.toString()), quoteMint: PublicKey.default });
    const ixs = await sdk.createV2AndBuyInstructions({ global, mint: mint.publicKey, name: "Y".repeat(32), symbol: "ABCDEFGHIJ", uri: "https://ipfs.io/ipfs/bafkreiaiasuudeoqww7yza5nhu6izt4pts2xoed223fdjqbwtnzzlugmhq", creator: user.publicKey, user: user.publicKey, amount, solAmount: new BN(DEV_BUY.toString()), mayhemMode: false });
    const tx = new Transaction({ feePayer: user.publicKey, blockhash: BLOCKHASH, lastValidBlockHeight: 1 }).add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }), ...ixs);
    expect(() => tx.serialize({ requireAllSignatures: false, verifySignatures: false })).toThrow(/too large/);
  });
});
