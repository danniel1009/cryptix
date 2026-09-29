"use client";

import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export type LiveIndicatorState = "live" | "reconnecting" | "unavailable" | "stale";

export interface LiveIndicatorProps {
  state: LiveIndicatorState;
  /** Override the default dictionary label. */
  label?: string;
  className?: string;
  /** Render only the dot (label still exposed to screen readers). */
  dotOnly?: boolean;
}

const TEXT: Record<LiveIndicatorState, string> = {
  live: "text-accent",
  reconnecting: "text-warning",
  stale: "text-warning",
  unavailable: "text-faint",
};

const DOT: Record<LiveIndicatorState, string> = {
  live: "bg-accent shadow-[0_0_8px_rgba(34,229,138,0.85)]",
  reconnecting: "border border-warning bg-transparent",
  stale: "bg-warning",
  unavailable: "bg-faint",
};

/**
 * 8px status dot + mono label. live = pulsing emerald halo; reconnecting =
 * hollow warning ring with a slow pulse; stale = solid warning; unavailable =
 * faint, no motion. `role="status"` so state changes are announced.
 */
export function LiveIndicator({ state, label, className, dotOnly = false }: LiveIndicatorProps) {
  const { t } = useI18n();
  const defaultLabel: Record<LiveIndicatorState, string> = {
    live: t.common.live,
    reconnecting: t.common.reconnecting,
    stale: t.common.lastUpdated,
    unavailable: t.common.unavailable,
  };
  const text = label ?? defaultLabel[state];

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase leading-none tracking-[0.16em]",
        TEXT[state],
        className,
      )}
    >
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
        {state === "live" ? (
          <span className="absolute inset-0 animate-halo rounded-full bg-accent" />
        ) : null}
        {state === "reconnecting" ? (
          <span className="absolute inset-0 animate-halo-slow rounded-full border border-warning" />
        ) : null}
        <span className={cn("relative h-2 w-2 rounded-full", DOT[state])} />
      </span>
      <span className={cn(dotOnly && "sr-only")}>{text}</span>
    </span>
  );
}
