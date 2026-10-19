import type { Metadata, Viewport } from "next";
import { Figtree, IBM_Plex_Mono } from "next/font/google";
import Script from "next/script";
import { CursorField } from "@/components/cursor-field";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { themeScript } from "@/components/theme-toggle";
import "./globals.css";

// Figtree (variable, 300–900) for everything; Plex Mono only for addresses and signatures.
const sans = Figtree({ variable: "--font-figtree", subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

const siteUrl = process.env.SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Yardstick: launch on pump.fun, see where you stand", template: "%s | Yardstick" },
  description: "Launch a coin on pump.fun, then compare it with other coins of the same age. Free, non-custodial, no fees.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e8e5df" },
    { media: "(prefers-color-scheme: dark)", color: "#071a1d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="relative flex min-h-full flex-col">
        <Script id="theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <CursorField />
        {/* Content layer sits above the cursor field. */}
        <div className="relative z-[1] flex flex-1 flex-col">
          <Providers>
            <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
              Skip to content
            </a>
            <SiteHeader />
            <main id="main" className="flex-1">
              {children}
            </main>
            <SiteFooter />
          </Providers>
        </div>
      </body>
    </html>
  );
}
