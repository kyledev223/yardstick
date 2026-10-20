"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

type Mode = "system" | "light" | "dark";
const ORDER: Mode[] = ["system", "light", "dark"];
const KEY = "ys-theme";

/** Runs before paint (inlined in <head>) so the page never flashes the wrong theme. */
export const themeScript = `try{var m=localStorage.getItem("${KEY}");if(m==="light"||m==="dark")document.documentElement.dataset.theme=m}catch(e){}`;

const listeners = new Set<() => void>();
function read(): Mode {
  try {
    const m = localStorage.getItem(KEY);
    return m === "light" || m === "dark" ? m : "system";
  } catch {
    return "system";
  }
}
function write(m: Mode) {
  try {
    if (m === "system") {
      localStorage.removeItem(KEY);
      delete document.documentElement.dataset.theme;
    } else {
      localStorage.setItem(KEY, m);
      document.documentElement.dataset.theme = m;
    }
  } catch {}
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function ThemeToggle({ className = "" }: { className?: string }) {
  const mode = useSyncExternalStore(subscribe, read, () => "system" as Mode);
  const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;
  return (
    <button
      type="button"
      onClick={() => write(next)}
      className={`grid h-8 w-8 place-items-center rounded-pill text-muted transition-colors duration-(--dur-fast) hover:bg-tint hover:text-ink ${className}`}
      aria-label={`Theme: ${mode}. Switch to ${next}.`}
      title={`Theme: ${mode}`}
    >
      <Icon size={15} strokeWidth={2} aria-hidden />
    </button>
  );
}
