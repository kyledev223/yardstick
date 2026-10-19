import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { ed25519 } from "@noble/curves/ed25519.js";
import bs58 from "bs58";
import { cookies } from "next/headers";
import { db } from "./db";
import { env } from "./env";
import { AppError } from "./errors";

const COOKIE = "ys_session";
const SESSION_DAYS = 30;
const NONCE_MINUTES = 10;

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function isWallet(s: string): boolean {
  try {
    return bs58.decode(s).length === 32;
  } catch {
    return false;
  }
}

export function signInMessage(wallet: string, nonce: string, issuedAt: string): string {
  const domain = new URL(env.siteUrl).host;
  return [
    `Sign in to Yardstick`,
    ``,
    `This proves you own this wallet. It costs nothing and sends no transaction.`,
    ``,
    `Domain: ${domain}`,
    `Wallet: ${wallet}`,
    `Nonce: ${nonce}`,
    `Issued: ${issuedAt}`,
  ].join("\n");
}

export async function issueNonce(wallet: string) {
  if (!isWallet(wallet)) throw new AppError("validation-failed", "Invalid wallet address");
  const nonce = randomBytes(16).toString("hex");
  const issuedAt = new Date().toISOString();
  await db().authNonce.create({ data: { nonce, wallet, expiresAt: new Date(Date.now() + NONCE_MINUTES * 60_000) } });
  return { nonce, message: signInMessage(wallet, nonce, issuedAt), issuedAt };
}

export function verifySignature(message: string, signatureB58: string, wallet: string): boolean {
  try {
    return ed25519.verify(bs58.decode(signatureB58), new TextEncoder().encode(message), bs58.decode(wallet));
  } catch {
    return false;
  }
}

/** Verify a signed nonce message, consume the nonce, create a session and set the cookie. */
export async function signIn(wallet: string, nonce: string, issuedAt: string, signature: string) {
  const message = signInMessage(wallet, nonce, issuedAt);
  if (!verifySignature(message, signature, wallet)) throw new AppError("not-signed-in", "Signature didn't verify", 401);
  // Claim the nonce atomically so it can be used only once.
  const claimed = await db().authNonce.updateMany({
    where: { nonce, wallet, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) throw new AppError("not-signed-in", "Sign-in request expired. Try again.", 401);

  const user = await db().user.upsert({ where: { wallet }, create: { wallet }, update: {} });
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db().session.create({ data: { tokenHash: sha256(token), userId: user.id, expiresAt } });
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, secure: env.isProd, sameSite: "lax", path: "/", expires: expiresAt });
  return { wallet };
}

export async function getSession(): Promise<{ userId: string; wallet: string } | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const s = await db().session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!s || s.expiresAt < new Date()) return null;
  return { userId: s.userId, wallet: s.user.wallet };
}

export async function requireSession() {
  const s = await getSession();
  if (!s) throw new AppError("not-signed-in", undefined, 401);
  return s;
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db().session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(COOKIE);
}
