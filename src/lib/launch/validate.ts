import { z } from "zod";
import { LAUNCH } from "../config";

const optionalUrl = (hosts: string[] | null, label: string) =>
  z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine(
      (v) => {
        if (!v) return true;
        try {
          const u = new URL(v);
          if (u.protocol !== "https:") return false;
          return hosts ? hosts.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`)) : true;
        } catch {
          return false;
        }
      },
      { message: `${label} must be a full https:// link${hosts ? ` on ${hosts.join(" or ")}` : ""}` },
    );

export const launchFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(LAUNCH.nameMax, `Name must be ${LAUNCH.nameMax} characters or fewer`),
  symbol: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase().replace(/^\$/, ""))
    .pipe(
      z
        .string()
        .min(1, "Symbol is required")
        .max(LAUNCH.symbolMax, `Symbol must be ${LAUNCH.symbolMax} characters or fewer`)
        .regex(/^[A-Z0-9]+$/, "Symbol can use A–Z and 0–9 only"),
    ),
  description: z.string().trim().max(LAUNCH.descriptionMax, `Description must be ${LAUNCH.descriptionMax} characters or fewer`).default(""),
  twitter: optionalUrl(["x.com", "twitter.com"], "X / Twitter"),
  telegram: optionalUrl(["t.me", "telegram.me"], "Telegram"),
  website: optionalUrl(null, "Website"),
  devBuySol: z.coerce
    .number()
    .min(0, "Dev buy can't be negative")
    .max(LAUNCH.devBuyMaxSol, `Dev buy is capped at ${LAUNCH.devBuyMaxSol} SOL`)
    .default(0)
    .transform((n) => Math.round(n * 1e9) / 1e9),
});

export type LaunchForm = z.infer<typeof launchFormSchema>;

export function containsBannedWord(...texts: (string | undefined)[]): string | null {
  const hay = texts.filter(Boolean).join(" ").toLowerCase();
  for (const w of LAUNCH.bannedWords) if (w && hay.includes(w.toLowerCase())) return w;
  return null;
}

export function validateImage(file: { type: string; size: number } | null): string | null {
  if (!file || file.size === 0) return "An image is required";
  if (!LAUNCH.imageTypes.includes(file.type)) return "Image must be PNG, JPEG, WebP or GIF";
  if (file.size > LAUNCH.imageMaxBytes) return `Image must be ${LAUNCH.imageMaxBytes / 1024 / 1024} MB or smaller`;
  return null;
}

/** Lowercase letters and digits only, for name-collision checks. */
export function nameKey(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
}
