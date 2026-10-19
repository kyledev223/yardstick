"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/launch", "Launch"],
  ["/today", "Today"],
  ["/how", "How it works"],
] as const;

export function MainNav({ className = "" }: { className?: string }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className={`-mx-3 flex gap-1 ${className}`}>
      {LINKS.map(([href, label]) => {
        const here = path === href || path.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={here ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-pill px-3 font-semibold transition-colors duration-(--dur-fast) ${here ? "bg-sunk text-ink" : "text-muted hover:text-ink"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
