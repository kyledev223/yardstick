import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Reads the colour tokens straight from globals.css so the CSS stays the single source of truth.
const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

function block(re: RegExp): Record<string, string> {
  const m = css.match(re);
  if (!m) throw new Error(`token block not found: ${re}`);
  return Object.fromEntries([...m[1].matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map(([, k, v]) => [k, v.toLowerCase()]));
}

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

const SURFACES = ["page", "surface", "soft", "sunk"];
const TEXT = 4.5; // WCAG AA, normal text
const LARGE = 3; // WCAG AA, large text (>= 24px, or >= 18.66px bold)
const GRAPHIC = 3; // WCAG AA, non-text UI and chart marks

// [foreground, background, minimum]
const PAIRS: [string, string, number][] = [
  ...SURFACES.flatMap((bg): [string, string, number][] => [
    ["ink", bg, TEXT],
    ["muted", bg, TEXT],
    ["faint", bg, TEXT],
    ["teal-ink", bg, TEXT],
    ["up", bg, TEXT],
    ["down", bg, TEXT],
    ["rule-strong", bg, GRAPHIC],
    ["focus", bg, GRAPHIC],
    ["data-you", bg, GRAPHIC],
    ["data-median", bg, GRAPHIC],
  ]),
  ["data-you", "data-range", GRAPHIC],
  ["data-you", "data-range-strong", GRAPHIC],
  ["data-median", "data-range-strong", GRAPHIC],
  ["on-btn", "btn", TEXT],
  ["on-pill", "teal", TEXT],
  ["on-pill", "yellow", TEXT],
  ["on-pill", "coral", TEXT],
  ["on-pill", "stone", TEXT],
  ["on-teal", "teal", LARGE], // white on teal pills: display sizes only
  ["page", "ink", TEXT], // ink pill
  ["ink", "field-plus", LARGE], // + glyphs are kept out from under small text, so large text is the worst case
  // Text drawn over the cursor-field glyphs must keep AA.
  ...["field-dot", "field-square"].flatMap((g): [string, string, number][] => [
    ["ink", g, TEXT],
    ["muted", g, TEXT],
    ["faint", g, TEXT],
    ["teal-ink", g, TEXT],
  ]),
];

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

    it(`${name}: field dots and squares stay close to the page colour`, () => {
      for (const g of ["field-dot", "field-square"]) expect(contrast(theme[g], theme.page)).toBeLessThan(1.35);
    });
  }
});
