"use client";
// STUB — replaced by the market-data foundation agent. Keeps the tree compiling.
import { createContext, useContext, type ReactNode } from "react";
import type { PairId, CurrencyCode } from "@/config/exchange";
import type { IndicativeRate, MarketQuote, MarketSnapshot, MarketStatus } from "@/lib/market/types";

export type MarketConnection = "connecting" | "live" | "reconnecting" | "polling" | "offline";

export interface MarketContextValue {
  snapshot: MarketSnapshot | null;
  connection: MarketConnection;
  status: MarketStatus;
  lastUpdatedAt: Date | null;
  isStale: boolean;
  refresh: () => void;
  getRate: (pairId: PairId) => IndicativeRate | undefined;
  getQuote: (base: CurrencyCode, quote: CurrencyCode) => MarketQuote | undefined;
}

const MarketContext = createContext<MarketContextValue | null>(null);

export function MarketProvider({ children }: { children: ReactNode }) {
  const value: MarketContextValue = {
    snapshot: null,
    connection: "connecting",
    status: "unavailable",
    lastUpdatedAt: null,
    isStale: false,
    refresh: () => {},
    getRate: () => undefined,
    getQuote: () => undefined,
  };
  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket(): MarketContextValue {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error("useMarket must be used within <MarketProvider>");
  return ctx;
}
