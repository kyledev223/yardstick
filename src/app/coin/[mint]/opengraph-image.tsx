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
const PAPER = "#f8f9ff";
const CARD = "#ffffff";
const TINT = "#eceffe";
const INK = "#070a24";
const MUTED = "#464d7a";
const RULE = "#d5daf3";
const PRIMARY = "#2442ff";
const PANEL_ACCENT = "#8c9bff";
const MEDIAN = "#4a5285";
const RANGE = "#dde2fd";
const RANGE_STRONG = "#b4c0ff";

// Geist and Geist Mono (SIL OFL 1.1), static weights for the image renderer.
const geist500 = readFile(join(process.cwd(), "assets/fonts/Geist-Medium.ttf"));
const geist400 = readFile(join(process.cwd(), "assets/fonts/Geist-Regular.ttf"));
const geistMono = readFile(join(process.cwd(), "assets/fonts/GeistMono-Regular.ttf"));

/** Share card: coin image, name and age, the standing in the primary colour, and the percentile bar. Generated on request. */
export default async function Image({ params }: { params: Promise<{ mint: string }> }) {
  const { mint } = await params;
  const coin = hasDatabase() && isMint(mint) ? await db().coin.findUnique({ where: { mint } }).catch(() => null) : null;
  const view = coin ? await coinView(coin).catch(() => null) : null;
  const st = view?.standing.baseline.percentile != null ? view.standing.baseline : view?.standing.yardstick;
  const pct = st?.percentile ?? null;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: PAPER, color: INK, padding: "56px 72px", fontFamily: "Geist" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {view?.coin.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={view.coin.image} width={112} height={112} style={{ borderRadius: 28, objectFit: "cover", background: TINT }} alt="" />
          ) : (
            <div style={{ width: 112, height: 112, borderRadius: 28, background: TINT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52, color: MUTED }}>
              {view ? view.coin.symbol.slice(0, 1) : ""}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: "Geist Mono", fontSize: 22, color: MUTED, letterSpacing: 1 }}>{view ? `$${view.coin.symbol}` : "PUMP.FUN COIN"}</div>
            <div style={{ fontSize: 60, fontWeight: 500, letterSpacing: -3, lineHeight: 1.05 }}>{view ? view.coin.name.slice(0, 32) : mint.slice(0, 8) + "…"}</div>
            {view && <div style={{ fontSize: 26, color: MUTED }}>{fmtAge(view.coin.ageSeconds)} old</div>}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 22, marginTop: 44, fontWeight: 500, lineHeight: 1, color: pct !== null ? PRIMARY : INK }}>
          {pct !== null ? (
            <>
              <span style={{ fontSize: 64, letterSpacing: -3 }}>Top</span>
              <span style={{ fontSize: 150, letterSpacing: -9 }}>{Math.max(1, Math.round(100 - pct))}%</span>
              <span style={{ fontSize: 40, letterSpacing: -1.5, color: MUTED }}>at {st!.bucket}</span>
            </>
          ) : (
            <span style={{ fontSize: 80, letterSpacing: -4.5 }}>{view?.latest ? "Comparison still building" : "Measuring…"}</span>
          )}
        </div>

        {/* Percentile bar: track, middle half, median notch, this coin */}
        <div style={{ display: "flex", position: "relative", marginTop: 40, height: 40, alignItems: "center", opacity: pct === null ? 0.4 : 1 }}>
          <div style={{ position: "absolute", left: 0, right: 0, height: 20, borderRadius: 9999, background: RANGE }} />
          <div style={{ position: "absolute", left: "25%", width: "50%", height: 20, borderRadius: 9999, background: RANGE_STRONG }} />
          <div style={{ position: "absolute", left: "50%", width: 4, marginLeft: -2, top: 0, bottom: 0, borderRadius: 4, background: MEDIAN }} />
          {pct !== null && <div style={{ position: "absolute", left: 0, width: `${pct}%`, height: 8, borderRadius: 9999, background: PRIMARY }} />}
          {pct !== null && <div style={{ position: "absolute", left: `${pct}%`, width: 38, height: 38, marginLeft: -19, borderRadius: 9999, background: PRIMARY, border: `6px solid ${CARD}` }} />}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: 24, borderTop: `2px solid ${RULE}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: INK, color: "#f3f4ff", borderRadius: 14, padding: "10px 18px", fontSize: 30, fontWeight: 500, letterSpacing: -1.2 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 24 }}>
              <div style={{ width: 5, height: 12, borderRadius: 3, background: "#f3f4ff" }} />
              <div style={{ width: 5, height: 18, borderRadius: 3, background: "#f3f4ff" }} />
              <div style={{ width: 5, height: 24, borderRadius: 3, background: "#f3f4ff" }} />
              <div style={{ width: 10, height: 10, borderRadius: 9999, background: PANEL_ACCENT, alignSelf: "flex-start" }} />
            </div>
            yardstick
          </div>
          <span style={{ fontFamily: "Geist Mono", fontSize: 20, color: MUTED, letterSpacing: 1.5, textTransform: "uppercase" }}>
            {st && st.sampleSize ? `Compared with ${st.sampleSize.toLocaleString("en-US")} coins at the same age` : "Launch a coin. See where it stands."}
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: await geist500, style: "normal", weight: 500 },
        { name: "Geist", data: await geist400, style: "normal", weight: 400 },
        { name: "Geist Mono", data: await geistMono, style: "normal", weight: 400 },
      ],
    },
  );
}
