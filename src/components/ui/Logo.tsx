import { useId } from "react";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * Cryptix mark — an original geometric symbol: a hexagonal frame with an
 * energy bolt cutting diagonally through it (the frame is knocked out where the
 * bolt crosses). Emerald gradient stroke, subtle glow. Inline SVG only.
 *
 * The path data is exported so the favicon (icon.svg) and the OG image can use
 * the exact same geometry.
 */
export const LOGO_VIEWBOX = "0 0 64 64";
/** Pointy-top hexagon, radius 27, centred at (32, 32). */
export const LOGO_FRAME_PATH = "M32 5 L55.4 18.5 V45.5 L32 59 L8.6 45.5 V18.5 Z";
/** Bolt: enters through the top-left edge, jogs at the centre, exits bottom-right. */
export const LOGO_BOLT_PATH = "M15 6 L37 29 H27 L49 58";
export const LOGO_GRADIENT = { from: "#7CF5BE", mid: "#22E58A", to: "#10B981" } as const;

export interface LogoProps {
  /** Rendered size of the mark in px (square). */
  size?: number;
  /** Show the uppercase wordmark next to the mark. */
  withWordmark?: boolean;
  className?: string;
  /** Extra classes for the SVG mark. */
  markClassName?: string;
  /** Disable the soft drop-shadow glow (e.g. on light chips or tiny sizes). */
  glow?: boolean;
}

/** Sanitise React's useId output so it is safe inside `url(#…)`. */
function safeId(raw: string, suffix: string): string {
  return `cx-${raw.replace(/[^a-zA-Z0-9_-]/g, "")}-${suffix}`;
}

export function LogoMark({
  size = 32,
  className,
  glow = true,
}: {
  size?: number;
  className?: string;
  glow?: boolean;
}) {
  const uid = useId();
  const gradientId = safeId(uid, "g");
  const maskId = safeId(uid, "m");

  return (
    <svg
      width={size}
      height={size}
      viewBox={LOGO_VIEWBOX}
      aria-hidden="true"
      focusable="false"
      className={cn(
        "shrink-0",
        glow && "drop-shadow-[0_0_10px_rgba(34,229,138,0.35)]",
        className,
      )}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={LOGO_GRADIENT.from} />
          <stop offset="0.55" stopColor={LOGO_GRADIENT.mid} />
          <stop offset="1" stopColor={LOGO_GRADIENT.to} />
        </linearGradient>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          <rect width="64" height="64" fill="#fff" />
          {/* Knock the frame out along the bolt so it reads as "cut through". */}
          <path
            d={LOGO_BOLT_PATH}
            fill="none"
            stroke="#000"
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </mask>
      </defs>
      {/* Faint fill gives the frame body without competing with the stroke. */}
      <path d={LOGO_FRAME_PATH} fill={LOGO_GRADIENT.mid} fillOpacity="0.06" />
      <path
        d={LOGO_FRAME_PATH}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="3"
        strokeLinejoin="round"
        mask={`url(#${maskId})`}
      />
      <path
        d={LOGO_BOLT_PATH}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({
  size = 32,
  withWordmark = false,
  className,
  markClassName,
  glow = true,
}: LogoProps) {
  return (
    <span className={cn("inline-flex select-none items-center gap-3", className)}>
      <LogoMark size={size} className={markClassName} glow={glow} />
      {withWordmark ? (
        <span
          className="font-semibold uppercase leading-none tracking-[0.2em] text-fg"
          style={{ fontSize: Math.max(12, Math.round(size * 0.5)) }}
        >
          {siteConfig.name}
        </span>
      ) : (
        <span className="sr-only">{siteConfig.name}</span>
      )}
    </span>
  );
}
