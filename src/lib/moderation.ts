import { MODERATION } from "./config";

// Look-alike characters folded to the letter they imitate. Digits fold separately (see forms()), so "1488" still reads as written.
const LOOKALIKE: Record<string, string> = {
  "@": "a", $: "s", "!": "i", "|": "i", "€": "e", "£": "l", "¡": "i",
  // Cyrillic
  а: "a", в: "b", е: "e", ё: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c", т: "t", у: "y", х: "x", і: "i", ї: "i", ј: "j", ѕ: "s", ԁ: "d", ԛ: "q", ԝ: "w", ɡ: "g",
  // Greek
  α: "a", β: "b", ε: "e", η: "n", ι: "i", κ: "k", ν: "v", ο: "o", ρ: "p", τ: "t", υ: "u", χ: "x", ω: "w",
};
const DIGITS: Record<string, string> = { "0": "o", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g" };
const INVISIBLE = /[\p{M}­​-‏⁠﻿]/gu; // accents (after NFKD), soft hyphens, zero-width characters

/** Lowercase, fold full-width forms and accents, drop invisible characters, fold look-alikes (digits kept). */
function fold(text: string): string {
  return [...text.normalize("NFKC").toLowerCase().normalize("NFKD").replace(INVISIBLE, "")].map((ch) => LOOKALIKE[ch] ?? ch).join("");
}

const words = (s: string) => s.split(/[^a-z0-9]+/).filter(Boolean);
const squeeze = (w: string) => w.replace(/(.)\1+/g, "$1");
const plurals = (w: string) => [w, ...(w.length > 3 ? ["es", "s", "z"].filter((e) => w.endsWith(e)).map((e) => w.slice(0, -e.length)) : [])];

/** Joins runs of single characters into one word: "s e x" and "n.i.g.g.e.r" each become one word. */
function joinSpaced(seq: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < seq.length; ) {
    let j = i;
    while (j < seq.length && seq[j].length === 1) j++;
    if (j - i >= 2) {
      out.push(seq.slice(i, j).join(""));
      i = j;
    } else out.push(seq[i++]);
  }
  return out;
}

/**
 * Every way of reading the text: as written, with digits read as letters (1 as "i" and as "l"), with spaced-out
 * letters joined, and with plurals cut. `stretched` holds squeezed forms of words that repeat a letter 3+ times
 * ("niiigger" → "niger"); only those are compared squeezed, so ordinary words never collide with a list word.
 */
function forms(text: string) {
  const base = fold(text);
  const asLetters = (one: string) => base.replace(/[0-9]/g, (d) => (d === "1" ? one : (DIGITS[d] ?? d)));
  const sequences = [base, asLetters("i"), asLetters("l")].flatMap((v) => {
    const seq = words(v);
    return [seq, joinSpaced(seq)];
  });
  const tokens = new Set<string>();
  const stretched = new Set<string>();
  for (const t of sequences.flat()) {
    for (const w of plurals(t)) tokens.add(w);
    if (/(.)\1\1/.test(t)) for (const w of plurals(squeeze(t))) stretched.add(w);
  }
  return { sequences, tokens, stretched, compact: sequences.map((seq) => seq.join("")) };
}

/**
 * The first banned word or phrase found in any of the texts, or null.
 * MODERATION.bannedWords match whole words and phrases; MODERATION.bannedAnywhere also match inside longer words.
 */
export function findBannedTerm(...texts: (string | null | undefined)[]): string | null {
  const text = texts.filter(Boolean).join(" \n ");
  if (!text.trim()) return null;
  const { sequences, tokens, stretched, compact } = forms(text);
  for (const raw of MODERATION.bannedWords) {
    const term = words(fold(raw)).join(" ");
    if (!term) continue;
    if (term.includes(" ")) {
      if (sequences.some((seq) => ` ${seq.join(" ")} `.includes(` ${term} `))) return raw;
    } else if (tokens.has(term) || stretched.has(squeeze(term))) return raw;
  }
  const inside = [...compact, ...tokens];
  for (const raw of MODERATION.bannedAnywhere) {
    const stem = words(fold(raw)).join("");
    if (stem && (inside.some((t) => t.includes(stem)) || [...stretched].some((t) => t.includes(squeeze(stem))))) return raw;
  }
  return null;
}

/** True when a mint is on the manual hide list. */
export const isHiddenMint = (mint: string) => MODERATION.hiddenMints.includes(mint);

/**
 * Whether a sampled pump.fun coin may appear in the "Live on pump.fun" strip: its latest reading must show no
 * warning sign (creator hasn't sold; sniper share known and at most MODERATION.maxSniperPct), its name and symbol
 * must pass the banned-word lists, and its mint must not be on the hide list. No reading yet means it's left out.
 */
export function showInLiveStrip(c: { mint: string; name: string; symbol: string; latest: { devSold: boolean | null; sniperPct: number | null } | null | undefined }): boolean {
  const s = c.latest;
  if (!s || s.devSold !== false || s.sniperPct === null || s.sniperPct > MODERATION.maxSniperPct) return false;
  return !isHiddenMint(c.mint) && !findBannedTerm(c.name, c.symbol);
}
