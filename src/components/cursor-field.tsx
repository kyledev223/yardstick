"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Field, FIELD, LEVELS, type Cell, type FieldLevel, type Rect } from "@/lib/cursor-field";

const MAX_DPR = 1.5;
const FPS = 30;
// Elements whose text is (usually) small: no + glyph is placed behind them.
const SMALL_TEXT = "p, li, dt, dd, td, th, label, small, figcaption, blockquote, a, button, input, select, textarea, svg text, [data-field-protect]";

/**
 * Background glyph field that blooms along the pointer's path. Mount once, as the first child of <body>,
 * with the page content in a positioned layer above it. Strength per area: data-field="full|calm|quiet|off".
 * Touch screens get ambient blooms only; prefers-reduced-motion gets one still frame.
 */
export function CursorField({ fallback = FIELD.defaultLevel }: { fallback?: FieldLevel }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const refreshRef = useRef<() => void>(() => {});
  const pathname = usePathname();

  // Regions move after client-side navigation.
  useEffect(() => refreshRef.current(), [pathname]);

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!box || !canvas || !ctx) return;

    const field = new Field(Math.random, performance.now());
    field.fallback = fallback;
    const reduceMq = matchMedia("(prefers-reduced-motion: reduce)");
    const darkMq = matchMedia("(prefers-color-scheme: dark)");
    let reduce = reduceMq.matches;
    let still: Cell[] = [];
    let colors = { dot: "", square: "", plus: "" };
    let dpr = 1;
    let width = 0;
    let bandTop = 0; // the canvas covers [bandTop, bandTop + bandH] of the page and scrolls with it
    let bandH = 0;
    let raf = 0;
    let sleep = 0; // idle: waiting for the next ambient bloom
    let capTimer = 0; // busy: waiting for the next frame slot
    let refreshTimer = 0;
    let lastTick = performance.now();
    let dirty = true;
    let pointer: { x: number; y: number } | null = null;

    const pad = () => Math.max(300, innerHeight * 0.5);

    const readTheme = () => {
      const s = getComputedStyle(document.documentElement);
      colors = { dot: s.getPropertyValue("--field-dot").trim(), square: s.getPropertyValue("--field-square").trim(), plus: s.getPropertyValue("--field-plus").trim() };
      field.cell = parseFloat(s.getPropertyValue("--field-cell")) || FIELD.cell;
      field.glyph = parseFloat(s.getPropertyValue("--field-glyph")) || FIELD.glyph;
      dirty = true;
      kick();
    };

    const recomputeStill = () => {
      if (reduce) still = field.staticCells({ x: 0, y: bandTop, w: width, h: bandH });
    };

    // Move the canvas only when the viewport nears its edge; between moves it scrolls natively, so glyphs never swim.
    const placeBand = (force = false) => {
      const docH = box.clientHeight;
      const y = scrollY;
      const slack = pad() * 0.5;
      const nearTop = bandTop > 0 && y - bandTop < slack;
      const nearBottom = bandTop + bandH < docH && bandTop + bandH - (y + innerHeight) < slack;
      if (!force && !nearTop && !nearBottom) return;
      bandTop = Math.max(0, Math.min(y - pad(), docH - bandH));
      canvas.style.transform = `translateY(${bandTop}px)`;
      recomputeStill();
      dirty = true;
    };

    const size = () => {
      width = box.clientWidth;
      bandH = Math.ceil(innerHeight + 2 * pad());
      dpr = Math.min(devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(bandH * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${bandH}px`;
      placeBand(true);
    };

    const draw = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, bandH);
      const c = field.cell;
      const g = field.glyph;
      const h = g / 2;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      // Paths beat drawImage sprites here (measured): Chrome's accelerated canvas pays more per sprite stamp.
      for (const cell of reduce ? still : field.cells.values()) {
        const a = reduce ? cell.alpha : field.alphaOf(cell, now);
        if (a <= 0.01) continue;
        const x = (cell.i + 0.5) * c;
        const y = (cell.j + 0.5) * c - bandTop;
        if (y < -c || y > bandH + c) continue;
        ctx.globalAlpha = a;
        if (cell.glyph === "dot") {
          ctx.fillStyle = colors.dot;
          ctx.beginPath();
          ctx.arc(x, y, h, 0, Math.PI * 2);
          ctx.fill();
        } else if (cell.glyph === "square") {
          ctx.fillStyle = colors.square;
          ctx.fillRect(x - h, y - h, g, g);
        } else {
          ctx.strokeStyle = colors.plus;
          ctx.beginPath();
          ctx.moveTo(x - h + 1.5, y);
          ctx.lineTo(x + h - 1.5, y);
          ctx.moveTo(x, y - h + 1.5);
          ctx.lineTo(x, y + h - 1.5);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    };

    const frame = (now: number) => {
      raf = 0;
      if (document.hidden) return;
      if (!reduce) {
        field.view = { x: scrollX, y: scrollY, w: innerWidth, h: innerHeight };
        field.tick(now, Math.min(now - lastTick, 100));
        lastTick = now;
      }
      draw(now);
      dirty = false;
      if (reduce) return;
      if (field.busy(now)) {
        // Cap at FPS: wait out the rest of this frame slot instead of waking on every display refresh.
        capTimer = window.setTimeout(
          () => {
            capTimer = 0;
            kick();
          },
          Math.max(0, 1000 / FPS - (performance.now() - now) - 2),
        );
      } else {
        // Nothing lit and the pointer is still: sleep until the next ambient bloom.
        clearTimeout(sleep);
        sleep = window.setTimeout(kick, Math.max(16, field.nextAmbient - performance.now()));
      }
    };

    // Schedule a frame. Pointer moves wait for the next frame slot; a moved or resized canvas (dirty) draws at once.
    function kick() {
      if (raf || document.hidden || (capTimer && !dirty)) return;
      clearTimeout(capTimer);
      capTimer = 0;
      clearTimeout(sleep);
      lastTick = Math.max(lastTick, performance.now() - 100);
      raf = requestAnimationFrame(frame);
    }

    // Read field regions and small-text boxes from the DOM (debounced; layout reads only, no writes).
    const refresh = () => {
      refreshTimer = 0;
      const sx = scrollX;
      const sy = scrollY;
      const rect = (el: Element): Rect => {
        const r = el.getBoundingClientRect();
        return { x: r.left + sx, y: r.top + sy, w: r.width, h: r.height };
      };
      field.regions = [...document.querySelectorAll<HTMLElement>("[data-field]")].map((el) => {
        const lv = el.dataset.field as FieldLevel;
        return { ...rect(el), level: lv in LEVELS ? lv : fallback };
      });
      field.protect = [...document.querySelectorAll(SMALL_TEXT)]
        .slice(0, 3000)
        .filter((el) => el.matches("input, select, textarea") || (el.textContent ?? "").trim() !== "")
        .map(rect)
        .filter((r) => r.w > 0 && r.h > 0);
      if (box.clientWidth !== width) size();
      else placeBand(true);
      kick();
    };
    const scheduleRefresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(refresh, 250);
    };
    refreshRef.current = scheduleRefresh;

    const onPointerMove = (e: PointerEvent) => {
      if (reduce || (e.pointerType !== "mouse" && e.pointerType !== "pen")) return; // touch: ambient only; reduced motion: still frame
      pointer = { x: e.clientX, y: e.clientY };
      field.setPointer({ x: e.clientX + scrollX, y: e.clientY + scrollY });
      kick();
    };
    const onPointerOut = (e: PointerEvent) => {
      if (e.relatedTarget) return;
      pointer = null;
      field.setPointer(null);
    };
    const onScroll = () => {
      if (pointer) field.setPointer({ x: pointer.x + scrollX, y: pointer.y + scrollY });
      placeBand();
      if (dirty || pointer) kick();
    };
    const onResize = () => {
      size();
      scheduleRefresh();
      kick();
    };
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
        clearTimeout(sleep);
        clearTimeout(capTimer);
        capTimer = 0;
      } else {
        lastTick = performance.now();
        dirty = true;
        kick();
      }
    };
    const onReduce = () => {
      reduce = reduceMq.matches;
      field.cells.clear();
      recomputeStill();
      dirty = true;
      kick();
    };

    readTheme();
    size();
    refresh();
    document.fonts?.ready.then(scheduleRefresh);

    const themeObserver = new MutationObserver(readTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const domObserver = new MutationObserver(scheduleRefresh);
    domObserver.observe(document.body, { childList: true, subtree: true });
    const sizeObserver = new ResizeObserver(scheduleRefresh);
    sizeObserver.observe(document.body);

    addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerout", onPointerOut);
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    reduceMq.addEventListener("change", onReduce);
    darkMq.addEventListener("change", readTheme);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(sleep);
      clearTimeout(capTimer);
      clearTimeout(refreshTimer);
      refreshRef.current = () => {};
      themeObserver.disconnect();
      domObserver.disconnect();
      sizeObserver.disconnect();
      removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerout", onPointerOut);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      reduceMq.removeEventListener("change", onReduce);
      darkMq.removeEventListener("change", readTheme);
    };
  }, [fallback]);

  return (
    <div ref={boxRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <canvas ref={canvasRef} className="absolute left-0 top-0" />
    </div>
  );
}
