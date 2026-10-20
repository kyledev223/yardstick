"use client";
// Helpers for the decorative visuals: seeded randomness, theme colours for canvas, play-once phases, label sizing.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/** Small seeded random number generator (mulberry32), so the artwork looks the same on every load. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** "#rrggbb" plus an alpha, as rgba() for canvas. */
export function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Calls `cb` when the theme changes (explicit toggle or system preference). Returns a cleanup. */
export function watchTheme(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => {
    mo.disconnect();
    mq.removeEventListener("change", cb);
  };
}

/** Reads a colour token off an element (falls back if it's empty). */
export const token = (el: Element, name: string, fallback: string) => getComputedStyle(el).getPropertyValue(name).trim() || fallback;

/**
 * Plays a diagram once: returns a ref for the element and the current phase (0 until it's scrolled into view,
 * then 1, 2… at the given delays in ms). Under reduced motion it jumps straight to the last phase.
 */
export function usePhases<T extends Element>(delays: number[]) {
  const ref = useRef<T>(null);
  const [phase, setPhase] = useState(0);
  const key = delays.join(",");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        if (reducedMotion()) {
          setPhase(delays.length);
          return;
        }
        delays.forEach((d, i) => timers.push(window.setTimeout(() => setPhase(i + 1), d)));
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for `delays`
  }, [key]);
  return [ref, phase] as const;
}

/**
 * Font size, in SVG user units, that renders at least `px` CSS pixels in an SVG whose viewBox is `vbWidth` wide.
 * Keeps diagram labels readable when the drawing shrinks on a phone.
 */
export function useSvgText(vbWidth: number, rendered: boolean, px = 10.5) {
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState(10);
  // `rendered`: the SVG exists (it's drawn after hydration), so the observer attaches once it does.
  useEffect(() => {
    const el = ref.current;
    if (!el || !rendered) return;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      if (w) setSize(Math.max(10, (px * vbWidth) / w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [vbWidth, px, rendered]);
  return [ref, size] as const;
}

const noop = () => () => {};
/**
 * False on the server and during hydration, true after. Decorative SVGs below the fold render only once this is
 * true (their box is reserved before), so their markup stays out of the HTML and the RSC payload.
 */
export const useMounted = () => useSyncExternalStore(noop, () => true, () => false);
