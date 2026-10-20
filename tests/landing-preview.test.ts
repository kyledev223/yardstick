import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { landingPreviewEnabled } from "../src/lib/preview";

describe("dev-only landing preview", () => {
  it("is never enabled in production, whatever the URL says", () => {
    for (const param of ["baseline", ["baseline"], "1", "true", "", undefined]) {
      expect(landingPreviewEnabled("production", param)).toBe(false);
    }
  });

  it("is off outside a development server (tests, unknown or missing NODE_ENV)", () => {
    for (const env of ["test", "staging", "", undefined]) {
      expect(landingPreviewEnabled(env, "baseline")).toBe(false);
    }
  });

  it("needs the exact switch on a development server", () => {
    expect(landingPreviewEnabled("development", "baseline")).toBe(true);
    expect(landingPreviewEnabled("development", undefined)).toBe(false);
    expect(landingPreviewEnabled("development", "1")).toBe(false);
    expect(landingPreviewEnabled("development", ["baseline", "baseline"])).toBe(false);
  });

  it("the landing page only reads baseline coins behind the switch, keyed on NODE_ENV", () => {
    const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
    expect(page).toMatch(/const preview = landingPreviewEnabled\(process\.env\.NODE_ENV, /);
    // Coin source is chosen in one place, from the switch…
    expect(page).toMatch(/const source = preview \? "baseline" : "yardstick";/);
    // …and every other "baseline" in the page is the comparison group, never a coin source.
    for (const m of page.matchAll(/"baseline"/g)) {
      const before = page.slice(Math.max(0, m.index - 20), m.index);
      expect(/group: $|preview \? $/.test(before), `unexpected "baseline" after: ${before}`).toBe(true);
    }
    expect(page).not.toMatch(/source: "baseline"/);
  });
});
