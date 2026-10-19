"use client";
import {
  BaseMessageSignerWalletAdapter,
  WalletConnectionError,
  WalletDisconnectionError,
  WalletNotConnectedError,
  WalletNotReadyError,
  WalletReadyState,
  WalletSignMessageError,
  WalletSignTransactionError,
  type WalletName,
} from "@solana/wallet-adapter-base";
import { PublicKey, type Transaction, type TransactionVersion, type VersionedTransaction } from "@solana/web3.js";

type OkxProvider = {
  publicKey?: { toBytes(): Uint8Array } | null;
  isConnected?: boolean;
  connect(): Promise<{ publicKey: { toBytes(): Uint8Array } } | void>;
  disconnect(): Promise<void>;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;
  signMessage(message: Uint8Array, display?: string): Promise<{ signature: Uint8Array } | Uint8Array>;
  on?(event: string, cb: (...a: unknown[]) => void): void;
  off?(event: string, cb: (...a: unknown[]) => void): void;
};

declare global {
  interface Window {
    okxwallet?: { solana?: OkxProvider };
  }
}

export const OKXWalletName = "OKX Wallet" as WalletName<"OKX Wallet">;

// Simple OKX mark: four squares, drawn inline so no external asset is needed.
const ICON =
  "data:image/svg+xml;base64," +
  (typeof btoa === "function"
    ? btoa(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="8" fill="#000"/><g fill="#fff"><rect x="8" y="8" width="8" height="8"/><rect x="24" y="8" width="8" height="8"/><rect x="16" y="16" width="8" height="8"/><rect x="8" y="24" width="8" height="8"/><rect x="24" y="24" width="8" height="8"/></g></svg>',
      )
    : "");

/** Minimal adapter around window.okxwallet.solana. */
export class OKXWalletAdapter extends BaseMessageSignerWalletAdapter {
  name = OKXWalletName;
  url = "https://www.okx.com/web3";
  icon = ICON;
  readonly supportedTransactionVersions: ReadonlySet<TransactionVersion> = new Set(["legacy", 0]);

  private _provider: OkxProvider | null = null;
  private _publicKey: PublicKey | null = null;
  private _connecting = false;
  private _readyState: WalletReadyState = typeof window === "undefined" ? WalletReadyState.Unsupported : WalletReadyState.NotDetected;

  constructor() {
    super();
    if (this._readyState !== WalletReadyState.Unsupported) {
      const detect = () => {
        if (window.okxwallet?.solana) {
          this._readyState = WalletReadyState.Installed;
          this.emit("readyStateChange", this._readyState);
          return true;
        }
        return false;
      };
      if (!detect()) {
        let tries = 0;
        const t = setInterval(() => {
          if (detect() || ++tries > 20) clearInterval(t);
        }, 250);
      }
    }
  }

  get publicKey() {
    return this._publicKey;
  }
  get connecting() {
    return this._connecting;
  }
  get readyState() {
    return this._readyState;
  }

  async connect(): Promise<void> {
    if (this.connected || this.connecting) return;
    if (this._readyState !== WalletReadyState.Installed) throw new WalletNotReadyError();
    this._connecting = true;
    try {
      const provider = window.okxwallet!.solana!;
      let res;
      try {
        res = await provider.connect();
      } catch (e) {
        throw new WalletConnectionError((e as Error)?.message, e);
      }
      const pk = (res && "publicKey" in res ? res.publicKey : provider.publicKey) ?? null;
      if (!pk) throw new WalletConnectionError("No public key");
      this._publicKey = new PublicKey(pk.toBytes());
      this._provider = provider;
      provider.on?.("disconnect", this._onDisconnect);
      this.emit("connect", this._publicKey);
    } catch (e) {
      this.emit("error", e as WalletConnectionError);
      throw e;
    } finally {
      this._connecting = false;
    }
  }

  private _onDisconnect = () => {
    if (this._provider) {
      this._provider.off?.("disconnect", this._onDisconnect);
      this._provider = null;
      this._publicKey = null;
      this.emit("disconnect");
    }
  };

  async disconnect(): Promise<void> {
    const p = this._provider;
    if (p) {
      p.off?.("disconnect", this._onDisconnect);
      this._provider = null;
      this._publicKey = null;
      try {
        await p.disconnect();
      } catch (e) {
        this.emit("error", new WalletDisconnectionError((e as Error)?.message, e));
      }
    }
    this.emit("disconnect");
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if (!this._provider) throw new WalletNotConnectedError();
    try {
      return await this._provider.signTransaction(tx);
    } catch (e) {
      throw new WalletSignTransactionError((e as Error)?.message, e);
    }
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    if (!this._provider) throw new WalletNotConnectedError();
    try {
      return await this._provider.signAllTransactions(txs);
    } catch (e) {
      throw new WalletSignTransactionError((e as Error)?.message, e);
    }
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (!this._provider) throw new WalletNotConnectedError();
    try {
      const r = await this._provider.signMessage(message, "utf8");
      return r instanceof Uint8Array ? r : r.signature;
    } catch (e) {
      throw new WalletSignMessageError((e as Error)?.message, e);
    }
  }
}
