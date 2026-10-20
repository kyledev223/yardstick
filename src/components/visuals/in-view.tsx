"use client";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Decorative wrapper (aria-hidden) that marks itself data-inview="true" while on screen, so the looping CSS
 * animations inside it (pulses, dial, podium) only run while someone can see them.
 */
export function InView({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      el.dataset.inview = String(e.isIntersecting);
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} aria-hidden className={className}>
      {children}
    </div>
  );
}
