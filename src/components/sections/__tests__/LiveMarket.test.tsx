import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveMarket } from "@/components/sections/LiveMarket";
import type { CurrencyCode } from "@/config/exchange";
import { I18nProvider } from "@/lib/i18n/provider";
import { en } from "@/lib/i18n/dictionaries/en";
import { computeIndicativeRates } from "@/lib/market/rates";
import { pairKey, type MarketQuote, type MarketSnapshot } from "@/lib/market/types";
import type { MarketContextValue } from "@/providers/MarketProvider";

/* ------------------------------------------------------------------ */
/* Market context mock                                                 */
/* ------------------------------------------------------------------ */

let mockValue: MarketContextValue;

vi.mock("@/providers/MarketProvider", () => ({
  useMarket: () => mockValue,
  MarketProvider: ({ children }: { children: React.ReactNode }) => children,
}));

/* ------------------------------------------------------------------ */
/* Fixture                                                             */
/* ------------------------------------------------------------------ */

const NOW = Date.UTC(2026, 8, 29, 12, 0, 0);
const UPDATED_AT = new Date(NOW - 5_000).toISOString();

function quote(base: CurrencyCode, q: CurrencyCode, price: number, change: number | null, source: string): MarketQuote {
  return { base, quote: q, price, change24hPct: change, updatedAt: UPDATED_AT, source };
}

const QUOTES: MarketQuote[] = [
  quote("BTC", "USDT", 100_000, 2.41, "binance"),
  quote("ETH", "BTC", 0.03, -0.42, "binance"),
  quote("SOL", "BTC", 0.00172, 0.8, "binance"),
  quote("USDT", "IDR", 16_485, 0.12, "indodax"),
];

function makeSnapshot(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  const quotes = overrides.quotes ?? QUOTES;
  return {
    status: "live",
    generatedAt: new Date(NOW).toISOString(),
    updatedAt: UPDATED_AT,
    spread: 0.05,
    quotes,
    rates: computeIndicativeRates(quotes, 0.05),
    sources: Array.from(new Set(quotes.map((q) => q.source))),
    error: null,
    ...overrides,
  };
}

function makeContext(overrides: Partial<MarketContextValue> = {}): MarketContextValue {
  const snapshot = "snapshot" in overrides ? overrides.snapshot ?? null : makeSnapshot();
  const direct = new Map<string, MarketQuote>();
  for (const q of snapshot?.quotes ?? []) direct.set(pairKey(q.base, q.quote), q);
  const status = overrides.status ?? snapshot?.status ?? "unavailable";
  return {
    snapshot,
    connection: "live",
    status,
    lastUpdatedAt: snapshot?.updatedAt ? new Date(snapshot.updatedAt) : null,
    isStale: status === "stale",
    refresh: vi.fn(),
    getRate: (pairId) => snapshot?.rates.find((r) => r.pairId === pairId),
    getQuote: (base, q) => direct.get(pairKey(base, q)),
    ...overrides,
  };
}

function renderSection() {
  return render(
    <I18nProvider initialLocale="en">
      <LiveMarket />
    </I18nProvider>,
  );
}

/** The desktop board: the <table> (the mobile cards are a separate <ul>). */
function table() {
  return screen.getByRole("table");
}
function dataRows() {
  // First row is the header row.
  return within(table()).getAllByRole("row").slice(1);
}

beforeAll(() => {
  // framer-motion probes matchMedia for reduced motion and builds an
  // IntersectionObserver for whileInView; jsdom has neither.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  class IO {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn(() => []);
    root = null;
    rootMargin = "";
    thresholds = [];
  }
  Object.defineProperty(window, "IntersectionObserver", { writable: true, configurable: true, value: IO });
  Object.defineProperty(globalThis, "IntersectionObserver", { writable: true, configurable: true, value: IO });
});

