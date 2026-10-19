import { describe, expect, it } from "vitest";
import { Field, FIELD, hash, LEVELS, levelAt, noise, type Region } from "@/lib/cursor-field";

// Deterministic random source so the simulation is repeatable.
function seeded(s = 42) {
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Moves the pointer in a straight line at 60fps and returns the field afterwards. */
function sweep(field: Field, from: [number, number], to: [number, number], ms: number, start = 0) {
  let now = start;
  for (let t = 0; t <= ms; t += 16) {
    const k = t / ms;
    field.setPointer({ x: from[0] + (to[0] - from[0]) * k, y: from[1] + (to[1] - from[1]) * k });
    field.tick((now = start + t), 16);
  }
  return now;
}

describe("noise and hash", () => {
  it("stay in [0, 1) and are deterministic", () => {
    for (let i = 0; i < 200; i++) {
      const h = hash(i, i * 3, 7);
      const n = noise(i * 0.37, i * 0.11, 3);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
      expect(hash(i, i * 3, 7)).toBe(h);
    }
  });
});

describe("levelAt", () => {
  const regions: Region[] = [
    { x: 0, y: 0, w: 1000, h: 1000, level: "quiet" },
    { x: 100, y: 100, w: 200, h: 200, level: "off" },
  ];
  it("uses the smallest containing region, else the fallback", () => {
    expect(levelAt(regions, 150, 150, "calm")).toBe("off");
    expect(levelAt(regions, 500, 500, "calm")).toBe("quiet");
    expect(levelAt(regions, 1500, 10, "calm")).toBe("calm");
  });
});

describe("Field", () => {
  it("leaves a trail behind a moving pointer, then clears", () => {
    const f = new Field(seeded(), 0);
    f.ambient = false;
    f.fallback = "full";
    const end = sweep(f, [100, 300], [1300, 300], 1500);
    expect(f.cells.size).toBeGreaterThan(20);
    // Cells sit around the path, not scattered over the page.
    for (const c of f.cells.values()) expect(Math.abs((c.j + 0.5) * f.cell - 300)).toBeLessThan(FIELD.stampRadius[1] * f.cell + FIELD.stampJitter * f.cell + f.cell);
    // Pointer stops: nothing new appears and everything has faded within a few seconds.
    let now = end;
    for (let t = 0; t < 4000; t += 16) f.tick((now += 16), 16);
    expect(f.cells.size).toBe(0);
    expect(f.busy(now)).toBe(false);
  });

  it("grows cell by cell: appear times spread out after a bloom", () => {
    const f = new Field(seeded(), 0);
    f.fallback = "full";
    f.bloom(500, 500, 5, 0);
    const appear = [...f.cells.values()].map((c) => c.appear);
    expect(Math.max(...appear) - Math.min(...appear)).toBeGreaterThan(150);
  });

  it("a pointer that does not move creates nothing", () => {
    const f = new Field(seeded(), 0);
    f.ambient = false;
    f.fallback = "full";
    for (let t = 0; t < 2000; t += 16) {
      f.setPointer({ x: 400, y: 400 });
      f.tick(t, 16);
    }
    expect(f.cells.size).toBe(0);
  });

  it("is sparser and paler in quiet areas and absent where off", () => {
    const count = (level: "full" | "quiet" | "off") => {
      const f = new Field(seeded(9), 0);
      f.fallback = level;
      for (let k = 0; k < 40; k++) f.bloom(200 + k * 300, 400, 5, 0);
      return [...f.cells.values()];
    };
    const full = count("full");
    const quiet = count("quiet");
    expect(quiet.length).toBeLessThan(full.length * 0.5);
    expect(quiet.every((c) => c.alpha === LEVELS.quiet.alpha)).toBe(true);
    expect(quiet.some((c) => c.glyph === "plus")).toBe(false);
    expect(count("off")).toHaveLength(0);
  });

  it("never puts a + glyph over small text", () => {
    const f = new Field(seeded(3), 0);
    f.fallback = "full";
    f.protect = [{ x: 0, y: 0, w: 2000, h: 1000 }];
    for (let k = 0; k < 60; k++) f.bloom(100 + k * 30, 500, 6, 0);
    const glyphs = [...f.cells.values()].map((c) => c.glyph);
    expect(glyphs.length).toBeGreaterThan(50);
    expect(glyphs).not.toContain("plus");
    // Outside the protected box, + does appear.
    f.protect = [];
    for (let k = 0; k < 60; k++) f.bloom(100 + k * 30, 3000, 6, 0);
    expect([...f.cells.values()].some((c) => c.glyph === "plus")).toBe(true);
  });

  it("caps the number of live cells", () => {
    const f = new Field(seeded(), 0);
    f.fallback = "full";
    for (let k = 0; k < 400; k++) f.bloom((k % 40) * 200, Math.floor(k / 40) * 200, 6, 0);
    expect(f.cells.size).toBeLessThanOrEqual(FIELD.maxCells);
  });

  it("ambient blooms happen with no pointer (touch) inside the viewport", () => {
    const f = new Field(seeded(), 0);
    f.fallback = "full";
    f.view = { x: 0, y: 2000, w: 390, h: 844 };
    let seen = 0;
    for (let t = 0; t < 6000; t += 16) {
      f.tick(t, 16);
      seen = Math.max(seen, f.cells.size);
      for (const c of f.cells.values()) expect((c.j + 0.5) * f.cell).toBeGreaterThan(2000 - 6 * f.cell);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("reduced motion: the still frame is deterministic and respects levels", () => {
    const f = new Field(seeded(), 0);
    f.fallback = "full";
    const area = { x: 0, y: 0, w: 1440, h: 900 };
    const a = f.staticCells(area);
    const b = f.staticCells(area);
    expect(a.length).toBeGreaterThan(20);
    expect(b).toEqual(a);
    f.regions = [{ x: -100, y: -100, w: 2000, h: 2000, level: "off" }]; // edge cells straddle the area, so cover a bit more
    expect(f.staticCells(area)).toHaveLength(0);
  });
});
