import { ImageResponse } from "next/og";
import { LOGO_BOLT_PATH, LOGO_FRAME_PATH, LOGO_VIEWBOX } from "@/components/ui/Logo";

/**
 * 180×180 Apple touch icon, generated from the same logo mark as icon.svg
 * (Next's file convention emits the <link rel="apple-touch-icon"> tag).
 */
export const runtime = "nodejs";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const BG = "#050608";
const ACCENT = "#22E58A";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: BG,
          backgroundImage: "radial-gradient(circle at 50% 40%, rgba(34,229,138,0.18) 0%, rgba(34,229,138,0) 70%)",
        }}
      >
        <svg width="124" height="124" viewBox={LOGO_VIEWBOX}>
          <path d={LOGO_FRAME_PATH} fill={ACCENT} fillOpacity="0.08" />
          <path d={LOGO_FRAME_PATH} fill="none" stroke={ACCENT} strokeWidth="3" strokeLinejoin="round" />
          <path d={LOGO_BOLT_PATH} fill="none" stroke={BG} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          <path d={LOGO_BOLT_PATH} fill="none" stroke={ACCENT} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size,
  );
}