beforeEach(() => {
  mockValue = makeContext();
});

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe("LiveMarket — live", () => {
  it("renders the section contract: id, one h2 and the dictionary copy", () => {
    renderSection();
    const section = document.getElementById("market");
    expect(section).not.toBeNull();
    expect(section?.tagName).toBe("SECTION");
    const heading = screen.getByRole("heading", { level: 2, name: en.market.title });
    expect(section).toHaveAttribute("aria-labelledby", heading.id);
    expect(screen.getByText(en.market.description)).toBeInTheDocument();
  });

  it("shows the four display pairs with locale-formatted prices and signed change badges", () => {
    renderSection();
    const rows = dataRows();
    expect(rows).toHaveLength(4);

    expect(rows[0]).toHaveTextContent("BTC / USDT");
    expect(rows[0]).toHaveTextContent("100,000.00 USDT");
    expect(rows[0]).toHaveTextContent("+2.41%");

    expect(rows[1]).toHaveTextContent("ETH / BTC");
    expect(rows[1]).toHaveTextContent("0.03000 BTC");
    expect(rows[1]).toHaveTextContent("-0.42%");

    expect(rows[2]).toHaveTextContent("SOL / BTC");
    expect(rows[2]).toHaveTextContent("0.001720 BTC");
    expect(rows[2]).toHaveTextContent("+0.80%");

    expect(rows[3]).toHaveTextContent("USDT / IDR");
    expect(rows[3]).toHaveTextContent("Rp16,485");
    expect(rows[3]).toHaveTextContent("+0.12%");

    // Currency names sit under the pair label; provider under the time.
    expect(rows[0]).toHaveTextContent("Bitcoin · Tether USD");
    expect(rows[3]).toHaveTextContent("indodax");
    // Every row carries the live dot label.
    for (const row of rows) expect(within(row).getByText(en.market.live)).toBeInTheDocument();
  });

  it("renders the column headers from the dictionary", () => {
    renderSection();
    const headers = within(table()).getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual([
      en.market.columns.pair,
      en.market.columns.price,
      en.market.columns.change24h,
      en.market.columns.updated,
      en.market.columns.status,
    ]);
  });

  it("mirrors the rows as stacked cards for small screens", () => {
    renderSection();
    const list = screen.getByRole("list", { name: en.market.title });
    const cards = within(list).getAllByRole("listitem");
    expect(cards).toHaveLength(4);
    expect(cards[0]).toHaveTextContent("100,000.00 USDT");
    expect(cards[3]).toHaveTextContent("Rp16,485");
    expect(within(cards[0]).getByText(en.market.columns.price)).toBeInTheDocument();
  });

  it("headline indicator reads LIVE, shows the last-updated time and no notices", () => {
    renderSection();
    const indicator = screen.getAllByRole("status").find((el) => el.textContent === en.market.live);
    expect(indicator).toBeDefined();
    expect(screen.getByText(/^Last updated: \d{2}:\d{2}:\d{2}$/)).toBeInTheDocument();
    expect(screen.queryByText(en.market.staleBody)).not.toBeInTheDocument();
    expect(screen.queryByText(en.market.unavailableTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(en.market.pollingNote)).not.toBeInTheDocument();
    expect(screen.queryByText(en.market.offlineNote)).not.toBeInTheDocument();
    expect(screen.queryByText(en.market.devMock)).not.toBeInTheDocument();
  });

  it("lists the contributing providers and the short disclaimer under the board", () => {
    renderSection();
    expect(screen.getByText("Data source: binance, indodax")).toBeInTheDocument();
    expect(screen.getByText(en.disclaimer.short)).toBeInTheDocument();
  });

  it("refresh button calls refresh()", async () => {
    renderSection();
    await userEvent.click(screen.getByRole("button", { name: en.market.refresh }));
    expect(mockValue.refresh).toHaveBeenCalledTimes(1);
  });

  it("a row whose pair has no quote shows a dash and UNAVAILABLE — other rows stay live", () => {
    mockValue = makeContext({ snapshot: makeSnapshot({ quotes: QUOTES.filter((q) => q.base !== "SOL") }) });
    renderSection();
    const rows = dataRows();
    expect(rows).toHaveLength(4);
    const sol = rows[2];
    expect(sol).toHaveTextContent("SOL / BTC");
    expect(sol).not.toHaveTextContent("0.001720");
    expect(sol).not.toHaveTextContent("+0.80%");
    expect(within(sol).getByText(en.market.unavailable)).toBeInTheDocument();
    expect(within(sol).getAllByText("—").length).toBeGreaterThan(0);
    expect(rows[0]).toHaveTextContent("100,000.00 USDT");
    expect(within(rows[0]).getByText(en.market.live)).toBeInTheDocument();
  });
});

describe("LiveMarket — stale", () => {
  beforeEach(() => {
    const threeMinutesAgo = new Date(NOW - 3 * 60_000).toISOString();
    const quotes = QUOTES.map((q) => ({ ...q, updatedAt: threeMinutesAgo }));
    mockValue = makeContext({
      snapshot: makeSnapshot({ quotes, updatedAt: threeMinutesAgo, status: "stale" }),
      status: "stale",
      isStale: true,
      lastUpdatedAt: new Date(threeMinutesAgo),
    });
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  });

  it("shows the stale notice, the relative last-updated text and keeps numbers visible (de-emphasised)", () => {
    renderSection();
    expect(screen.getByText(en.market.staleBody)).toBeInTheDocument();
    expect(screen.getByText("Last updated 3 minutes ago")).toBeInTheDocument();
    expect(screen.getByText(/^Last updated: \d{2}:\d{2}:\d{2}$/)).toBeInTheDocument();
    const rows = dataRows();
    expect(rows[0]).toHaveTextContent("100,000.00 USDT");
    for (const row of rows) expect(within(row).getByText(en.market.stale)).toBeInTheDocument();
    expect(screen.getAllByRole("status").some((el) => el.textContent === en.market.stale)).toBe(true);
    vi.useRealTimers();
  });
});

describe("LiveMarket — unavailable", () => {
  beforeEach(() => {
    mockValue = makeContext({
      snapshot: makeSnapshot({ status: "unavailable" }),
      status: "unavailable",
      connection: "polling",
    });
  });

  it("shows the unavailable notice, hides old prices, and Retry calls refresh()", async () => {
    renderSection();
    expect(screen.getByText(en.market.unavailableTitle)).toBeInTheDocument();
    expect(screen.getByText(en.market.unavailableBody)).toBeInTheDocument();
    // Old numbers are never shown as live.
    expect(screen.queryByText(/100,000\.00/)).not.toBeInTheDocument();
    expect(screen.queryByText("+2.41%")).not.toBeInTheDocument();
    const rows = dataRows();
    expect(rows).toHaveLength(4);
    for (const row of rows) expect(within(row).getByText(en.market.unavailable)).toBeInTheDocument();
    // Pair labels stay so the reader knows what is missing.
    expect(rows[0]).toHaveTextContent("BTC / USDT");

    await userEvent.click(screen.getByRole("button", { name: en.common.retry }));
    expect(mockValue.refresh).toHaveBeenCalledTimes(1);
  });

  it("headline indicator reads UNAVAILABLE even though the transport is polling", () => {
    renderSection();
    expect(screen.getAllByRole("status").some((el) => el.textContent === en.market.unavailable)).toBe(true);
    expect(screen.getByText(en.market.pollingNote)).toBeInTheDocument();
  });
});

describe("LiveMarket — loading", () => {
  beforeEach(() => {
    mockValue = makeContext({ snapshot: null, status: "unavailable", connection: "connecting", lastUpdatedAt: null });
  });

  it("renders skeleton rows (4) and no unavailable notice before the first snapshot", () => {
    renderSection();
    const board = table();
    expect(board).toHaveAttribute("aria-busy", "true");
    expect(dataRows()).toHaveLength(4);
    expect(screen.getAllByText(en.common.loading).length).toBeGreaterThan(0);
    expect(screen.queryByText(en.market.unavailableTitle)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.common.retry })).not.toBeInTheDocument();
    expect(screen.queryByText(/USDT$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Last updated/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("status").some((el) => el.textContent === en.market.connecting)).toBe(true);
  });
});

