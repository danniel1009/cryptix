import { MARKET_DISPLAY_PAIRS, type CurrencyCode } from "@/config/exchange";
import type { LiveIndicatorState } from "@/components/ui/LiveIndicator";
import type { MarketQuote, MarketStatus } from "@/lib/market/types";
import type { MarketConnection } from "@/providers/MarketProvider";

/**
 * Pure helpers for the LIVE MARKET section. No React, no I/O — unit-testable
 * and shared by the desktop table and the mobile cards.
 */

/** One display row: a configured base/quote pair plus whatever quote the feed has for it. */
export interface MarketRowModel {
  /** Stable key, e.g. "BTC/USDT". */
  key: string;
  base: CurrencyCode;
  quote: CurrencyCode;
  /** `undefined` when the feed has no route for this pair (rendered as "—" / unavailable). */
  data: MarketQuote | undefined;
}

export type QuoteLookup = (base: CurrencyCode, quote: CurrencyCode) => MarketQuote | undefined;

/** MARKET_DISPLAY_PAIRS in display order, resolved through the feed's quote lookup. */
export function buildMarketRows(getQuote: QuoteLookup): MarketRowModel[] {
  return MARKET_DISPLAY_PAIRS.map(({ base, quote }) => ({
    key: `${base}/${quote}`,
    base,
    quote,
    data: getQuote(base, quote),
  }));
}

/**
 * What the section is showing right now.
 * - loading: no snapshot has ever arrived and the transport is still connecting
 *   (skeletons — NOT the unavailable notice, which would be premature).
 * - otherwise the data status from the feed (status, never connection, decides
 *   whether numbers may be shown as live — docs/ARCHITECTURE.md).
 */
export type MarketView = "loading" | MarketStatus;

export function deriveMarketView(hasSnapshot: boolean, status: MarketStatus, connection: MarketConnection): MarketView {
  if (!hasSnapshot && connection === "connecting") return "loading";
  return status;
}

/** Dictionary key (inside `t.market`) for the headline indicator label. */
export type IndicatorLabelKey = "live" | "reconnecting" | "stale" | "unavailable" | "connecting";

export interface IndicatorModel {
  state: LiveIndicatorState;
  labelKey: IndicatorLabelKey;
}

/**
 * Headline indicator: data status first, then the transport.
 * Fresh data over a degraded transport (reconnecting / polling / offline) is
 * still live data, but the hollow "reconnecting" ring tells the truth about
 * the connection. While the very first snapshot loads, the ring reads
 * "connecting".
 */
export function deriveIndicator(view: MarketView, connection: MarketConnection): IndicatorModel {
  if (view === "loading") return { state: "reconnecting", labelKey: "connecting" };
  if (view === "unavailable") return { state: "unavailable", labelKey: "unavailable" };
  if (view === "stale") return { state: "stale", labelKey: "stale" };
  if (connection === "reconnecting" || connection === "polling" || connection === "offline") {
    return { state: "reconnecting", labelKey: "reconnecting" };
  }
  return { state: "live", labelKey: "live" };
}

/** Direction of a 24h change for badge colour / arrow. */
export type ChangeDirection = "up" | "down" | "flat" | "unknown";

export function changeDirection(change: number | null | undefined): ChangeDirection {
  if (change === null || change === undefined || !Number.isFinite(change)) return "unknown";
  if (change > 0) return "up";
  if (change < 0) return "down";
  return "flat";
}
