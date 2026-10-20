"use client";
import { useEffect, useRef } from "react";
import { hexA, reducedMotion, rng, token, watchTheme } from "./util";

const STEP = 5; // px between bars
const BAR = 2; // bar width
const YOU = 0.68; // where the coral bar sits, as a share of the width

/** Skewed hump peaking at 0.38: the outline of the bars. Art, not data: there are no axes or numbers. */
function envelope(u: number) {
  const p = 0.38;
  const k = 2.2;
  const x = u / p;
  return 0.04 + 0.96 * Math.pow(x, k) * Math.exp(k * (1 - x));
}

/**
 * The hero's "scale": hundreds of thin ultramarine bars shaped like a distribution, breathing slowly, with one coral
 * bar marking a place on it. Art, not data. One still frame straight away; the breathing (canvas, ~15 fps) starts only
 * once the page has loaded and gone idle, so it never competes with the first paint, and pauses off screen and in
 * background tabs. Reduced motion: the still frame only. Colours follow the theme.
 */
export function HeroScale({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const still = reducedMotion();
    let w = 0;
    let h = 0;
    let jitter: number[] = [];
    let you = 0;
    let bar = "#2442ff";
    let coral = "#ff6a3d";
    let fill: CanvasGradient | string = bar;
    let raf = 0;
    let last = 0;
    let visible = false;
    let ready = false; // set once the page has loaded and gone idle
    const t0 = performance.now();

    const colours = () => {
      bar = token(cv, "--primary-ink", bar);
      coral = token(cv, "--accent", coral);
      fill = ctx.createLinearGradient(0, h, 0, 0);
      fill.addColorStop(0, hexA(bar, 0.9));
      fill.addColorStop(0.55, hexA(bar, 0.45));
      fill.addColorStop(1, hexA(bar, 0.08));
    };
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.max(1, Math.floor(w / STEP));
      const r = rng(11);
      jitter = Array.from({ length: n }, () => r());
      you = Math.round(n * YOU);
      colours();
    };

    const draw = (now: number) => {
      const t = still ? 0 : (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h);
      const n = jitter.length;
      const off = (w - (n - 1) * STEP - BAR) / 2;
      const height = (i: number) => {
        const u = i / n;
        const wave = 1 + 0.07 * Math.sin(t * 0.55 + u * 9) + 0.04 * Math.sin(t * 0.9 - u * 23);
        return h * 0.8 * envelope(u) * (0.86 + 0.14 * jitter[i]) * wave;
      };
      ctx.fillStyle = fill;
      for (let i = 0; i < n; i++) {
        if (i === you) continue;
        const bh = height(i);
        ctx.fillRect(off + i * STEP, h - bh, BAR, bh);
      }
      // The coral bar, a cap and a soft glow: "you are here".
      const x = off + you * STEP + BAR / 2;
      const top = h - height(you);
      const glow = ctx.createRadialGradient(x, top, 0, x, top, 60);
      glow.addColorStop(0, hexA(coral, 0.35));
      glow.addColorStop(1, hexA(coral, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(x - 60, top - 60, 120, 120);
      ctx.fillStyle = coral;
      ctx.fillRect(x - 1.5, top, 3, h - top);
      ctx.beginPath();
      ctx.arc(x, top - 9, 4, 0, Math.PI * 2);
      ctx.fill();
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 66) return; // ~15 fps: smooth enough for motion this slow, and half the paint work of 30
      last = now;
      draw(now);
    };
    const play = () => {
      if (still || raf || !visible || !ready) return;
      raf = requestAnimationFrame(loop);
    };
    const pause = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    resize();
    draw(performance.now());
    const ro = new ResizeObserver(() => {
      resize();
      draw(performance.now());
    });
    ro.observe(cv);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) play();
      else pause();
    });
    io.observe(cv);
    // Start breathing after load, when the browser is idle.
    const idle = (cb: () => void) => (typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(cb, { timeout: 3000 }) : setTimeout(cb, 1500));
    const begin = () =>
      idle(() => {
        ready = true;
        play();
      });
    if (document.readyState === "complete") begin();
    else window.addEventListener("load", begin, { once: true });
    const unwatch = watchTheme(() => {
      colours();
      draw(performance.now());
    });
    return () => {
      pause();
      window.removeEventListener("load", begin);
      ro.disconnect();
      io.disconnect();
      unwatch();
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={className} />;
}