describe("LiveMarket — degraded transport with fresh data", () => {
  it("polling: note + RECONNECTING ring, prices still shown as live data", () => {
    mockValue = makeContext({ connection: "polling" });
    renderSection();
    expect(screen.getByText(en.market.pollingNote)).toBeInTheDocument();
    expect(screen.getAllByRole("status").some((el) => el.textContent === en.market.reconnecting)).toBe(true);
    expect(dataRows()[0]).toHaveTextContent("100,000.00 USDT");
    expect(within(dataRows()[0]).getByText(en.market.live)).toBeInTheDocument();
  });

  it("offline: offline note is shown", () => {
    mockValue = makeContext({ connection: "offline" });
    renderSection();
    expect(screen.getByText(en.market.offlineNote)).toBeInTheDocument();
    expect(dataRows()[0]).toHaveTextContent("100,000.00 USDT");
  });

  it("reconnecting: ring only, no notice", () => {
    mockValue = makeContext({ connection: "reconnecting" });
    renderSection();
    expect(screen.getAllByRole("status").some((el) => el.textContent === en.market.reconnecting)).toBe(true);
    expect(screen.queryByText(en.market.pollingNote)).not.toBeInTheDocument();
    expect(screen.queryByText(en.market.offlineNote)).not.toBeInTheDocument();
  });
});

describe("LiveMarket — development mock provider", () => {
  it("flags mock data with a warning badge and names the source", () => {
    const quotes = QUOTES.map((q) => ({ ...q, source: "mock" }));
    mockValue = makeContext({ snapshot: makeSnapshot({ quotes }) });
    renderSection();
    expect(screen.getByText(en.market.devMock)).toBeInTheDocument();
    expect(screen.getByText("Data source: mock")).toBeInTheDocument();
  });
});
