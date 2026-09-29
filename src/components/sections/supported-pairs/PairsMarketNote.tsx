"use client";

import { LiveIndicator, type LiveIndicatorState } from "@/components/ui/LiveIndicator";
import { interpolate } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import { useMarket } from "@/providers/MarketProvider";

/**
 * One quiet status line for the whole pairs grid (docs/ARCHITECTURE.md UI rule):
 *   status "unavailable" → unavailable copy (cards already hide their numbers)
 *   status "stale"       → "Last updated …" (cards de-emphasise their numbers)
 *   connection offline / polling / reconnecting with fresh data → the note, data stays
 *   live                 → the LIVE dot only
 * Nothing is shown while the very first snapshot is still loading.
 */
export function PairsMarketNote({ className }: { className?: string }) {
  const { t, formatRelativeTime } = useI18n();
  const { snapshot, status, connection, lastUpdatedAt } = useMarket();

  if (!snapshot && connection === "connecting") return null;

  let state: LiveIndicatorState;
  let label: string;
  if (status === "unavailable") {
    state = "unavailable";
    label = t.common.marketUnavailable;
  } else if (status === "stale") {
    state = "stale";
    label = lastUpdatedAt
      ? interpolate(t.common.updatedAgo, { time: formatRelativeTime(lastUpdatedAt) })
      : t.market.stale;
  } else if (connection === "offline") {
    state = "reconnecting";
    label = t.market.offlineNote;
  } else if (connection === "polling") {
    state = "reconnecting";
    label = t.market.pollingNote;
  } else if (connection === "reconnecting") {
    state = "reconnecting";
    label = t.common.reconnecting;
  } else {
    state = "live";
    label = t.common.live;
  }

  return (
    <div className={className}>
      {/* The LIVE dot keeps its tiny uppercase mono label; longer notes read as sentences. */}
      <LiveIndicator
        state={state}
        label={label}
        className={state === "live" ? undefined : "normal-case tracking-[0.04em]"}
      />
    </div>
  );
}
