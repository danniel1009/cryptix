import { ImageResponse } from "next/og";
import { LOGO_BOLT_PATH, LOGO_FRAME_PATH, LOGO_VIEWBOX } from "@/components/ui/Logo";
import { serverConfig } from "@/config/server";
import { siteConfig } from "@/config/site";
import { en } from "@/lib/i18n/dictionaries/en";
import { formatSpread } from "@/lib/i18n/format";

/**
 * Open Graph image (1200×630). Rendered by Satori: every multi-child <div>
 * needs `display: flex`, and only the bundled Geist Regular is available, so
 * hierarchy comes from size, tracking and colour rather than font weight.
 */
export const runtime = "nodejs";
export const alt = `${siteConfig.name} — ${en.footer.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#050608";
const ACCENT = "#22E58A";
const FG = "#F2F4F7";
const MUTED = "#9AA3B2";
const LINE = "rgba(255,255,255,0.10)";

export default function OpenGraphImage() {
  const spread = formatSpread("en", serverConfig.exchange.spread);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          backgroundColor: BG,
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          color: FG,
          fontFamily: "Geist, sans-serif",
        }}
      >
        {/* Emerald glow, top-left */}
        <div
          style={{
            position: "absolute",
            top: -220,
            left: -160,
            width: 640,
            height: 640,
            borderRadius: 9999,
            background: "radial-gradient(circle, rgba(34,229,138,0.22) 0%, rgba(34,229,138,0) 65%)",
          }}
        />

        {/* Header: mark + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <svg width="76" height="76" viewBox={LOGO_VIEWBOX}>
            <path d={LOGO_FRAME_PATH} fill={ACCENT} fillOpacity="0.07" />
            <path d={LOGO_FRAME_PATH} fill="none" stroke={ACCENT} strokeWidth="3" strokeLinejoin="round" />
            {/* Knock-out: thick background-coloured stroke under the bolt (Satori has no <mask>). */}
            <path d={LOGO_BOLT_PATH} fill="none" stroke={BG} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
            <path d={LOGO_BOLT_PATH} fill="none" stroke={ACCENT} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ display: "flex", fontSize: 34, letterSpacing: "0.22em", textTransform: "uppercase", color: FG }}>
            {siteConfig.name}
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              display: "flex",
              fontSize: 78,
              lineHeight: 1,
              letterSpacing: "-0.03em",
              textTransform: "uppercase",
              color: FG,
              maxWidth: 1000,
            }}
          >
            {en.footer.tagline}
          </div>
          <div style={{ display: "flex", fontSize: 28, color: MUTED, letterSpacing: "-0.01em" }}>
            {en.hero.supporting.join(" · ")}
          </div>
        </div>

        {/* Footer row: pricing chip + pairs */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 24px",
              borderRadius: 9999,
              border: "1px solid rgba(34,229,138,0.35)",
              backgroundColor: "rgba(34,229,138,0.10)",
              color: ACCENT,
              fontSize: 24,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: 9999, backgroundColor: ACCENT }} />
            {`Market Price + ${spread}`}
          </div>
          <div style={{ display: "flex", gap: 14 }}>
            {["USDT", "BTC", "ETH", "SOL", "IDR"].map((code) => (
              <div
                key={code}
                style={{
                  display: "flex",
                  padding: "10px 18px",
                  borderRadius: 12,
                  border: `1px solid ${LINE}`,
                  backgroundColor: "rgba(11,14,18,0.8)",
                  color: MUTED,
                  fontSize: 22,
                  letterSpacing: "0.08em",
                }}
              >
                {code}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
