import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Reads the colour tokens straight from globals.css so the CSS stays the single source of truth.
const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

function tokens(body: string): Record<string, string> {
  return Object.fromEntries([...body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map(([, k, v]) => [k, v.toLowerCase()]));
}
function block(re: RegExp): Record<string, string> {
  const m = css.match(re);
  if (!m) throw new Error(`token block not found: ${re}`);
  return tokens(m[1]);
}

// First top-level :root block: light theme.
const light = block(/^:root \{([^}]*)\}/m);
const darkSystem = block(/@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\) \{([^}]*)\}/);
const darkChosen = block(/^:root\[data-theme="dark"\] \{([^}]*)\}/m);

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
/** Spread between the most and least saturated channel: 0 means a neutral grey. */
function chroma(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return Math.max(...c) - Math.min(...c);
}

const SURFACES = ["paper", "card", "tint"];
const TEXT = 4.5; // WCAG AA, normal text
const GRAPHIC = 3; // WCAG AA, non-text UI and chart marks

// [foreground, background, minimum]
const PAIRS: [string, string, number][] = [
  ...SURFACES.flatMap((bg): [string, string, number][] => [
    ["ink", bg, TEXT],
    ["muted", bg, TEXT],
    ["primary-ink", bg, TEXT],
    ["up", bg, TEXT],
    ["down", bg, TEXT],
    ["rule-strong", bg, GRAPHIC],
    ["focus", bg, GRAPHIC],
    ["data-you", bg, GRAPHIC],
    ["data-median", bg, GRAPHIC],
  ]),
  ["ink", "tint-strong", TEXT], // hovered pills and ghost buttons
  ["muted", "tint-strong", TEXT],
  ["on-primary", "primary", TEXT], // primary buttons
  ["on-primary", "primary-hover", TEXT],
  ["primary", "paper", GRAPHIC], // the button shape itself
  ["on-accent", "accent", TEXT], // coral tags and chips
  ["on-panel", "panel", TEXT], // ink panels
  ["panel-muted", "panel", TEXT],
  ["panel-accent", "panel", TEXT],
  ["panel", "on-panel", TEXT], // paper button on ink panels
  ["panel", "panel-accent", TEXT], // its hover
  ["data-you", "data-range", GRAPHIC],
  ["data-you", "data-range-strong", GRAPHIC],
  ["data-median", "data-range", GRAPHIC],
  ["data-median", "data-range-strong", GRAPHIC],
];

// Surfaces, lines and secondary text must carry colour: no neutral greys.
const NO_GREY = ["paper", "tint", "tint-strong", "muted", "rule", "rule-strong", "panel", "panel-muted", "data-median", "data-range"];

describe("design tokens", () => {
  it("dark theme blocks for system preference and explicit choice are identical", () => {
    expect(darkSystem).toEqual(darkChosen);
  });

  it("dark theme overrides every colour token", () => {
    expect(Object.keys(darkChosen).sort()).toEqual(Object.keys(light).sort());
  });

  for (const [name, theme] of [
    ["light", light],
    ["dark", darkChosen],
  ] as const) {
    it.each(PAIRS)(`${name}: %s on %s meets %d:1`, (fg, bg, min) => {
      expect(theme[fg], `missing --${fg}`).toBeDefined();
      expect(theme[bg], `missing --${bg}`).toBeDefined();
      expect(contrast(theme[fg], theme[bg])).toBeGreaterThanOrEqual(min);
    });

    it.each(NO_GREY)(`${name}: --%s is tinted, not a neutral grey`, (t) => {
      expect(theme[t], `missing --${t}`).toBeDefined();
      expect(chroma(theme[t])).toBeGreaterThanOrEqual(6);
    });
  }

  it("body has an explicit background", () => {
    expect(css).toMatch(/body \{[^}]*background: var\(--paper\)/);
  });
});
