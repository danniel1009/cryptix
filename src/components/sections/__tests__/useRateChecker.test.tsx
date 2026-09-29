import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketContextValue } from "@/providers/MarketProvider";
import type { IndicativeRate, MarketQuote, MarketSnapshot } from "@/lib/market/types";

const site = vi.hoisted(() => ({
  name: "Cryptix",
  url: "http://localhost:3000",
  whatsappNumber: "6281234567890",
  contactEmail: "",
  defaultLocale: "en" as const,
  copyrightYear: 2026,
  nav: [],
}));
vi.mock("@/config/site", () => ({
  siteConfig: site,
  NAV_ITEMS: [],
  normalizeWhatsAppNumber: (raw: string) => raw.replace(/[^\d]/g, ""),
}));

const market = vi.hoisted(() => ({ current: null as unknown as MarketContextValue }));
vi.mock("@/providers/MarketProvider", () => ({
  useMarket: () => market.current,
  MarketProvider: ({ children }: { children: ReactNode }) => children,
}));

import {
  buildPrefill,
  connectionNoteFor,
  defaultAmountFor,
  getAmountHint,
  indicatorState,
  QUICK_AMOUNTS,
  readPairFromSearch,
  resolveReceivable,
  roundToDecimals,
  SELECT_PAIR_EVENT,
  useRateChecker,
} from "@/components/sections/rate-checker/useRateChecker";
import { AMOUNT_LIMITS, CURRENCIES, SUPPORTED_PAIRS, findReversePair, getPairById } from "@/config/exchange";
import { I18nProvider } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/types";
import { calculateReceive, computeIndicativeRates } from "@/lib/market/rates";

const UPDATED_AT = "2026-09-29T08:00:00.000Z";
const QUOTES: MarketQuote[] = [
  { base: "BTC", quote: "USDT", price: 100_000, change24hPct: 2.41, updatedAt: UPDATED_AT, source: "binance" },
  { base: "ETH", quote: "BTC", price: 0.03, change24hPct: null, updatedAt: UPDATED_AT, source: "binance" },
  { base: "SOL", quote: "BTC", price: 0.00172, change24hPct: 1.1, updatedAt: UPDATED_AT, source: "binance" },
  { base: "USDT", quote: "IDR", price: 16_485, change24hPct: 0.05, updatedAt: UPDATED_AT, source: "indodax" },
];
const RATES: IndicativeRate[] = computeIndicativeRates(QUOTES, 0.05);
const SNAPSHOT: MarketSnapshot = {
  status: "live",
  generatedAt: UPDATED_AT,
  updatedAt: UPDATED_AT,
  spread: 0.05,
  quotes: QUOTES,
  rates: RATES,
  sources: ["binance", "indodax"],
  error: null,
};

const rateFor = (pairId: string) => RATES.find((r) => r.pairId === pairId)!;

function setMarket(overrides: Partial<MarketContextValue> = {}) {
  market.current = {
    snapshot: SNAPSHOT,
    connection: "live",
    status: "live",
    lastUpdatedAt: new Date(UPDATED_AT),
    isStale: false,
    refresh: vi.fn(),
    getRate: (pairId) => RATES.find((r) => r.pairId === pairId),
    getQuote: () => undefined,
    ...overrides,
  };
}

function renderChecker(locale: Locale = "en") {
  return renderHook(() => useRateChecker(), {
    wrapper: ({ children }) => <I18nProvider initialLocale={locale}>{children}</I18nProvider>,
  });
}

beforeEach(() => {
  site.whatsappNumber = "6281234567890";
  setMarket();
  window.history.replaceState(null, "", "/");
});

