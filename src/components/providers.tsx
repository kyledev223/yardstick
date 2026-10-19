"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import bs58 from "bs58";
import { WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { OKXWalletAdapter } from "@/lib/wallet/okx-adapter";
import { api, post, type ApiError } from "@/lib/client/api";

type Auth = {
  /** Wallet with a valid server session, or null. */
  sessionWallet: string | null;
  loading: boolean;
  signIn: () => Promise<ApiError | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);

export function useAuth(): Auth {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth outside provider");
  return v;
}

function AuthProvider({ children }: { children: ReactNode }) {
  const { publicKey, signMessage } = useWallet();
  const [sessionWallet, setSessionWallet] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ wallet: string | null }>("/api/auth/me").then((r) => {
      if (r.ok) setSessionWallet(r.wallet);
      setLoading(false);
    });
  }, []);

  const signIn = useCallback(async (): Promise<ApiError | null> => {
    if (!publicKey) return { code: "not-signed-in", message: "Connect a wallet first." };
    if (!signMessage) return { code: "wallet-unsupported", message: "This wallet can't sign messages. Try Phantom, Solflare or OKX." };
    const wallet = publicKey.toBase58();
    const n = await post<{ nonce: string; message: string; issuedAt: string }>("/api/auth/nonce", { wallet });
    if (!n.ok) return n.error;
    let signature: string;
    try {
      signature = bs58.encode(await signMessage(new TextEncoder().encode(n.message)));
    } catch {
      return { code: "wallet-rejected", message: "You cancelled the sign-in request in your wallet." };
    }
    const v = await post<{ wallet: string }>("/api/auth/verify", { wallet, nonce: n.nonce, issuedAt: n.issuedAt, signature });
    if (!v.ok) return v.error;
    setSessionWallet(v.wallet);
    return null;
  }, [publicKey, signMessage]);

  const signOut = useCallback(async () => {
    await post("/api/auth/logout", {});
    setSessionWallet(null);
  }, []);

  const value = useMemo(() => ({ sessionWallet, loading, signIn, signOut }), [sessionWallet, loading, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function Providers({ children }: { children: ReactNode }) {
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter(), new OKXWalletAdapter()], []);
  return (
    <WalletProvider wallets={wallets} autoConnect>
      <AuthProvider>{children}</AuthProvider>
    </WalletProvider>
  );
}
