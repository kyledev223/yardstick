import "server-only";
import BN from "bn.js";
import { ComputeBudgetProgram, PublicKey, Transaction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { LAUNCH, NATIVE_MINT } from "../config";
import { AppError } from "../errors";
import { pumpSdk } from "../pump";
import { withRpc } from "../rpc";
import { getLaunchLookupTable } from "./lookup-table";

const MAX_TX_BYTES = 1232;

export type BuildInput = {
  wallet: string;
  mint: string;
  name: string;
  symbol: string;
  uri: string;
  devBuyLamports: bigint;
};

export type BuildResult = {
  transaction: string; // base64, unsigned
  version: "legacy" | 0;
  blockhash: string;
  lastValidBlockHeight: number;
  balanceSol: number;
  estimatedCostSol: number;
};

/** Patterns in simulation errors/logs that mean the wallet can't pay. */
export function looksLikeInsufficientFunds(err: unknown, logs: string[] = []): boolean {
  const e = JSON.stringify(err ?? "");
  if (/InsufficientFunds|AccountNotFound|insufficient lamports/i.test(e)) return true;
  // System program transfer error 1 = ResultWithNegativeLamports / insufficient funds.
  const text = logs.join("\n");
  return /insufficient lamports|insufficient funds|Transfer: insufficient/i.test(text);
}

export async function buildLaunchTx(input: BuildInput): Promise<BuildResult> {
  let sdkMod: ReturnType<typeof pumpSdk>;
  try {
    sdkMod = pumpSdk();
  } catch {
    throw new AppError("pump-sdk-unavailable", undefined, 500);
  }
  const { PumpSdk, OnlinePumpSdk, getBuyTokenAmountFromSolAmount } = sdkMod;
  const sdk = new PumpSdk();
  const user = new PublicKey(input.wallet);
  const mint = new PublicKey(input.mint);
  const withBuy = input.devBuyLamports > 0n;

  const ixs = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: withBuy ? LAUNCH.computeUnitLimitWithBuy : LAUNCH.computeUnitLimit }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: LAUNCH.priorityMicroLamports }),
  ];

  if (!withBuy) {
    ixs.push(await sdk.createV2Instruction({ mint, name: input.name, symbol: input.symbol, uri: input.uri, creator: user, user, mayhemMode: false }));
  } else {
    const { global, feeConfig } = await withRpc(async (conn) => {
      const online = new OnlinePumpSdk(conn);
      const [global, feeConfig] = await Promise.all([online.fetchGlobal(), online.fetchFeeConfig()]);
      return { global, feeConfig };
    }, { credits: 2 });
    const solAmount = new BN(input.devBuyLamports.toString());
    const amount = getBuyTokenAmountFromSolAmount({
      global,
      feeConfig,
      mintSupply: null,
      bondingCurve: null,
      amount: solAmount,
      quoteMint: new PublicKey(NATIVE_MINT),
    });
    ixs.push(
      ...(await sdk.createV2AndBuyInstructions({
        global,
        mint,
        name: input.name,
        symbol: input.symbol,
        uri: input.uri,
        creator: user,
        user,
        amount,
        solAmount,
        mayhemMode: false,
      })),
    );
  }

  const { blockhash, lastValidBlockHeight, balance } = await withRpc(async (conn) => {
    const [bh, balance] = await Promise.all([conn.getLatestBlockhash("confirmed"), conn.getBalance(user, "confirmed")]);
    return { ...bh, balance };
  }, { credits: 2 });

  const balanceSol = balance / 1e9;
  const devBuySol = Number(input.devBuyLamports) / 1e9;
  const estimatedCostSol = LAUNCH.createCostSol + devBuySol * 1.01;

  // Empty wallets fail simulation with unhelpful errors, so say it plainly first.
  if (balance === 0 || balanceSol < devBuySol + 0.005) {
    throw new AppError("insufficient-sol", `Not enough SOL: this wallet has ${balanceSol.toFixed(4)} SOL and the launch needs about ${estimatedCostSol.toFixed(3)} SOL. Nothing was sent.`, 402, { balanceSol, estimatedCostSol });
  }

  // v0 + lookup table when configured (needed for create + dev buy to fit); legacy otherwise.
  const table = await getLaunchLookupTable().catch(() => null);
  const legacy = new Transaction({ feePayer: user, blockhash, lastValidBlockHeight }).add(...ixs);
  const v0 = table ? new VersionedTransaction(new TransactionMessage({ payerKey: user, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message([table])) : null;
  let wire: Buffer;
  try {
    wire = v0 ? Buffer.from(v0.serialize()) : legacy.serialize({ requireAllSignatures: false, verifySignatures: false });
  } catch {
    wire = Buffer.alloc(MAX_TX_BYTES + 1);
  }
  if (wire.length > MAX_TX_BYTES) {
    throw new AppError(
      "tx-too-large",
      withBuy
        ? "A dev buy doesn't fit in one transaction with this name and metadata. Launch without a dev buy, or ask the site owner to set up the lookup table (see /setup)."
        : "The transaction is too large. Try a shorter name or description.",
      422,
    );
  }
  const sim = await withRpc((conn) =>
    conn.simulateTransaction(v0 ?? new VersionedTransaction(legacy.compileMessage()), { sigVerify: false, replaceRecentBlockhash: false, commitment: "confirmed" }),
  );
  if (sim.value.err) {
    const logs = sim.value.logs ?? [];
    if (looksLikeInsufficientFunds(sim.value.err, logs)) {
      throw new AppError("insufficient-sol", `Not enough SOL: this wallet has ${balanceSol.toFixed(4)} SOL and the launch needs about ${estimatedCostSol.toFixed(3)} SOL. Nothing was sent.`, 402, { balanceSol, estimatedCostSol });
    }
    throw new AppError("simulation-failed", undefined, 422, { err: sim.value.err, logs: logs.slice(-12) });
  }

  return {
    transaction: wire.toString("base64"),
    version: v0 ? 0 : "legacy",
    blockhash,
    lastValidBlockHeight,
    balanceSol,
    estimatedCostSol,
  };
}
