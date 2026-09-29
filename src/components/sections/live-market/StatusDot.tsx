import type { MarketStatus } from "@/lib/market/types";
import { cn } from "@/lib/utils";

export interface StatusDotProps {
  state: MarketStatus;
  /** Tiny mono label rendered next to the dot (already uppercase in the dictionary). */
  label: string;
  className?: string;
}

const TEXT: Record<MarketStatus, string> = {
  live: "text-accent",
  stale: "text-warning",
  unavailable: "text-faint",
};

const DOT: Record<MarketStatus, string> = {
  live: "bg-accent shadow-[0_0_8px_rgba(34,229,138,0.85)]",
  stale: "bg-warning",
  unavailable: "bg-faint",
};

/**
 * Per-row status dot. Visually identical to the ui `LiveIndicator`, but it is
 * NOT a live region: the headline indicator already announces status changes
 * once, and eight extra `role="status"` regions (4 rows × 2 layouts) would
 * make every flip a chorus for screen-reader users. The label is plain text
 * so the Status column still reads correctly.
 */
export function StatusDot({ state, label, className }: StatusDotProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase leading-none tracking-[0.16em]",
        TEXT[state],
        className,
      )}
    >
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
        {state === "live" ? <span className="absolute inset-0 animate-halo rounded-full bg-accent" /> : null}
        <span className={cn("relative h-2 w-2 rounded-full", DOT[state])} />
      </span>
      <span>{label}</span>
    </span>
  );
}
