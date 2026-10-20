"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV_LINKS = [
  ["/launch", "Launch"],
  ["/today", "Today"],
  ["/how", "How it works"],
  ["/status", "Status"],
] as const;

/** Header nav: small medium-weight links that fade to half opacity on hover; the current page is in the primary colour. */
export function MainNav({ className = "", large = false, onNavigate }: { className?: string; large?: boolean; onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className={className}>
      <ul className={large ? "flex flex-col" : "flex items-center gap-5"}>
        {NAV_LINKS.map(([href, label]) => {
          const here = path === href || path.startsWith(href + "/");
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={here ? "page" : undefined}
                className={`transition-opacity duration-(--dur-fast) hover:opacity-50 ${here ? "text-primary-ink" : ""} ${
                  large ? "flex min-h-12 items-center text-[1.75rem] font-medium tracking-[-0.05em]" : "inline-flex min-h-8 items-center text-label font-medium"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
