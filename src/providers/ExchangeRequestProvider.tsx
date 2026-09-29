"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { PairId } from "@/config/exchange";

/**
 * Values carried from the rate checker into the exchange request form.
 * All optional: the form can also be opened empty (e.g. from the navbar).
 */
export interface ExchangeRequestPrefill {
  pairId?: PairId;
  /** Amount in the SENT currency, as a number (not formatted). */
  amount?: number;
  /** Estimated receive in the RECEIVED currency, as a number. */
  estimatedReceive?: number;
}

interface ExchangeRequestContextValue {
  isOpen: boolean;
  prefill: ExchangeRequestPrefill | null;
  /** Open the exchange request modal, optionally pre-populated. */
  open: (prefill?: ExchangeRequestPrefill) => void;
  close: () => void;
}

const ExchangeRequestContext = createContext<ExchangeRequestContextValue | null>(null);

export function ExchangeRequestProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [prefill, setPrefill] = useState<ExchangeRequestPrefill | null>(null);

  const open = useCallback((next?: ExchangeRequestPrefill) => {
    setPrefill(next ?? null);
    setIsOpen(true);
  }, []);
  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo(() => ({ isOpen, prefill, open, close }), [isOpen, prefill, open, close]);
  return <ExchangeRequestContext.Provider value={value}>{children}</ExchangeRequestContext.Provider>;
}

export function useExchangeRequest(): ExchangeRequestContextValue {
  const ctx = useContext(ExchangeRequestContext);
  if (!ctx) throw new Error("useExchangeRequest must be used within <ExchangeRequestProvider>");
  return ctx;
}
