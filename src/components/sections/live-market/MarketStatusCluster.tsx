"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import { useReducedMotionSafe } from "@/hooks/useReducedMotionSafe";
import { interpolate } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import type { MarketConnection } from "@/providers/MarketProvider";
import { cn } from "@/lib/utils";
import { deriveIndicator, type MarketView } from "./rows";

export interface MarketStatusClusterProps {
  view: MarketView;
  connection: MarketConnection;
  lastUpdatedAt: Date | null;
  onRefresh: () => void;
  className?: string;
}

/** How often the "x minutes ago" text re-renders while the data is stale. */
const RELATIVE_TICK_MS = 15_000;
/** How long the refresh glyph spins after a click (visual acknowledgement only). */
const SPIN_MS = 700;

/**
 * Headline status cluster next to the section heading: the live indicator,
 * "Last updated: 12:04:31", a relative "Last updated 3 minutes ago" while
 * stale, and a refresh button.
 */
export function MarketStatusCluster({ view, connection, lastUpdatedAt, onRefresh, className }: MarketStatusClusterProps) {
  const { t, formatTime, formatRelativeTime } = useI18n();
  const reduced = useReducedMotionSafe();
  const indicator = deriveIndicator(view, connection);
  const stale = view === "stale";

  // The market context only re-renders on status changes, so the relative
  // wording needs its own clock while it is on screen.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!stale) return;
    const timer = window.setInterval(() => setNow(Date.now()), RELATIVE_TICK_MS);
    return () => window.clearInterval(timer);
  }, [stale]);

  const [spinning, setSpinning] = useState(false);
  useEffect(() => {
    if (!spinning) return;
    const timer = window.setTimeout(() => setSpinning(false), SPIN_MS);
    return () => window.clearTimeout(timer);
  }, [spinning]);

  const handleRefresh = () => {
    onRefresh();
    if (!reduced) setSpinning(true);
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-x-5 gap-y-3", className)}>
      <LiveIndicator state={indicator.state} label={t.market[indicator.labelKey]} />

      {lastUpdatedAt ? (
        <div className="flex flex-col items-start gap-1 lg:items-end">
          <span className="font-mono text-xs nums text-faint">
            {interpolate(t.market.lastUpdated, { time: formatTime(lastUpdatedAt) })}
          </span>
          {stale ? (
            <span className="font-mono text-xs text-warning">
              {interpolate(t.market.updatedAgo, { time: formatRelativeTime(lastUpdatedAt, now) })}
            </span>
          ) : null}
        </div>
      ) : null}

      <IconButton
        label={t.market.refresh}
        variant="secondary"
        size="md"
        icon={<RefreshCw className={cn(spinning && "animate-spin")} />}
        onClick={handleRefresh}
        className="-my-1"
      />
    </div>
  );
}
