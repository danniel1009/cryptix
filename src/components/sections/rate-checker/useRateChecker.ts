"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LiveIndicatorState } from "@/components/ui/LiveIndicator";
import {
  AMOUNT_LIMITS,
  CURRENCIES,
  DEFAULT_EXCHANGE_SPREAD,
  DEFAULT_PAIR_ID,
  findPair,
  findReversePair,
  getPairById,
  getReceivableCurrencies,
  getSendableCurrencies,
  isPairId,
  type CurrencyCode,
  type ExchangePair,
  type PairId,
} from "@/config/exchange";
import { parseAmountInput } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";
import { calculateReceive } from "@/lib/market/rates";
import type { IndicativeRate, MarketSnapshot, MarketStatus } from "@/lib/market/types";
import {
  buildExchangeInquiryMessage,
  buildGeneralInquiryMessage,
  buildWhatsAppUrl,
  isWhatsAppConfigured,
} from "@/lib/whatsapp";
import type { ExchangeRequestPrefill } from "@/providers/ExchangeRequestProvider";
import { useMarket, type MarketConnection } from "@/providers/MarketProvider";

/**
 * All converter logic (selection, swap, amount parsing/formatting, estimate,
 * market states, cross-section events) lives here so the components in this
 * folder stay presentational. The pure helpers are exported for unit tests.
 *
 * The estimate is DERIVED on every render from `useMarket().getRate(pair.id)`,
 * so it follows amount, sent/received currency, market snapshot and spread
 * changes without any caching layer of its own.
 */

/** Cross-section contract: `new CustomEvent(SELECT_PAIR_EVENT, { detail: { pairId } })`. */
export const SELECT_PAIR_EVENT = "cryptix:select-pair";
/** `?pair=USDT_BTC` preselects a pair on first load. */
export const PAIR_SEARCH_PARAM = "pair";

/** Quick-amount presets per SENT currency (data only; the converter card keeps its panels clean). */
export const QUICK_AMOUNTS: Partial<Record<CurrencyCode, readonly number[]>> = {
  USDT: [100, 500, 1_000, 5_000],
  ETH: [0.1, 0.5, 1, 5],
  SOL: [1, 5, 10, 50],
};

/** The panel is never empty on first paint: 1,000 USDT, or 1 unit of any other coin. */
export function defaultAmountFor(from: CurrencyCode): number {
  return from === "USDT" ? 1_000 : 1;
}

/** The currency to receive for `from`: keep `preferred` when valid, else the first supported one. */
export function resolveReceivable(from: CurrencyCode, preferred?: CurrencyCode): CurrencyCode {
  const options = getReceivableCurrencies(from);
  if (preferred && options.includes(preferred)) return preferred;
  return options[0] ?? from;
}

export function isValidAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0;
}

/** Round to at most `decimals` fraction digits (what an amount input for that currency may hold). */
export function roundToDecimals(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return NaN;
  const d = Math.max(0, Math.min(100, Math.trunc(decimals)));
  return Number(value.toFixed(d));
}

export type AmountHint =
  | { kind: "empty" }
  | { kind: "invalid" }
  | { kind: "min"; limit: number }
  | { kind: "max"; limit: number }
  | null;

/**
 * Advisory hint for the amount field. `draft` is the text currently in the
 * input (null when the formatted stored amount is shown). Limits never block
 * the request — the team confirms final terms.
 */
export function getAmountHint(draft: string | null, amount: number, from: CurrencyCode): AmountHint {
  if (draft !== null && draft.trim() === "") return { kind: "empty" };
  if (!isValidAmount(amount)) return { kind: "invalid" };
  const limits = AMOUNT_LIMITS[from];
  if (amount < limits.min) return { kind: "min", limit: limits.min };
  if (amount > limits.max) return { kind: "max", limit: limits.max };
  return null;
}

/**
 * docs/ARCHITECTURE.md UI rule: `status` decides whether data may be called
 * live; a degraded `connection` with fresh data is still live data, flagged as
 * reconnecting on the indicator.
 */
export function indicatorState(status: MarketStatus, connection: MarketConnection): LiveIndicatorState {
  if (status === "unavailable") return "unavailable";
  if (status === "stale") return "stale";
  if (connection === "reconnecting" || connection === "polling" || connection === "offline") return "reconnecting";
  return "live";
}

export type ConnectionNote = "polling" | "reconnecting" | "offline" | null;

export function connectionNoteFor(connection: MarketConnection): ConnectionNote {
  if (connection === "polling" || connection === "reconnecting" || connection === "offline") return connection;
  return null;
}

