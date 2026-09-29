import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SupportedPairs } from "@/components/sections/SupportedPairs";
import { SELECT_PAIR_EVENT, type SelectPairDetail } from "@/components/sections/supported-pairs/selectPairEvent";
import { DEFAULT_EXCHANGE_SPREAD, FEATURED_PAIRS, pairLabel } from "@/config/exchange";
import { interpolate } from "@/lib/i18n/dictionaries";
import { en } from "@/lib/i18n/dictionaries/en";
import { id } from "@/lib/i18n/dictionaries/id";
import { I18nProvider, useI18n } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/types";
import { computeIndicativeRates } from "@/lib/market/rates";
import type { MarketQuote, MarketSnapshot } from "@/lib/market/types";
import type { MarketContextValue } from "@/providers/MarketProvider";

/* ------------------------------------------------------------------ */
/* Market context mock (mutable per test)                              */
/* ------------------------------------------------------------------ */

const mocks = vi.hoisted(() => ({ market: undefined as unknown }));

vi.mock("@/providers/MarketProvider", () => ({
  useMarket: () => mocks.market,
  MarketProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const NOW_ISO = "2026-09-29T09:00:00.000Z";

const QUOTES: MarketQuote[] = [
  { base: "BTC", quote: "USDT", price: 100_000, change24hPct: 1.2, updatedAt: NOW_ISO, source: "binance" },
  { base: "ETH", quote: "BTC", price: 0.03, change24hPct: -0.4, updatedAt: NOW_ISO, source: "binance" },
  { base: "SOL", quote: "BTC", price: 0.00172, change24hPct: 2.1, updatedAt: NOW_ISO, source: "binance" },
  { base: "USDT", quote: "IDR", price: 16_485, change24hPct: 0.05, updatedAt: NOW_ISO, source: "indodax" },
];

function buildFixture(spread = 0.05): MarketSnapshot {
  return {
    status: "live",
    generatedAt: NOW_ISO,
    updatedAt: NOW_ISO,
    spread,
    quotes: QUOTES,
    rates: computeIndicativeRates(QUOTES, spread),
    sources: ["binance", "indodax"],
    error: null,
  };
}

function marketValue(overrides: Partial<MarketContextValue> = {}): MarketContextValue {
  const snapshot = overrides.snapshot === undefined ? buildFixture() : overrides.snapshot;
  const rateMap = new Map((snapshot?.rates ?? []).map((r) => [r.pairId, r] as const));
  return {
    snapshot,
    connection: "live",
    status: snapshot ? snapshot.status : "unavailable",
    lastUpdatedAt: snapshot?.updatedAt ? new Date(snapshot.updatedAt) : null,
    isStale: false,
    refresh: vi.fn(),
    getRate: (pairId) => rateMap.get(pairId),
    getQuote: () => undefined,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Framer's whileInView needs an IntersectionObserver; jsdom has none. */
class IntersectionObserverStub {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
  root = null;
  rootMargin = "";
  thresholds = [];
}

/** Lets a test flip the locale the way the LanguageSwitcher does. */
function LocaleProbe() {
  const { setLocale } = useI18n();
  return (
    <button type="button" onClick={() => setLocale("id")}>
      switch-to-id
    </button>
  );
}

function renderPairs(locale: Locale = "en") {
  return render(
    <I18nProvider initialLocale={locale}>
      <div id="exchange" />
      <SupportedPairs />
      <LocaleProbe />
    </I18nProvider>,
  );
}

const ALL_LABELS = FEATURED_PAIRS.map(pairLabel);

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
  window.scrollTo = vi.fn();
  mocks.market = marketValue();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe("SupportedPairs", () => {
  it("renders the section with the navigation id and a labelled heading", () => {
    renderPairs();
    const section = document.getElementById("pairs");
    expect(section).not.toBeNull();
    expect(section?.tagName).toBe("SECTION");
    const heading = screen.getByRole("heading", { level: 2, name: en.pairs.title });
    expect(section).toHaveAttribute("aria-labelledby", heading.id);
    expect(screen.getByText(en.pairs.description)).toBeInTheDocument();
  });

  it("renders exactly the four supported pair labels, in config order, and no reversed pair", () => {
    renderPairs();
    const labels = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(labels).toEqual(ALL_LABELS);
    expect(labels).toHaveLength(4);
    expect(screen.queryByText("BTC → USDT")).not.toBeInTheDocument();
    expect(screen.queryByText("BTC → SOL")).not.toBeInTheDocument();
    expect(screen.queryByText("IDR → USDT")).not.toBeInTheDocument();
  });

  it("shows the live our-rate line and market reference for every pair", () => {
    renderPairs();
    // USDT → BTC: 1 BTC = 100,000 market → 105,000 with the 5% spread.
    expect(screen.getByText("1 BTC = 105,000.00 USDT")).toBeInTheDocument();
    expect(screen.getByText(`${en.common.marketPrice} 100,000.00 USDT`)).toBeInTheDocument();
    // SOL → BTC: 0.00172 / 1.05 = 0.001638…
    expect(screen.getByText("1 SOL = 0.001638 BTC")).toBeInTheDocument();
    // ETH → BTC: 0.03 / 1.05 = 0.028571…
    expect(screen.getByText("1 ETH = 0.02857 BTC")).toBeInTheDocument();
    // USDT → IDR: 16,485 / 1.05 = 15,700
    expect(screen.getByText("1 USDT = Rp15,700")).toBeInTheDocument();
    expect(screen.getAllByText(en.pairs.ourRate).length).toBeGreaterThanOrEqual(4);
    expect(screen.queryByText(en.pairs.indicativeLabel)).not.toBeInTheDocument();
  });

  it("never shows old numbers when the market is unavailable", () => {
    // A stale snapshot is still in memory, but status says unavailable.
    mocks.market = marketValue({ status: "unavailable", connection: "polling" });
    renderPairs();
    expect(screen.queryByText("1 BTC = 105,000.00 USDT")).not.toBeInTheDocument();
    expect(screen.queryByText(/105,000/)).not.toBeInTheDocument();
    expect(screen.getAllByText(en.pairs.indicativeLabel)).toHaveLength(4);
    expect(screen.getByRole("status")).toHaveTextContent(en.common.marketUnavailable);
  });

  it("shows the indicative placeholder and no status line before the first snapshot", () => {
    mocks.market = marketValue({ snapshot: null, status: "unavailable", connection: "connecting" });
    renderPairs();
    expect(screen.getAllByText(en.pairs.indicativeLabel)).toHaveLength(4);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    // The statement still knows the spread from the static default.
    expect(
      screen.getByText(interpolate(en.pairs.ourRateFormula, { spread: `${DEFAULT_EXCHANGE_SPREAD * 100}%` })),
    ).toBeInTheDocument();
  });

  it("keeps the numbers but marks them stale with a last-updated note", () => {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60_000);
    mocks.market = marketValue({ status: "stale", isStale: true, lastUpdatedAt: twoMinutesAgo });
    renderPairs();
    const value = screen.getByText("1 BTC = 105,000.00 USDT");
    expect(value).toBeInTheDocument();
    expect(value.className).toContain("text-muted");
    expect(screen.getAllByText(en.market.stale)).toHaveLength(4);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/^Last updated 2 minutes ago$/);
  });

  it("shows the reconnecting / polling / offline notes while keeping fresh data visible", () => {
    mocks.market = marketValue({ connection: "polling" });
    const { unmount } = renderPairs();
    expect(screen.getByRole("status")).toHaveTextContent(en.market.pollingNote);
    expect(screen.getByText("1 BTC = 105,000.00 USDT")).toBeInTheDocument();
    unmount();

    mocks.market = marketValue({ connection: "offline" });
    const second = renderPairs();
    expect(screen.getByRole("status")).toHaveTextContent(en.market.offlineNote);
    expect(screen.getByText("1 BTC = 105,000.00 USDT")).toBeInTheDocument();
    second.unmount();

    mocks.market = marketValue({ connection: "reconnecting" });
    renderPairs();
    expect(screen.getByRole("status")).toHaveTextContent(en.common.reconnecting);
    expect(screen.getByText("1 BTC = 105,000.00 USDT")).toBeInTheDocument();
  });

  it("renders the centred statement with the spread from the snapshot", () => {
    mocks.market = marketValue({ snapshot: buildFixture(0.03) });
    renderPairs();
    expect(screen.getByText(interpolate(en.pairs.ourRateFormula, { spread: "3%" }))).toBeInTheDocument();
    expect(screen.getByText(en.pairs.note)).toBeInTheDocument();
    expect(screen.getByText(en.pairs.perPairNote)).toBeInTheDocument();
  });

  it("Check rate dispatches cryptix:select-pair with the pair id, then scrolls to #exchange", async () => {
    const user = userEvent.setup();
    const received: SelectPairDetail[] = [];
    const listener = (event: Event) => received.push((event as CustomEvent<SelectPairDetail>).detail);
    window.addEventListener(SELECT_PAIR_EVENT, listener);
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    renderPairs();

    const buttons = screen.getAllByRole("button", { name: /^Check rate for / });
    expect(buttons).toHaveLength(4);
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual(
      ALL_LABELS.map((label) => interpolate(en.pairs.checkRateFor, { pair: label })),
    );

    await user.click(screen.getByRole("button", { name: "Check rate for SOL → BTC" }));

    expect(received).toEqual([{ pairId: "SOL_BTC" }]);
    const dispatched = dispatchSpy.mock.calls
      .map(([event]) => event)
      .filter((event): event is CustomEvent<SelectPairDetail> => event.type === SELECT_PAIR_EVENT);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].detail).toEqual({ pairId: "SOL_BTC" });
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "smooth" }));
    // The section did NOT open the modal or change anything else on its own.
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);

    window.removeEventListener(SELECT_PAIR_EVENT, listener);
  });

  it("is keyboard operable: Enter on a focused Check rate button dispatches the event", async () => {
    const user = userEvent.setup();
    const received: string[] = [];
    const listener = (event: Event) => received.push((event as CustomEvent<SelectPairDetail>).detail.pairId);
    window.addEventListener(SELECT_PAIR_EVENT, listener);
    renderPairs();

    screen.getByRole("button", { name: "Check rate for USDT → IDR" }).focus();
    await user.keyboard("{Enter}");

    expect(received).toEqual(["USDT_IDR"]);
    window.removeEventListener(SELECT_PAIR_EVENT, listener);
  });

  it("renders in Indonesian from the start", () => {
    expect(id.pairs.title).not.toBe(en.pairs.title);
    renderPairs("id");
    expect(screen.getByRole("heading", { level: 2, name: id.pairs.title })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Cek kurs untuk / })).toHaveLength(4);
    // Indonesian number formatting: 105.000,00 USDT.
    expect(screen.getByText("1 BTC = 105.000,00 USDT")).toBeInTheDocument();
    expect(screen.getByText(interpolate(id.pairs.ourRateFormula, { spread: "5%" }))).toBeInTheDocument();
  });

  it("switches from English to Indonesian when the locale changes", async () => {
    const user = userEvent.setup();
    renderPairs("en");
    expect(screen.getByRole("heading", { level: 2, name: en.pairs.title })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "switch-to-id" }));
    expect(screen.getByRole("heading", { level: 2, name: id.pairs.title })).toBeInTheDocument();
    expect(screen.getByText(id.pairs.note)).toBeInTheDocument();
    expect(screen.getByText("1 USDT = Rp15.700")).toBeInTheDocument();
    // Pair labels are language independent.
    const cards = screen.getAllByRole("heading", { level: 3 });
    expect(cards.map((h) => h.textContent)).toEqual(ALL_LABELS);
    expect(within(cards[0].closest("li") as HTMLElement).getByText(id.pairs.checkRate)).toBeInTheDocument();
  });
});
