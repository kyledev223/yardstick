import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { db, hasDatabase } from "@/lib/db";
import { isMint } from "@/lib/data/coins";
import { coinView } from "@/lib/data/dashboard";
import { fmtAge } from "@/lib/format";

export const alt = "Where this coin stands among pump.fun coins of the same age";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Light-theme tokens from globals.css (the card is always light).
const PAGE = "#e8e5df";
const SURFACE = "#ffffff";
const INK = "#071b1f";
const MUTED = "#3d4c4f";
const TEAL = "#299093";
const YOU = "#1c7a7d";
const RANGE = "#dcd8cc";
const RANGE_STRONG = "#cfc9b9";

// Figtree (SIL OFL 1.1), static weights for the image renderer.
const figtree800 = readFile(join(process.cwd(), "assets/fonts/figtree-latin-800-normal.woff"));
const figtree500 = readFile(join(process.cwd(), "assets/fonts/figtree-latin-500-normal.woff"));

/** Share card: coin image, symbol, age and standing on a percentile bar. Generated on request. */
export default async function Image({ params }: { params: Promise<{ mint: string }> }) {
  const { mint } = await params;
  const coin = hasDatabase() && isMint(mint) ? await db().coin.findUnique({ where: { mint } }).catch(() => null) : null;
  const view = coin ? await coinView(coin).catch(() => null) : null;
  const st = view?.standing.baseline.percentile != null ? view.standing.baseline : view?.standing.yardstick;
  const pct = st?.percentile ?? null;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: PAGE, color: INK, padding: "60px 72px", fontFamily: "Figtree" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {view?.coin.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={view.coin.image} width={112} height={112} style={{ borderRadius: 24, objectFit: "cover", background: RANGE }} alt="" />
          ) : (
            <div style={{ width: 112, height: 112, borderRadius: 24, background: RANGE, display: "flex" }} />
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 60, fontWeight: 800, letterSpacing: -2.4, lineHeight: 1.05 }}>{view ? `$${view.coin.symbol}` : "pump.fun coin"}</div>
            <div style={{ fontSize: 30, fontWeight: 500, color: MUTED }}>{view ? `${view.coin.name.slice(0, 40)}, ${fmtAge(view.coin.ageSeconds)} old` : mint.slice(0, 8) + "…"}</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 56, fontSize: 104, fontWeight: 800, letterSpacing: -4.5, lineHeight: 1 }}>
          {pct !== null ? (
            <>
              <span>Top</span>
              <span style={{ background: TEAL, color: "#ffffff", borderRadius: 9999, padding: "4px 30px 10px" }}>{Math.max(1, Math.round(100 - pct))}%</span>
              <span style={{ fontSize: 56, letterSpacing: -2, color: MUTED }}>at {st!.bucket}</span>
            </>
          ) : (
            <span style={{ fontSize: 84 }}>{view?.latest ? "Comparison still building" : "Measuring…"}</span>
          )}
        </div>

        {/* Percentile bar: track, middle half, median notch, this coin */}
        <div style={{ display: "flex", position: "relative", marginTop: 48, height: 44, alignItems: "center", opacity: pct === null ? 0.4 : 1 }}>
          <div style={{ position: "absolute", left: 0, right: 0, height: 22, borderRadius: 9999, background: RANGE }} />
          <div style={{ position: "absolute", left: "25%", width: "50%", height: 22, borderRadius: 9999, background: RANGE_STRONG }} />
          <div style={{ position: "absolute", left: "50%", width: 4, marginLeft: -2, top: 0, bottom: 0, borderRadius: 4, background: MUTED }} />
          {pct !== null && <div style={{ position: "absolute", left: 0, width: `${pct}%`, height: 8, borderRadius: 9999, background: YOU }} />}
          {pct !== null && <div style={{ position: "absolute", left: `${pct}%`, width: 40, height: 40, marginLeft: -20, borderRadius: 9999, background: YOU, border: `6px solid ${SURFACE}` }} />}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", fontSize: 26, fontWeight: 500, color: MUTED }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, color: INK, fontSize: 34, fontWeight: 800, letterSpacing: -1.4 }}>
            <div style={{ display: "flex", alignItems: "center", width: 56, height: 22, borderRadius: 9999, background: TEAL, position: "relative" }}>
              <div style={{ position: "absolute", left: 32, width: 14, height: 14, borderRadius: 9999, background: INK }} />
            </div>
            yardstick
          </div>
          <span>{st && st.sampleSize ? `Compared with ${st.sampleSize.toLocaleString("en-US")} coins at the same age` : "Launch on pump.fun. See where you stand."}</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Figtree", data: await figtree800, style: "normal", weight: 800 },
        { name: "Figtree", data: await figtree500, style: "normal", weight: 500 },
      ],
    },
  );
}
