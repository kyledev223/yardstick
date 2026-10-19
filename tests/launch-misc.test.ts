import { describe, expect, it } from "vitest";
import { describeSendError } from "@/lib/launch/send-errors";
import { launchFormSchema, nameKey, validateImage } from "@/lib/launch/validate";
import { looksLikeInsufficientFunds } from "@/lib/launch/build";

describe("launch form validation", () => {
  it("normalises the symbol and accepts a minimal form", () => {
    const r = launchFormSchema.parse({ name: "My Coin", symbol: "$myc", description: "", devBuySol: "0" });
    expect(r.symbol).toBe("MYC");
    expect(r.devBuySol).toBe(0);
  });

  it("rejects long names, bad symbols and over-cap dev buys", () => {
    expect(launchFormSchema.safeParse({ name: "x".repeat(33), symbol: "A" }).success).toBe(false);
    expect(launchFormSchema.safeParse({ name: "A", symbol: "AB-C" }).success).toBe(false);
    expect(launchFormSchema.safeParse({ name: "A", symbol: "ABCDEFGHIJK" }).success).toBe(false);
    expect(launchFormSchema.safeParse({ name: "A", symbol: "A", devBuySol: 2.5 }).success).toBe(false);
    expect(launchFormSchema.safeParse({ name: "A", symbol: "A", devBuySol: -1 }).success).toBe(false);
  });

  it("checks social links", () => {
    expect(launchFormSchema.safeParse({ name: "A", symbol: "A", twitter: "https://x.com/abc" }).success).toBe(true);
    expect(launchFormSchema.safeParse({ name: "A", symbol: "A", twitter: "https://evil.com/x.com" }).success).toBe(false);
    expect(launchFormSchema.safeParse({ name: "A", symbol: "A", telegram: "https://t.me/abc" }).success).toBe(true);
    expect(launchFormSchema.safeParse({ name: "A", symbol: "A", website: "http://insecure.com" }).success).toBe(false);
  });

  it("validates images", () => {
    expect(validateImage(null)).toMatch(/required/);
    expect(validateImage({ type: "image/svg+xml", size: 100 })).toMatch(/PNG/);
    expect(validateImage({ type: "image/png", size: 10 * 1024 * 1024 })).toMatch(/MB/);
    expect(validateImage({ type: "image/png", size: 1000 })).toBeNull();
  });

  it("nameKey keeps letters and digits only", () => {
    expect(nameKey("Dog Wif Hat!")).toBe("dogwifhat");
  });
});

describe("send errors", () => {
  it("maps an expired blockhash", () => {
    expect(describeSendError(new Error("Transaction simulation failed: Blockhash not found")).code).toBe("blockhash-expired");
  });
  it("maps an empty wallet", () => {
    const err = Object.assign(new Error("Simulation failed"), { transactionMessage: "Attempt to debit an account but found no record of a prior credit." });
    expect(describeSendError(err).code).toBe("insufficient-sol");
  });
  it("keeps logs from SendTransactionError", () => {
    const err = Object.assign(new Error("failed"), { transactionLogs: ["Program log: custom error"] });
    const f = describeSendError(err);
    expect(f.code).toBe("simulation-failed");
    expect(f.logs).toEqual(["Program log: custom error"]);
  });
  it("detects insufficient funds in simulation output", () => {
    expect(looksLikeInsufficientFunds("AccountNotFound")).toBe(true);
    expect(looksLikeInsufficientFunds({ InstructionError: [2, { Custom: 1 }] }, ["Transfer: insufficient lamports 100, need 2000"])).toBe(true);
    expect(looksLikeInsufficientFunds({ InstructionError: [2, { Custom: 6000 }] }, [])).toBe(false);
  });
});