describe("pure helpers", () => {
  it("defaultAmountFor: a sensible starting amount per sent currency", () => {
    expect(defaultAmountFor("USDT")).toBe(1000);
    expect(defaultAmountFor("ETH")).toBe(0.5);
    expect(defaultAmountFor("SOL")).toBe(10);
    expect(defaultAmountFor("BTC")).toBe(0.01);
    expect(defaultAmountFor("IDR")).toBe(1_000_000);
  });

  it("resolveReceivable keeps a valid preference and otherwise picks the first supported target", () => {
    expect(resolveReceivable("USDT", "IDR")).toBe("IDR");
    expect(resolveReceivable("USDT", "BTC")).toBe("BTC");
    expect(resolveReceivable("USDT")).toBe("BTC");
    expect(resolveReceivable("SOL", "IDR")).toBe("BTC");
    expect(resolveReceivable("ETH", "USDT")).toBe("BTC");
    // Reverse directions.
    expect(resolveReceivable("BTC")).toBe("USDT");
    expect(resolveReceivable("BTC", "ETH")).toBe("ETH");
    expect(resolveReceivable("BTC", "IDR")).toBe("USDT");
    expect(resolveReceivable("IDR")).toBe("USDT");
  });

  it("roundToDecimals rounds to the currency's input decimals", () => {
    expect(roundToDecimals(1000 / 105_000, CURRENCIES.BTC.inputDecimals)).toBe(0.00952381);
    expect(roundToDecimals(907.0295238, CURRENCIES.USDT.inputDecimals)).toBe(907.03);
    expect(roundToDecimals(16_484.6, CURRENCIES.IDR.inputDecimals)).toBe(16_485);
    expect(roundToDecimals(1.23456789, 4)).toBe(1.2346);
    expect(roundToDecimals(NaN, 2)).toBeNaN();
    expect(roundToDecimals(Infinity, 2)).toBeNaN();
  });

  it("every quick amount is a sendable currency with limits-respecting values", () => {
    for (const [code, amounts] of Object.entries(QUICK_AMOUNTS)) {
      expect(SUPPORTED_PAIRS.some((p) => p.from === code)).toBe(true);
      const limits = AMOUNT_LIMITS[code as keyof typeof AMOUNT_LIMITS];
      for (const n of amounts ?? []) {
        expect(n).toBeGreaterThanOrEqual(limits.min);
        expect(n).toBeLessThanOrEqual(limits.max);
      }
    }
  });

  it("getAmountHint: empty → empty, junk → invalid, below/above limits → advisory, otherwise null", () => {
    expect(getAmountHint("", NaN, "USDT")).toEqual({ kind: "empty" });
    expect(getAmountHint("   ", NaN, "USDT")).toEqual({ kind: "empty" });
    expect(getAmountHint("abc", NaN, "USDT")).toEqual({ kind: "invalid" });
    expect(getAmountHint("0", 0, "USDT")).toEqual({ kind: "invalid" });
    expect(getAmountHint(null, NaN, "USDT")).toEqual({ kind: "invalid" });
    expect(getAmountHint("5", 5, "USDT")).toEqual({ kind: "min", limit: AMOUNT_LIMITS.USDT.min });
    expect(getAmountHint(null, 20_000_000, "USDT")).toEqual({ kind: "max", limit: AMOUNT_LIMITS.USDT.max });
    expect(getAmountHint(null, 1000, "USDT")).toBeNull();
    expect(getAmountHint("0.05", 0.05, "ETH")).toBeNull();
  });

  it("indicatorState follows status first, then connection", () => {
    expect(indicatorState("unavailable", "live")).toBe("unavailable");
    expect(indicatorState("stale", "live")).toBe("stale");
    expect(indicatorState("live", "live")).toBe("live");
    expect(indicatorState("live", "connecting")).toBe("live");
    expect(indicatorState("live", "reconnecting")).toBe("reconnecting");
    expect(indicatorState("live", "polling")).toBe("reconnecting");
    expect(indicatorState("live", "offline")).toBe("reconnecting");
  });

  it("connectionNoteFor only reports degraded transports", () => {
    expect(connectionNoteFor("live")).toBeNull();
    expect(connectionNoteFor("connecting")).toBeNull();
    expect(connectionNoteFor("polling")).toBe("polling");
    expect(connectionNoteFor("reconnecting")).toBe("reconnecting");
    expect(connectionNoteFor("offline")).toBe("offline");
  });

  it("readPairFromSearch guards with isPairId (reverse pairs are valid, unknown combinations are not)", () => {
    expect(readPairFromSearch("?pair=USDT_BTC")).toBe("USDT_BTC");
    expect(readPairFromSearch("?x=1&pair=USDT_IDR")).toBe("USDT_IDR");
    expect(readPairFromSearch("?pair=BTC_USDT")).toBe("BTC_USDT");
    expect(readPairFromSearch("?pair=ETH_SOL")).toBeNull();
    expect(readPairFromSearch("?pair=")).toBeNull();
    expect(readPairFromSearch("")).toBeNull();
  });

  it("buildPrefill omits the amount, estimate and rate snapshot when they are not available", () => {
    const pair = getPairById("USDT_BTC")!;
    expect(buildPrefill(pair, 1000, 0.0095)).toEqual({ pairId: "USDT_BTC", amount: 1000, estimatedReceive: 0.0095 });
    expect(buildPrefill(pair, 1000, null)).toEqual({ pairId: "USDT_BTC", amount: 1000 });
    expect(buildPrefill(pair, NaN, null)).toEqual({ pairId: "USDT_BTC" });
    expect(buildPrefill(pair, 0, 0)).toEqual({ pairId: "USDT_BTC" });
    expect(buildPrefill(pair, 1000, 0.0095, rateFor("USDT_BTC"), "2026-09-29T08:00:05.000Z")).toEqual({
      pairId: "USDT_BTC",
      amount: 1000,
      estimatedReceive: 0.0095,
      rateSnapshot: {
        marketPriceDisplay: 100_000,
        ourPriceDisplay: 105_000,
        quoteBase: "BTC",
        quoteCurrency: "USDT",
        spread: 0.05,
        capturedAt: "2026-09-29T08:00:05.000Z",
      },
    });
    // Default capturedAt is a parseable ISO timestamp.
    const stamped = buildPrefill(pair, 1000, null, rateFor("USDT_BTC"));
    expect(Number.isNaN(Date.parse(stamped.rateSnapshot?.capturedAt ?? ""))).toBe(false);
  });
});

