"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { AddressLookupTableProgram, Connection, PublicKey, Transaction } from "@solana/web3.js";
import { useEffect, useState } from "react";
import { WalletDialog } from "@/components/wallet-button";
import { api } from "@/lib/client/api";
import { PUBLIC_RPC, solscanAccount } from "@/lib/config";

type Status = { configured: false } | { configured: true; key: string; ok: boolean; problem?: string; frozen?: boolean; entries?: number; missing?: number };

export function LookupTableSetup() {
  const { publicKey, sendTransaction } = useWallet();
  const [open, setOpen] = useState(false);
  const [addresses, setAddresses] = useState<string[] | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    api<{ addresses: string[]; status: Status }>("/api/setup/lookup-table").then((r) => {
      if (r.ok) {
        setAddresses(r.addresses);
        setStatus(r.status);
      } else setLog([r.error.message]);
    });
  }, []);

  async function create() {
    if (!publicKey || !addresses) return setOpen(true);
    setBusy(true);
    setLog([]);
    const say = (m: string) => setLog((l) => [...l, m]);
    try {
      // One-time admin step: the browser talks to the public RPC directly here.
      const conn = new Connection(PUBLIC_RPC, "confirmed");
      const send = async (tx: Transaction, label: string) => {
        const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
        tx.feePayer = publicKey;
        tx.recentBlockhash = blockhash;
        say(`${label}: approve in your wallet…`);
        const sig = await sendTransaction(tx, conn);
        await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
        say(`${label}: confirmed (${sig.slice(0, 10)}…)`);
      };
      const slot = await conn.getSlot("finalized");
      const [createIx, table] = AddressLookupTableProgram.createLookupTable({ authority: publicKey, payer: publicKey, recentSlot: slot });
      const keys = addresses.map((a) => new PublicKey(a));
      const first = keys.slice(0, 20);
      const rest = keys.slice(20);
      await send(new Transaction().add(createIx, AddressLookupTableProgram.extendLookupTable({ lookupTable: table, authority: publicKey, payer: publicKey, addresses: first })), "Create table");
      if (rest.length) await send(new Transaction().add(AddressLookupTableProgram.extendLookupTable({ lookupTable: table, authority: publicKey, payer: publicKey, addresses: rest })), "Add remaining addresses");
      // Wait a moment so the extension is visible before freezing.
      await new Promise((r) => setTimeout(r, 1500));
      await send(new Transaction().add(AddressLookupTableProgram.freezeLookupTable({ lookupTable: table, authority: publicKey })), "Freeze table");
      setResult(table.toBase58());
    } catch (e) {
      say(`Stopped: ${(e as Error)?.message ?? e}. Nothing further was sent.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card-sm p-5 text-small">
        <p className="font-medium">Current status</p>
        {!status ? (
          <div className="skeleton mt-2 h-4 w-64" />
        ) : !status.configured ? (
          <p className="mt-1 text-muted">PUMP_LOOKUP_TABLE is not set. Launches without a dev buy work; launches with a dev buy may be too large for one transaction.</p>
        ) : status.ok ? (
          <p className="mt-1 text-muted">
            Using <span className="addr break-all text-ink">{status.key}</span>: {status.entries} addresses, {status.frozen ? "frozen" : "not frozen"}
            {status.missing ? `, ${status.missing} address(es) not in the table (they're added to each transaction instead)` : ""}.
          </p>
        ) : (
          <p className="mt-1 text-down">
            PUMP_LOOKUP_TABLE is set to <span className="addr break-all">{status.key}</span> but it is {status.problem}.
          </p>
        )}
      </div>

      <div>
        <p className="text-small text-muted">
          This creates a lookup table from your wallet holding the {addresses?.length ?? "…"} pump.fun accounts every launch uses, then freezes it so it can never change or be closed. It costs about
          0.006 SOL of rent, which a frozen table can&apos;t give back. You approve three small transactions.
        </p>
        <button type="button" onClick={create} disabled={busy || !addresses} className="btn btn-primary btn-lg mt-5">
          {!publicKey ? "Connect wallet" : busy ? "Working…" : "Create lookup table"}
        </button>
      </div>

      {log.length > 0 && (
        <ol className="num space-y-1 text-small" aria-live="polite">
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ol>
      )}

      {result && (
        <div className="rounded-2xl bg-card p-5 text-small shadow-[inset_0_0_0_1.5px_var(--up)]">
          <p className="font-medium">Table created and frozen.</p>
          <p className="addr mt-2 break-all text-base">{result}</p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-muted">
            <li>In Vercel, open Project → Settings → Environment Variables.</li>
            <li>
              Add <span className="addr text-ink">PUMP_LOOKUP_TABLE</span> with the address above (Production and Preview).
            </li>
            <li>Redeploy. This page will then show the table as in use.</li>
          </ol>
          <a href={solscanAccount(result)} target="_blank" rel="noreferrer" className="link mt-3 inline-block">
            View on Solscan
          </a>
        </div>
      )}

      {addresses && (
        <details className="text-small">
          <summary className="link inline-flex min-h-10 cursor-pointer items-center">Addresses that go in the table</summary>
          <ul className="addr mt-2 space-y-0.5 text-xs text-muted">
            {addresses.map((a) => (
              <li key={a} className="break-all">
                {a}
              </li>
            ))}
          </ul>
        </details>
      )}
      <WalletDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
