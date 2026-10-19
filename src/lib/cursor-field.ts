/**
 * Cursor field engine: a grid of small glyphs (dot, square, +) that bloom in irregular,
 * noise-shaped clusters along the pointer's recent path, then wink out cell by cell.
 * Pure logic, no DOM: the <CursorField /> component feeds it pointer/viewport data and draws the cells.
 * All positions are page coordinates (CSS px from the document's top-left).
 */

export type FieldLevel = "full" | "calm" | "quiet" | "off";
export type Glyph = "dot" | "square" | "plus";
export type Rect = { x: number; y: number; w: number; h: number };
export type Region = Rect & { level: FieldLevel };

/** How each level shapes the field: share of cells that light, glyph opacity, share of + glyphs. */
export const LEVELS: Record<FieldLevel, { density: number; alpha: number; plus: number }> = {
  full: { density: 1, alpha: 1, plus: 0.12 }, // landing hero, closing section
  calm: { density: 0.6, alpha: 0.85, plus: 0.05 }, // everywhere else (default)
  quiet: { density: 0.28, alpha: 0.55, plus: 0 }, // dashboards, tables, charts
  off: { density: 0, alpha: 0, plus: 0 },
};

/** Tuning knobs. Times in ms, distances in CSS px unless noted. */
export const FIELD = {
  cell: 32, // grid pitch; overridden by --field-cell
  glyph: 14, // glyph size; overridden by --field-glyph
  defaultLevel: "calm" as FieldLevel,
  follow: 180, // how far the trail eases behind the pointer (time constant)
  stampEvery: [70, 130] as const, // brush travel between clusters
  stampRadius: [3, 6] as const, // cluster radius, in cells
  stampJitter: 1.2, // random offset of a cluster from the brush, in cells
  noiseScale: 0.34, // smaller = smoother, blobbier clusters
  noiseCut: 0.3, // higher = sparser clusters
  grow: 55, // delay per cell of distance from the cluster centre (cell-by-cell growth)
  growJitter: 180,
  hold: [700, 1500] as const, // how long a lit cell stays
  fadeIn: 90,
  fadeOut: 200,
  ambientEvery: [1300, 2600] as const, // blooms with no pointer (and on touch)
  ambientRadius: [2.5, 5] as const,
  squareShare: 0.42, // of the non-+ glyphs
  maxCells: 900,
  staticCut: 0.65, // reduced motion: noise threshold for the still frame
};

export type Cell = { i: number; j: number; glyph: Glyph; appear: number; die: number; alpha: number };

