"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import type { CurrencyCode, PairId } from "@/config/exchange";
import { computeStatus } from "@/lib/market/rates";
import { useMarketFeed, type MarketConnection } from "@/hooks/useMarketFeed";
import { resolveMarketPrice } from "@/lib/market/rates";
import {
  pairKey,
  type IndicativeRate,
  type MarketQuote,
  type MarketSnapshot,
  type MarketStatus,
} from "@/lib/market/types";

/**
 * Client market context. Wraps `useMarketFeed` (fetch + SSE + polling fallback)
 * and exposes memoised lookups for the sections/rate checker.
 *
 * UI rule (docs/ARCHITECTURE.md): `status` — not `connection` — decides whether
 * prices may be shown as live. It is recomputed from the snapshot age on a
 * client clock, so it can never silently stay "live" when the server goes quiet.
 */

export type { MarketConnection };

export interface MarketContextValue {
  snapshot: MarketSnapshot | null;
  connection: MarketConnection;
  status: MarketStatus;
  lastUpdatedAt: Date | null;
  isStale: boolean;
  refresh: () => void;
  /** Ticking clock (ms) — re-renders consumers so "x minutes ago" and per-rate age stay current. */
  now?: number;
  getRate: (pairId: PairId) => IndicativeRate | undefined;
  /**
   * Status of ONE rate: the snapshot status, worsened by the age of that rate's own
   * quote (a retained pair from a dead provider goes stale/unavailable on its own).
   */
  getRateStatus?: (pairId: PairId) => MarketStatus;
  /**
   * Direct provider quote for base/quote; falls back to a derived quote
   * (inverse or bridged, `source` = contributing providers joined by "+").
   */
  getQuote: (base: CurrencyCode, quote: CurrencyCode) => MarketQuote | undefined;
}

const STATUS_RANK: Record<MarketStatus, number> = { live: 0, stale: 1, unavailable: 2 };
function worstStatus(a: MarketStatus, b: MarketStatus): MarketStatus {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

const MarketContext = createContext<MarketContextValue | null>(null);

export function MarketProvider({ children }: { children: ReactNode }) {
  const feed = useMarketFeed();
  const { snapshot } = feed;

  const rateMap = useMemo(() => {
    const map = new Map<PairId, IndicativeRate>();
    for (const rate of snapshot?.rates ?? []) map.set(rate.pairId, rate);
    return map;
  }, [snapshot]);

  const quoteLookup = useMemo(() => {
    const direct = new Map<string, MarketQuote>();
    for (const q of snapshot?.quotes ?? []) {
      const key = pairKey(q.base, q.quote);
      if (!direct.has(key)) direct.set(key, q);
    }
    const derived = new Map<string, MarketQuote | undefined>();
    return { direct, derived };
  }, [snapshot]);

  const getRate = useCallback((pairId: PairId) => rateMap.get(pairId), [rateMap]);
  const getRateStatus = useCallback(
    (pairId: PairId): MarketStatus => {
      const rate = rateMap.get(pairId);
      if (!rate) return "unavailable";
      const own = computeStatus(rate.updatedAt, feed.now);
      return worstStatus(feed.status, own);
    },
    [rateMap, feed.status, feed.now],
  );

  const getQuote = useCallback(
    (base: CurrencyCode, quote: CurrencyCode): MarketQuote | undefined => {
      const key = pairKey(base, quote);
      const direct = quoteLookup.direct.get(key);
      if (direct) return direct;
      if (!snapshot) return undefined;
      if (quoteLookup.derived.has(key)) return quoteLookup.derived.get(key);
      const resolved = resolveMarketPrice(base, quote, snapshot.quotes);
      const synthesized: MarketQuote | undefined = resolved
        ? {
            base,
            quote,
            price: resolved.price,
            change24hPct: resolved.change24hPct,
            updatedAt: resolved.updatedAt,
            source: resolved.sources.join("+") || "derived",
          }
        : undefined;
      quoteLookup.derived.set(key, synthesized);
      return synthesized;
    },
    [quoteLookup, snapshot],
  );

  const value = useMemo<MarketContextValue>(
    () => ({
      snapshot,
      connection: feed.connection,
      status: feed.status,
      lastUpdatedAt: feed.lastUpdatedAt,
      isStale: feed.isStale,
      refresh: feed.refresh,
      now: feed.now,
      getRate,
      getRateStatus,
      getQuote,
    }),
    [snapshot, feed.connection, feed.status, feed.lastUpdatedAt, feed.isStale, feed.refresh, feed.now, getRate, getRateStatus, getQuote],
  );

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket(): MarketContextValue {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error("useMarket must be used within <MarketProvider>");
  return ctx;
}
