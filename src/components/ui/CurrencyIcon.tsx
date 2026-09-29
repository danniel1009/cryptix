import { CURRENCIES, type CurrencyCode } from "@/config/exchange";
import { cn } from "@/lib/utils";

/**
 * Minimal, original coin marks (NOT the official logos): a tinted disc in the
 * currency's brand colour plus a simple geometric glyph.
 */
export interface CurrencyIconProps {
  code: CurrencyCode;
  size?: number;
  className?: string;
  /** Hide from assistive tech when a text label sits next to it. */
  decorative?: boolean;
}

function Glyph({ code, color }: { code: CurrencyCode; color: string }) {
  const stroke = {
    fill: "none",
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (code) {
    case "BTC":
      // "₿"-like: a B with bars through the top and bottom.
      return (
        <g {...stroke}>
          <path d="M12.5 9.5H18.2a3 3 0 0 1 0 6H12.5M12.5 15.5H19a3.25 3.25 0 0 1 0 6.5H12.5V9.5" />
          <path d="M15 7v2.5M18 7v2.5M15 22v3M18 22v3" />
        </g>
      );
    case "ETH":
      // Faceted diamond.
      return (
        <g {...stroke} strokeWidth={1.8}>
          <path d="M16 6.5 23.5 16 16 25.5 8.5 16Z" />
          <path d="M8.5 16 16 19.8 23.5 16M16 6.5v13.3" />
        </g>
      );
    case "SOL":
      // Three slanted bars.
      return (
        <g fill={color}>
          <path d="M8.5 12 11.5 9h12l-3 3z" />
          <path d="M11.5 18l-3-3h12l3 3z" />
          <path d="M8.5 24l3-3h12l-3 3z" />
        </g>
      );
    case "USDT":
      // A plain "T" with a short under-bar.
      return (
        <g {...stroke}>
          <path d="M10.5 11.5h11M16 11.5V22M13 16.5h6" />
        </g>
      );
    case "IDR":
      return (
        <text
          x="16"
          y="16.5"
          textAnchor="middle"
          dominantBaseline="central"
          fill={color}
          fontFamily="var(--font-geist-mono), ui-monospace, monospace"
          fontSize="11"
          fontWeight="700"
          letterSpacing="-0.02em"
        >
          Rp
        </text>
      );
  }
}

export function CurrencyIcon({ code, size = 24, className, decorative = false }: CurrencyIconProps) {
  const meta = CURRENCIES[code];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : meta.name}
      aria-hidden={decorative ? "true" : undefined}
      focusable="false"
      className={cn("shrink-0", className)}
    >
      <circle cx="16" cy="16" r="15" fill={meta.color} fillOpacity="0.14" />
      <circle cx="16" cy="16" r="15" fill="none" stroke={meta.color} strokeOpacity="0.45" />
      <Glyph code={code} color={meta.color} />
    </svg>
  );
}