/** Fast integer hash → [0, 1). */
export function hash(i: number, j: number, seed = 0): number {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth 2D value noise → [0, 1). */
export function noise(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

const between = (r: readonly [number, number], t: number) => r[0] + (r[1] - r[0]) * t;
const inside = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/** Smallest region containing the point wins; outside every region, the fallback applies. */
export function levelAt(regions: Region[], x: number, y: number, fallback: FieldLevel): FieldLevel {
  let best: Region | null = null;
  for (const r of regions) if (inside(r, x, y) && (!best || r.w * r.h < best.w * best.h)) best = r;
  return best ? best.level : fallback;
}

export class Field {
  cells = new Map<number, Cell>();
  regions: Region[] = [];
  /** Boxes of small text: no + glyph is placed over them (+ is only AA under large text). */
  protect: Rect[] = [];
  fallback: FieldLevel = FIELD.defaultLevel;
  cell = FIELD.cell;
  glyph = FIELD.glyph;
  ambient = true;
  view: Rect = { x: 0, y: 0, w: 0, h: 0 };

  private seed = 1;
  private target: { x: number; y: number } | null = null;
  private brush: { x: number; y: number } | null = null;
  private travel = 0;
  private nextStamp: number;
  nextAmbient: number;

  constructor(
    private rand: () => number = Math.random,
    now = 0,
  ) {
    this.nextStamp = between(FIELD.stampEvery, rand());
    this.nextAmbient = now + between(FIELD.ambientEvery, rand()) * 0.5;
  }

  /** Pointer position in page coordinates, or null when it leaves the page. */
  setPointer(p: { x: number; y: number } | null) {
    this.target = p;
    if (!p) this.brush = null;
  }

  /** True while something is changing; when false the caller can sleep until `nextAmbient`. */
  busy(now: number): boolean {
    if (this.cells.size > 0) return true;
    if (this.target && this.brush && Math.hypot(this.target.x - this.brush.x, this.target.y - this.brush.y) > 0.5) return true;
    return this.ambient && now >= this.nextAmbient;
  }

  /** Advance the simulation: ease the brush, drop clusters along its path, ambient blooms, expire cells. */
  tick(now: number, dt: number) {
    if (this.target) {
      if (!this.brush) this.brush = { ...this.target };
      else {
        const k = 1 - Math.exp(-dt / FIELD.follow);
        const nx = this.brush.x + (this.target.x - this.brush.x) * k;
        const ny = this.brush.y + (this.target.y - this.brush.y) * k;
        this.travel += Math.hypot(nx - this.brush.x, ny - this.brush.y);
        this.brush = { x: nx, y: ny };
        if (this.travel >= this.nextStamp) {
          this.travel = 0;
          this.nextStamp = between(FIELD.stampEvery, this.rand());
          const j = FIELD.stampJitter * this.cell;
          this.bloom(nx + (this.rand() - 0.5) * 2 * j, ny + (this.rand() - 0.5) * 2 * j, between(FIELD.stampRadius, this.rand()), now);
        }
      }
    }
    if (this.ambient && now >= this.nextAmbient && this.view.w > 0) {
      this.nextAmbient = now + between(FIELD.ambientEvery, this.rand());
      this.bloom(this.view.x + this.rand() * this.view.w, this.view.y + this.rand() * this.view.h, between(FIELD.ambientRadius, this.rand()), now);
    }
    for (const [k, c] of this.cells) if (now > c.die + FIELD.fadeOut) this.cells.delete(k);
  }

  /** Light an irregular cluster of cells around (x, y). */
  bloom(x: number, y: number, radius: number, now: number) {
    const seed = this.seed++;
    const ci = x / this.cell;
    const cj = y / this.cell;
    for (let j = Math.floor(cj - radius); j <= Math.ceil(cj + radius); j++) {
      for (let i = Math.floor(ci - radius); i <= Math.ceil(ci + radius); i++) {
        if (i < 0 || j < 0) continue;
        const d = Math.hypot(i + 0.5 - ci, j + 0.5 - cj) / radius;
        if (d > 1) continue;
        // Noise shapes the cluster; the threshold rises toward the edge so it frays out.
        if (noise(i * FIELD.noiseScale, j * FIELD.noiseScale, seed) < FIELD.noiseCut + d * 0.35) continue;
        const px = (i + 0.5) * this.cell;
        const py = (j + 0.5) * this.cell;
        const lv = LEVELS[levelAt(this.regions, px, py, this.fallback)];
        if (this.rand() >= lv.density) continue;
        const appear = now + d * radius * FIELD.grow + this.rand() * FIELD.growJitter;
        const die = appear + between(FIELD.hold, this.rand());
        const key = j * 4096 + i;
        const old = this.cells.get(key);
        if (old) {
          old.die = Math.max(old.die, die);
          continue;
        }
        if (this.cells.size >= FIELD.maxCells) return;
        this.cells.set(key, { i, j, glyph: this.pickGlyph(i, j, seed, lv.plus), appear, die, alpha: lv.alpha });
      }
    }
  }

  /** Opacity of a cell at `now`: quick fade in, hold, quick fade out. */
  alphaOf(c: Cell, now: number): number {
    if (now < c.appear) return 0;
    const fin = Math.min(1, (now - c.appear) / FIELD.fadeIn);
    const fout = now > c.die ? Math.max(0, 1 - (now - c.die) / FIELD.fadeOut) : 1;
    return fin * fout * c.alpha;
  }

  /** Reduced motion: one deterministic still frame for the cells inside `area`. */
  staticCells(area: Rect): Cell[] {
    const out: Cell[] = [];
    const s = FIELD.noiseScale * 0.6;
    for (let j = Math.max(0, Math.floor(area.y / this.cell)); j <= Math.ceil((area.y + area.h) / this.cell); j++) {
      for (let i = Math.max(0, Math.floor(area.x / this.cell)); i <= Math.ceil((area.x + area.w) / this.cell); i++) {
        if (noise(i * s, j * s, 7) < FIELD.staticCut) continue;
        const lv = LEVELS[levelAt(this.regions, (i + 0.5) * this.cell, (j + 0.5) * this.cell, this.fallback)];
        if (hash(i, j, 11) >= lv.density) continue;
        out.push({ i, j, glyph: this.pickGlyph(i, j, 13, lv.plus), appear: 0, die: Infinity, alpha: lv.alpha });
      }
    }
    return out;
  }

  private pickGlyph(i: number, j: number, seed: number, plusShare: number): Glyph {
    const r = hash(i, j, seed * 31 + 3);
    if (r < plusShare && !this.coversText(i, j)) return "plus";
    return hash(i, j, seed * 31 + 5) < FIELD.squareShare ? "square" : "dot";
  }

  private coversText(i: number, j: number): boolean {
    const g = this.glyph / 2;
    const cx = (i + 0.5) * this.cell;
    const cy = (j + 0.5) * this.cell;
    for (const r of this.protect) if (cx + g > r.x && cx - g < r.x + r.w && cy + g > r.y && cy - g < r.y + r.h) return true;
    return false;
  }
}