describe("useRateChecker", () => {
  it("starts on the default pair with 1,000 USDT, a live estimate and the rate snapshot in the prefill", () => {
    const { result } = renderChecker();
    const rc = result.current;
    expect(rc.pair.id).toBe("USDT_BTC");
    expect(rc.from).toBe("USDT");
    expect(rc.to).toBe("BTC");
    expect(rc.amount).toBe(1000);
    expect(rc.amountText).toBe("1,000.00");
    expect(rc.amountValid).toBe(true);
    expect(rc.hint).toBeNull();
    expect(rc.rateAvailable).toBe(true);
    expect(rc.estimatedReceive).toBeCloseTo(1000 / 105_000, 12);
    expect(rc.spread).toBe(0.05);
    expect(rc.indicator).toBe("live");
    expect(rc.connectionNote).toBeNull();
    expect(rc.canSwap).toBe(true);
    expect(rc.quickAmounts).toEqual([100, 500, 1000, 5000]);
    expect(rc.sendable).toEqual(["USDT", "SOL", "ETH", "BTC", "IDR"]);
    expect(rc.receivable).toEqual(["BTC", "IDR"]);
    expect(rc.prefill).toEqual({
      pairId: "USDT_BTC",
      amount: 1000,
      estimatedReceive: rc.estimatedReceive,
      rateSnapshot: {
        marketPriceDisplay: 100_000,
        ourPriceDisplay: 105_000,
        quoteBase: "BTC",
        quoteCurrency: "USDT",
        spread: 0.05,
        capturedAt: expect.any(String),
      },
    });
    const fresh = rc.getPrefill();
    expect(fresh).toEqual({ ...rc.prefill, rateSnapshot: { ...rc.prefill.rateSnapshot, capturedAt: expect.any(String) } });
    expect(Number.isNaN(Date.parse(fresh.rateSnapshot?.capturedAt ?? ""))).toBe(false);
  });

  it("formats the default amount in the active locale", () => {
    const { result } = renderChecker("id");
    expect(result.current.amountText).toBe("1.000,00");
  });

  it("changing the sent currency keeps a still-valid target, else picks the first, and resets an untouched amount", () => {
    const { result } = renderChecker();
    act(() => result.current.setFrom("SOL"));
    expect(result.current.from).toBe("SOL");
    expect(result.current.to).toBe("BTC");
    expect(result.current.pair.id).toBe("SOL_BTC");
    expect(result.current.amount).toBe(10);
    expect(result.current.amountText).toBe("10.0000");
    expect(result.current.quickAmounts).toEqual([1, 5, 10, 50]);
    expect(result.current.receivable).toEqual(["BTC"]);
    expect(result.current.estimatedReceive).toBeCloseTo(calculateReceive(rateFor("SOL_BTC"), 10), 15);
    // BTC is sendable (reverse pairs): BTC → BTC is impossible, so the first receivable (USDT) is chosen.
    act(() => result.current.setFrom("BTC"));
    expect(result.current.from).toBe("BTC");
    expect(result.current.to).toBe("USDT");
    expect(result.current.pair.id).toBe("BTC_USDT");
    expect(result.current.receivable).toEqual(["USDT", "SOL", "ETH"]);
    expect(result.current.quickAmounts).toEqual([]);
    // IDR → only USDT.
    act(() => result.current.setFrom("IDR"));
    expect(result.current.pair.id).toBe("IDR_USDT");
    expect(result.current.receivable).toEqual(["USDT"]);
    // USDT again: the current target (USDT) is not receivable for USDT → first (BTC).
    act(() => result.current.setFrom("USDT"));
    expect(result.current.pair.id).toBe("USDT_BTC");
  });

  it("keeps a typed amount across currency changes and formats it on commit", () => {
    const { result } = renderChecker();
    act(() => result.current.setAmountText("250"));
    expect(result.current.amountText).toBe("250");
    expect(result.current.amount).toBe(250);
    act(() => result.current.commitAmount());
    expect(result.current.amountText).toBe("250.00");
    act(() => result.current.setFrom("ETH"));
    expect(result.current.amount).toBe(250);
    expect(result.current.amountText).toBe("250.000000");
    expect(result.current.pair.id).toBe("ETH_BTC");
  });

  it("keeps an invalid draft on commit so the visitor can see and fix it", () => {
    const { result } = renderChecker();
    act(() => result.current.setAmountText("12abc"));
    expect(result.current.amountValid).toBe(false);
    expect(result.current.hint).toEqual({ kind: "invalid" });
    expect(result.current.estimatedReceive).toBeNull();
    expect(result.current.prefill).toEqual({ pairId: "USDT_BTC", rateSnapshot: expect.any(Object) });
    act(() => result.current.commitAmount());
    expect(result.current.amountText).toBe("12abc");
    act(() => result.current.setAmountText(""));
    expect(result.current.hint).toEqual({ kind: "empty" });
    expect(result.current.amountText).toBe("");
  });

  it("accepts both decimal conventions", () => {
    const { result } = renderChecker();
    act(() => result.current.setAmountText("1.000,5"));
    expect(result.current.amount).toBe(1000.5);
    act(() => result.current.setAmountText("1,000.5"));
    expect(result.current.amount).toBe(1000.5);
  });

  it("only allows supported targets for the received currency and keeps the sent currency", () => {
    const { result } = renderChecker();
    act(() => result.current.setTo("IDR"));
    expect(result.current.pair.id).toBe("USDT_IDR");
    expect(result.current.from).toBe("USDT");
    expect(result.current.estimatedReceive).toBeCloseTo((1000 * 16_485) / 1.05, 6);
    act(() => result.current.setTo("SOL"));
    expect(result.current.to).toBe("IDR");
    act(() => result.current.setFrom("ETH"));
    expect(result.current.to).toBe("BTC");
  });

  describe("swap", () => {
    it("reverses the direction and carries the previous estimate (rounded to the new input decimals) as the amount", () => {
      const { result } = renderChecker();
      const previousEstimate = result.current.estimatedReceive!;
      act(() => result.current.swap());
      expect(result.current.pair.id).toBe("BTC_USDT");
      expect(result.current.from).toBe("BTC");
      expect(result.current.to).toBe("USDT");
      expect(result.current.amount).toBe(roundToDecimals(previousEstimate, CURRENCIES.BTC.inputDecimals));
      expect(result.current.amount).toBe(0.00952381);
      expect(result.current.amountText).toBe("0.00952381");
      expect(result.current.hint).toBeNull();
      expect(result.current.estimatedReceive).toBeCloseTo((0.00952381 * 100_000) / 1.05, 9);
      expect(result.current.estimatedReceive).toBeCloseTo(calculateReceive(rateFor("BTC_USDT"), 0.00952381), 12);
      expect(result.current.canSwap).toBe(true);
      expect(result.current.prefill.pairId).toBe("BTC_USDT");
      expect(result.current.prefill.rateSnapshot?.ourPriceDisplay).toBeCloseTo(100_000 / 1.05, 6);

      // Back again: 907.029… USDT rounds to 2 decimals.
      act(() => result.current.swap());
      expect(result.current.pair.id).toBe("USDT_BTC");
      expect(result.current.amount).toBe(907.03);
      expect(result.current.amountText).toBe("907.03");
      expect(result.current.estimatedReceive).toBeCloseTo(907.03 / 105_000, 12);
    });

    it("keeps the amount when there is no estimate (unavailable market) or when the estimate would round to zero", () => {
      setMarket({ snapshot: null, status: "unavailable", connection: "polling", lastUpdatedAt: null, getRate: () => undefined });
      const { result } = renderChecker();
      expect(result.current.estimatedReceive).toBeNull();
      act(() => result.current.swap());
      expect(result.current.pair.id).toBe("BTC_USDT");
      expect(result.current.amount).toBe(1000);
      act(() => result.current.swap());
      expect(result.current.pair.id).toBe("USDT_BTC");
      expect(result.current.amount).toBe(1000);

      setMarket();
      const { result: tiny } = renderChecker();
      act(() => tiny.current.setAmountText("0.0000001"));
      expect(tiny.current.estimatedReceive).toBeGreaterThan(0);
      expect(roundToDecimals(tiny.current.estimatedReceive!, CURRENCIES.BTC.inputDecimals)).toBe(0);
      act(() => tiny.current.swap());
      expect(tiny.current.pair.id).toBe("BTC_USDT");
      expect(tiny.current.amount).toBe(0.0000001);
    });

    it("marks the amount as chosen so a later currency change does not reset it", () => {
      const { result } = renderChecker();
      act(() => result.current.swap());
      expect(result.current.amount).toBe(0.00952381);
      act(() => result.current.setFrom("ETH"));
      expect(result.current.pair.id).toBe("ETH_BTC");
      expect(result.current.amount).toBe(0.00952381);
    });

    it("canSwap is true for every supported pair and swap lands on its reverse", () => {
      const { result } = renderChecker();
      for (const pair of SUPPORTED_PAIRS) {
        act(() => result.current.selectPair(pair.id));
        expect(result.current.pair.id).toBe(pair.id);
        expect(result.current.canSwap).toBe(true);
        act(() => result.current.swap());
        expect(result.current.pair.id).toBe(findReversePair(pair)!.id);
      }
    });
  });

  it("selectPair and the window event switch the pair (reverse pairs included); quick amounts mark the amount touched", () => {
    const { result } = renderChecker();
    act(() => result.current.selectPair("USDT_IDR"));
    expect(result.current.pair.id).toBe("USDT_IDR");
    act(() => {
      window.dispatchEvent(new CustomEvent(SELECT_PAIR_EVENT, { detail: { pairId: "BTC_USDT" } }));
    });
    expect(result.current.pair.id).toBe("BTC_USDT");
    expect(result.current.amount).toBe(0.01);
    act(() => {
      window.dispatchEvent(new CustomEvent(SELECT_PAIR_EVENT, { detail: { pairId: "ETH_SOL" } }));
    });
    expect(result.current.pair.id).toBe("BTC_USDT");
    act(() => {
      window.dispatchEvent(new CustomEvent(SELECT_PAIR_EVENT, { detail: { pairId: "ETH_BTC" } }));
    });
    expect(result.current.pair.id).toBe("ETH_BTC");
    act(() => result.current.setQuickAmount(5));
    expect(result.current.amount).toBe(5);
    expect(result.current.amountText).toBe("5.000000");
    act(() => result.current.selectPair("USDT_BTC"));
    expect(result.current.amount).toBe(5); // touched → preserved
  });

  it("reads ?pair= on mount", () => {
    window.history.replaceState(null, "", "/?pair=SOL_BTC");
    const { result } = renderChecker();
    expect(result.current.pair.id).toBe("SOL_BTC");
  });

  it("re-derives the estimate and prefill from the market context (new snapshot / spread) without caching", () => {
    const { result, rerender } = renderChecker();
    expect(result.current.estimatedReceive).toBeCloseTo(1000 / 105_000, 12);
    const rates3 = computeIndicativeRates(QUOTES, 0.03);
    setMarket({ snapshot: { ...SNAPSHOT, spread: 0.03, rates: rates3 }, getRate: (pairId) => rates3.find((r) => r.pairId === pairId) });
    rerender();
    expect(result.current.spread).toBe(0.03);
    expect(result.current.estimatedReceive).toBeCloseTo(1000 / 103_000, 12);
    expect(result.current.prefill.rateSnapshot).toMatchObject({ ourPriceDisplay: 103_000, spread: 0.03 });

    const movedQuotes = QUOTES.map((q) => (q.base === "BTC" ? { ...q, price: 110_000 } : q));
    const movedRates = computeIndicativeRates(movedQuotes, 0.03);
    setMarket({ snapshot: { ...SNAPSHOT, spread: 0.03, quotes: movedQuotes, rates: movedRates }, getRate: (pairId) => movedRates.find((r) => r.pairId === pairId) });
    rerender();
    expect(result.current.estimatedReceive).toBeCloseTo(1000 / 113_300, 12);
    expect(result.current.prefill.rateSnapshot).toMatchObject({ marketPriceDisplay: 110_000, ourPriceDisplay: 113_300 });
  });

  it("unavailable market: no estimate, prefill without estimate or rate snapshot, WhatsApp message without the estimate line", () => {
    setMarket({ snapshot: null, status: "unavailable", connection: "polling", lastUpdatedAt: null, getRate: () => undefined });
    const { result } = renderChecker();
    expect(result.current.loading).toBe(false);
    expect(result.current.rateAvailable).toBe(false);
    expect(result.current.rate).toBeUndefined();
    expect(result.current.estimatedReceive).toBeNull();
    expect(result.current.spread).toBe(0.05);
    expect(result.current.indicator).toBe("unavailable");
    expect(result.current.prefill).toEqual({ pairId: "USDT_BTC", amount: 1000 });
    expect(result.current.getPrefill()).toEqual({ pairId: "USDT_BTC", amount: 1000 });
    const message = decodeURIComponent(result.current.whatsappHref.split("?text=")[1]);
    expect(message).toContain("USDT → BTC");
    expect(message).toContain("1,000 USDT");
    expect(message).not.toContain("Estimated Receive");
  });

  it("is loading only before the first snapshot while still connecting", () => {
    setMarket({ snapshot: null, status: "unavailable", connection: "connecting", lastUpdatedAt: null, getRate: () => undefined });
    expect(renderChecker().result.current.loading).toBe(true);
    setMarket({ connection: "connecting" });
    expect(renderChecker().result.current.loading).toBe(false);
  });

  it("stale / degraded connection are exposed for the UI", () => {
    setMarket({ status: "stale", isStale: true, connection: "polling" });
    const { result } = renderChecker();
    expect(result.current.rateAvailable).toBe(true);
    expect(result.current.indicator).toBe("stale");
    expect(result.current.connectionNote).toBe("polling");
    // Stale data is still shown, so the prefill still carries the rate snapshot.
    expect(result.current.prefill.rateSnapshot).toBeDefined();
  });

  it("WhatsApp: exchange inquiry with estimate when valid, general inquiry when the amount is invalid, #contact when unconfigured", () => {
    const { result } = renderChecker();
    expect(result.current.whatsappConfigured).toBe(true);
    let message = decodeURIComponent(result.current.whatsappHref.split("?text=")[1]);
    expect(message).toContain("Pair: USDT → BTC");
    expect(message).toContain("Estimated Receive: 0.00952381 BTC");

    act(() => result.current.setAmountText("x"));
    message = decodeURIComponent(result.current.whatsappHref.split("?text=")[1]);
    expect(message).toContain("Hello Cryptix");
    expect(message).not.toContain("Pair:");

    site.whatsappNumber = "";
    const { result: unconfigured } = renderChecker();
    expect(unconfigured.current.whatsappConfigured).toBe(false);
    expect(unconfigured.current.whatsappHref).toBe("#contact");
  });
});
