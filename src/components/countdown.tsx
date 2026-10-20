"use client";
import { useSyncExternalStore } from "react";

// A one-second clock. The snapshot only changes inside the interval, so React always reads a stable value.
const nowSeconds = () => Math.floor(Date.now() / 1000);
let current = typeof window === "undefined" ? 0 : nowSeconds();
const subscribe = (l: () => void) => {
  // Catch up at once if the page has been open a while before this countdown mounted.
  current = nowSeconds();
  l();
  const t = setInterval(() => {
    current = nowSeconds();
    l();
  }, 1000);
  return () => clearInterval(t);
};
const snapshot = () => current;

const pad = (n: number) => String(n).padStart(2, "0");

/** Time left until the next UTC midnight, as HH:MM:SS, ticking every second (also under reduced motion: it's information, not decoration). */
export function Countdown({ className = "" }: { className?: string }) {
  const now = useSyncExternalStore(subscribe, snapshot, () => null);
  if (now === null) {
    return (
      <span className={`num ${className}`} aria-hidden>
        --:--:--
      </span>
    );
  }
  const left = 86_400 - (now % 86_400);
  const [h, m, s] = [Math.floor(left / 3600), Math.floor((left % 3600) / 60), left % 60];
  return (
    <span role="timer" aria-label={`${h} hours ${m} minutes`} className={`num ${className}`}>
      {pad(h)}:{pad(m)}:{pad(s)}
    </span>
  );
}