/** `?pair=<PairId>` from a search string; null when absent or not a supported pair. */
export function readPairFromSearch(search: string): PairId | null {
  try {
    const value = new URLSearchParams(search).get(PAIR_SEARCH_PARAM);
    return isPairId(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Modal prefill: the pair always, the amount only when valid, the estimate only
 * when known, and the indicative rate the customer saw (`rateSnapshot`) only
 * when a rate is available. `capturedAt` defaults to now.
 */
export function buildPrefill(
  pair: ExchangePair,
  amount: number,
  estimatedReceive: number | null,
  rate?: IndicativeRate,
  capturedAt: string = new Date().toISOString(),
): ExchangeRequestPrefill {
  const prefill: ExchangeRequestPrefill = { pairId: pair.id };
  if (isValidAmount(amount)) prefill.amount = amount;
  if (estimatedReceive !== null && isValidAmount(estimatedReceive)) prefill.estimatedReceive = estimatedReceive;
  if (rate) {
    prefill.rateSnapshot = {
      marketPriceDisplay: rate.marketPriceDisplay,
      ourPriceDisplay: rate.ourPriceDisplay,
      quoteBase: rate.quoteBase,
      quoteCurrency: rate.quoteCurrency,
      spread: rate.spread,
      capturedAt,
    };
  }
  return prefill;
}

interface CheckerState {
  from: CurrencyCode;
  to: CurrencyCode;
  /** Parsed amount in the SENT currency (NaN while the draft is invalid). */
  amount: number;
  /** Raw text while the user types; null = show the formatted `amount`. */
  draft: string | null;
  /** Once the visitor has typed or picked an amount we stop resetting it on currency changes. */
  touched: boolean;
}

function initialState(): CheckerState {
  const pair = getPairById(DEFAULT_PAIR_ID) ?? { from: "USDT" as CurrencyCode, to: "BTC" as CurrencyCode };
  return { from: pair.from, to: pair.to, amount: defaultAmountFor(pair.from), draft: null, touched: false };
}

function withPair(state: CheckerState, from: CurrencyCode, to: CurrencyCode): CheckerState {
  if (from === state.from && to === state.to) return state;
  const next: CheckerState = { ...state, from, to };
  if (!state.touched && from !== state.from) {
    next.amount = defaultAmountFor(from);
    next.draft = null;
  }
  return next;
}

export interface RateCheckerState {
  // selection
  from: CurrencyCode;
  to: CurrencyCode;
  pair: ExchangePair;
  /** Every currency that is the `from` of some supported pair. */
  sendable: CurrencyCode[];
  /** Currencies receivable for the current `from`, featured pairs first. */
  receivable: CurrencyCode[];
  /** Change the sent currency; keeps `to` when still supported, else the first receivable one. */
  setFrom: (code: CurrencyCode) => void;
  /** Change the received currency (ignored unless supported for `from`). */
  setTo: (code: CurrencyCode) => void;
  selectPair: (pairId: PairId) => void;
  /**
   * Swap the direction when the reverse pair exists: the previous estimate
   * (rounded to the new sent currency's input decimals) becomes the new amount;
   * without an estimate the amount is kept.
   */
  swap: () => void;
  /** False only when `findReversePair(pair)` is undefined. */
  canSwap: boolean;
  // amount
  amount: number;
  amountValid: boolean;
  /** Text to show in the input (raw draft while typing, formatted otherwise). */
  amountText: string;
  setAmountText: (text: string) => void;
  /** Blur: replace a valid draft with its formatted form. */
  commitAmount: () => void;
  setQuickAmount: (amount: number) => void;
  quickAmounts: readonly number[];
  hint: AmountHint;
  // market
  rate: IndicativeRate | undefined;
  /** True before the first snapshot has arrived (never flash "unavailable" on first paint). */
  loading: boolean;
  /** True when the rate may be shown and used for an estimate. */
  rateAvailable: boolean;
  estimatedReceive: number | null;
  spread: number;
  status: MarketStatus;
  connection: MarketConnection;
  lastUpdatedAt: Date | null;
  snapshot: MarketSnapshot | null;
  indicator: LiveIndicatorState;
  connectionNote: ConnectionNote;
  refresh: () => void;
  // actions
  /** Current prefill (memoised; `rateSnapshot.capturedAt` = when it was derived). */
  prefill: ExchangeRequestPrefill;
  /** Same content, stamped with `capturedAt = now` — call this at click time. */
  getPrefill: () => ExchangeRequestPrefill;
  whatsappConfigured: boolean;
  whatsappHref: string;
}

export function useRateChecker(): RateCheckerState {
  const market = useMarket();
  const { locale, formatAmount } = useI18n();
  const [state, setState] = useState<CheckerState>(initialState);

  const setFrom = useCallback((code: CurrencyCode) => {
    setState((s) => {
      if (!getSendableCurrencies().includes(code)) return s;
      return withPair(s, code, resolveReceivable(code, s.to));
    });
  }, []);

  const setTo = useCallback((code: CurrencyCode) => {
    setState((s) => (getReceivableCurrencies(s.from).includes(code) ? withPair(s, s.from, code) : s));
  }, []);

  const selectPair = useCallback((pairId: PairId) => {
    setState((s) => {
      const pair = getPairById(pairId);
      return pair ? withPair(s, pair.from, pair.to) : s;
    });
  }, []);

  const setAmountText = useCallback(
    (text: string) => {
      setState((s) => ({ ...s, draft: text, amount: parseAmountInput(text, locale), touched: true }));
    },
    [locale],
  );

  const commitAmount = useCallback(() => {
    setState((s) => (s.draft !== null && isValidAmount(s.amount) ? { ...s, draft: null } : s));
  }, []);

  const setQuickAmount = useCallback((amount: number) => {
    setState((s) => ({ ...s, amount, draft: null, touched: true }));
  }, []);

  // Cross-section selection (SupportedPairs → "Check rate") and the URL parameter.
  // Both arrive through the same window event so the URL is just another sender.
  useEffect(() => {
    const onSelect = (event: Event) => {
      const detail = (event as CustomEvent<{ pairId?: unknown }>).detail;
      if (detail && isPairId(detail.pairId)) selectPair(detail.pairId);
    };
    window.addEventListener(SELECT_PAIR_EVENT, onSelect);
    const initial = readPairFromSearch(window.location.search);
    if (initial) window.dispatchEvent(new CustomEvent(SELECT_PAIR_EVENT, { detail: { pairId: initial } }));
    return () => window.removeEventListener(SELECT_PAIR_EVENT, onSelect);
  }, [selectPair]);

  const { from, to, amount, draft } = state;
  const pair = useMemo<ExchangePair>(
    () => findPair(from, to) ?? findPair(from, resolveReceivable(from)) ?? (getPairById(DEFAULT_PAIR_ID) as ExchangePair),
    [from, to],
  );
  const sendable = useMemo(() => getSendableCurrencies(), []);
  const receivable = useMemo(() => getReceivableCurrencies(from), [from]);
  const canSwap = findReversePair(pair) !== undefined;

  // Derived from the market context on every render — never cached here.
  const rate = market.getRate(pair.id);
  const loading = market.snapshot === null && market.connection === "connecting";
  const rateAvailable = market.status !== "unavailable" && rate !== undefined;
  const amountValid = isValidAmount(amount);
  const estimatedReceive = rateAvailable && amountValid && rate ? calculateReceive(rate, amount) : null;
  const spread = market.snapshot?.spread ?? DEFAULT_EXCHANGE_SPREAD;

  const swap = useCallback(() => {
    setState((s) => {
      const current = findPair(s.from, s.to);
      const reverse = current ? findReversePair(current) : undefined;
      if (!reverse) return s;
      const next: CheckerState = { ...s, from: reverse.from, to: reverse.to };
      if (estimatedReceive !== null) {
        // Carry EXACTLY the value the customer saw in the "To" panel (same
        // formatting, then parsed back), never a more precise or rounded-up number.
        const shown = parseAmountInput(formatAmount(estimatedReceive, s.to, { withSymbol: false }), locale);
        const carried = isValidAmount(shown) ? shown : roundToDecimals(estimatedReceive, CURRENCIES[reverse.from].inputDecimals);
        if (isValidAmount(carried)) {
          next.amount = carried;
          next.draft = null;
          next.touched = true;
        }
      }
      return next;
    });
  }, [estimatedReceive, formatAmount, locale]);

  const amountText = draft ?? (Number.isFinite(amount) ? formatAmount(amount, from, { withSymbol: false }) : "");
  const hint = getAmountHint(draft, amount, from);

  const shownRate = rateAvailable ? rate : undefined;
  const getPrefill = useCallback(
    () => buildPrefill(pair, amount, estimatedReceive, shownRate),
    [pair, amount, estimatedReceive, shownRate],
  );
  const prefill = useMemo(() => getPrefill(), [getPrefill]);

  const whatsappConfigured = isWhatsAppConfigured();
  const whatsappHref = useMemo(() => {
    if (!whatsappConfigured) return buildWhatsAppUrl();
    const message = amountValid
      ? buildExchangeInquiryMessage({ locale, pairId: pair.id, amount, estimatedReceive })
      : buildGeneralInquiryMessage(locale);
    return buildWhatsAppUrl(message);
  }, [whatsappConfigured, amountValid, locale, pair.id, amount, estimatedReceive]);

  return {
    from,
    to,
    pair,
    sendable,
    receivable,
    setFrom,
    setTo,
    selectPair,
    swap,
    canSwap,
    amount,
    amountValid,
    amountText,
    setAmountText,
    commitAmount,
    setQuickAmount,
    quickAmounts: QUICK_AMOUNTS[from] ?? [],
    hint,
    rate,
    loading,
    rateAvailable,
    estimatedReceive,
    spread,
    status: market.status,
    connection: market.connection,
    lastUpdatedAt: market.lastUpdatedAt,
    snapshot: market.snapshot,
    indicator: indicatorState(market.status, market.connection),
    connectionNote: connectionNoteFor(market.connection),
    refresh: market.refresh,
    prefill,
    getPrefill,
    whatsappConfigured,
    whatsappHref,
  };
}
