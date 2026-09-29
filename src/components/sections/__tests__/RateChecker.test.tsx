import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketConnection, MarketContextValue } from "@/providers/MarketProvider";
import type { IndicativeRate, MarketQuote, MarketSnapshot, MarketStatus } from "@/lib/market/types";

/* ------------------------------------------------------------------ */
/* Mocks (hoisted so the mutable objects exist before the imports run)  */
/* ------------------------------------------------------------------ */

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
  MarketProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Deterministic numbers: AnimatedNumber renders the target value directly and
// Reveal/Button/SwapButton skip transforms when reduced motion is on.
vi.mock("@/hooks/useReducedMotionSafe", () => ({ useReducedMotionSafe: () => true }));

import { RateChecker } from "@/components/sections/RateChecker";
import { SELECT_PAIR_EVENT } from "@/components/sections/rate-checker/useRateChecker";
import { AMOUNT_LIMITS, CURRENCIES, type PairId } from "@/config/exchange";
import { en } from "@/lib/i18n/dictionaries/en";
import { id as idDict } from "@/lib/i18n/dictionaries/id";
import { interpolate } from "@/lib/i18n/dictionaries";
import { formatAmount, formatPrice, formatRelativeTime, formatTime } from "@/lib/i18n/format";
import { I18nProvider } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/types";
import { calculateReceive, computeIndicativeRates } from "@/lib/market/rates";
import {
  ExchangeRequestProvider,
  useExchangeRequest,
  type ExchangeRequestPrefill,
} from "@/providers/ExchangeRequestProvider";

/* ------------------------------------------------------------------ */
/* Fixture                                                             */
/* ------------------------------------------------------------------ */

const NOW = new Date("2026-09-29T08:00:00.000Z");
const UPDATED_AT = new Date(NOW.getTime() - 5_000).toISOString();
const SPREAD = 0.05;

function quote(base: MarketQuote["base"], quoteSym: MarketQuote["quote"], price: number, change: number | null, source: string): MarketQuote {
  return { base, quote: quoteSym, price, change24hPct: change, updatedAt: UPDATED_AT, source };
}

const QUOTES: MarketQuote[] = [
  quote("BTC", "USDT", 100_000, 2.41, "binance"),
  quote("ETH", "BTC", 0.03, -0.42, "binance"),
  quote("SOL", "BTC", 0.00172, 1.1, "binance"),
  quote("USDT", "IDR", 16_485, 0.05, "indodax"),
];
const RATES: IndicativeRate[] = computeIndicativeRates(QUOTES, SPREAD);

function rateFor(pairId: PairId): IndicativeRate {
  const r = RATES.find((x) => x.pairId === pairId);
  if (!r) throw new Error(`fixture has no rate for ${pairId}`);
  return r;
}

function snapshot(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    status: "live",
    generatedAt: NOW.toISOString(),
    updatedAt: UPDATED_AT,
    spread: SPREAD,
    quotes: QUOTES,
    rates: RATES,
    sources: ["binance", "indodax"],
    error: null,
    ...overrides,
  };
}

function setMarket(options: { status?: MarketStatus; connection?: MarketConnection; snapshot?: MarketSnapshot | null } = {}) {
  const status = options.status ?? "live";
  const snap = options.snapshot === undefined ? snapshot({ status }) : options.snapshot;
  const refresh = vi.fn();
  market.current = {
    snapshot: snap,
    connection: options.connection ?? "live",
    status,
    lastUpdatedAt: snap?.updatedAt ? new Date(snap.updatedAt) : null,
    isStale: status === "stale",
    refresh,
    getRate: (pairId) => snap?.rates.find((r) => r.pairId === pairId),
    getQuote: () => undefined,
  };
  return { refresh };
}

/** Reads the modal context so the test observes the real outcome of "Request exchange". */
function Probe() {
  const { isOpen, prefill } = useExchangeRequest();
  return (
    <output data-testid="probe" data-open={String(isOpen)}>
      {JSON.stringify(prefill)}
    </output>
  );
}

function renderChecker(locale: Locale = "en") {
  return render(
    <I18nProvider initialLocale={locale}>
      <ExchangeRequestProvider>
        <RateChecker />
        <Probe />
      </ExchangeRequestProvider>
    </I18nProvider>,
  );
}

const amountInput = () => screen.getByRole("textbox", { name: new RegExp(`^${en.rateChecker.from}`) });
const fromSelect = () => screen.getByRole("button", { name: new RegExp(`^${en.rateChecker.sendCurrencyLabel}`) });
const toSelect = () => screen.getByRole("button", { name: new RegExp(`^${en.rateChecker.receiveCurrencyLabel}`) });
const swapButton = () => screen.getByRole("button", { name: en.rateChecker.swap });
const requestButton = () => screen.getByRole("button", { name: en.rateChecker.requestExchange });
/** The read-only "To" amount: a live region named by the "To" label. */
// The visible To value is intentionally NOT a live region (price ticks would be read out endlessly).
const toValue = () => screen.getByTestId("to-value");
const marketRow = () => screen.getByText(en.rateChecker.marketRate).closest("div") as HTMLElement;
const ourRow = () => screen.getByText(en.rateChecker.ourRate).closest("div") as HTMLElement;
const readPrefill = () => JSON.parse(screen.getByTestId("probe").textContent ?? "null") as ExchangeRequestPrefill | null;

const marketText = (pairId: PairId) => {
  const r = rateFor(pairId);
  return formatPrice("en", r.marketPriceDisplay, r.quoteCurrency);
};
const ourText = (pairId: PairId) => {
  const r = rateFor(pairId);
  return formatPrice("en", r.ourPriceDisplay, r.quoteCurrency);
};
/** The big "To" number as rendered (no currency suffix — the chip shows the ticker). */
const estimateNumber = (pairId: PairId, amount: number) => {
  const r = rateFor(pairId);
  return formatAmount("en", calculateReceive(r, amount), r.to, { withSymbol: false });
};

beforeAll(() => {
  // framer-motion's whileInView constructs an IntersectionObserver on mount (jsdom has none).
  class IO {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", IO);
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
});

beforeEach(() => {
  site.whatsappNumber = "6281234567890";
  setMarket();
});

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

/* ------------------------------------------------------------------ */
/* Fixture sanity: the numbers the spec quotes                          */
/* ------------------------------------------------------------------ */

describe("fixture", () => {
  it("matches the documented reference numbers", () => {
    expect(marketText("USDT_BTC")).toBe("100,000.00 USDT");
    expect(ourText("USDT_BTC")).toBe("105,000.00 USDT");
    expect(estimateNumber("USDT_BTC", 1000)).toBe("0.00952381");
    // Reverse direction: the customer receives USDT, so our price of 1 BTC is below market.
    expect(marketText("BTC_USDT")).toBe("100,000.00 USDT");
    expect(ourText("BTC_USDT")).toBe("95,238.10 USDT");
    expect(marketText("USDT_IDR")).toBe("Rp16,485");
    expect(ourText("USDT_IDR")).toBe("Rp15,700");
    expect(marketText("SOL_BTC")).toContain("0.00172");
  });
});

/* ------------------------------------------------------------------ */
/* Default view                                                        */
/* ------------------------------------------------------------------ */

describe("RateChecker — default view", () => {
  it("renders the #exchange section with one h2 and the dictionary copy", () => {
    renderChecker();
    const section = document.getElementById("exchange");
    expect(section).not.toBeNull();
    expect(section?.tagName).toBe("SECTION");
    const headings = within(section as HTMLElement).getAllByRole("heading", { level: 2 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(en.rateChecker.title);
    expect(screen.getByText(en.rateChecker.description)).toBeInTheDocument();
    expect(screen.getByText(en.rateChecker.eyebrow)).toBeInTheDocument();
  });

  it("shows From USDT 1,000.00 and To BTC 0.00952381 with the coin chips on each panel", () => {
    renderChecker();
    expect(screen.getByText(en.rateChecker.from)).toBeInTheDocument();
    expect(screen.getByText(en.rateChecker.to)).toBeInTheDocument();
    expect(amountInput()).toHaveValue("1,000.00");
    expect(amountInput()).toHaveAttribute("inputmode", "decimal");
    expect(amountInput()).toHaveAttribute("placeholder", "0");
    expect(fromSelect()).toHaveTextContent("USDT");
    expect(toSelect()).toHaveTextContent("BTC");
    expect(within(toValue()).getByText("0.00952381")).toBeInTheDocument();
    expect(toValue()).toHaveTextContent("0.00952381 BTC");
    // Announcements go through a separate polite region that only speaks on the visitor's own changes.
    expect(toValue()).not.toHaveAttribute("aria-live");
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
    // Helper lines carry the full currency names.
    expect(screen.getByText(CURRENCIES.USDT.name)).toBeInTheDocument();
    expect(screen.getByText(CURRENCIES.BTC.name)).toBeInTheDocument();
  });

  it("shows the market line, the Market rate / Our rate rows with the spread badge and explainer", () => {
    renderChecker();
    expect(screen.getAllByText("1 BTC =").length).toBeGreaterThanOrEqual(3);
    expect(marketRow()).toHaveTextContent(/1 BTC = 100,000\.00 USDT/);
    expect(ourRow()).toHaveTextContent(/1 BTC = 105,000\.00 USDT/);
    expect(within(ourRow()).getByText("+5% FROM MARKET")).toBeInTheDocument();
    expect(screen.getByText("+2.41%")).toBeInTheDocument();
    // Tooltip stays in the DOM (aria-describedby resolves) and opens on focus.
    const info = screen.getByRole("button", { name: en.rateChecker.spreadInfoLabel });
    const tooltip = screen.getByRole("tooltip", { hidden: true });
    expect(tooltip).toHaveTextContent(interpolate(en.rateChecker.spreadExplainer, { spread: "5%" }));
    expect(info).toHaveAttribute("aria-describedby", tooltip.id);
    expect(tooltip).toHaveAttribute("aria-hidden", "true");
    act(() => info.focus());
    expect(tooltip).toHaveAttribute("aria-hidden", "false");
  });

  it("shows the live indicator with the updated time, the short disclaimer in the card and the full one under it", () => {
    renderChecker();
    expect(screen.getByText(en.common.live)).toBeInTheDocument();
    expect(screen.getByText(en.common.live).closest('[role="status"]')).not.toBeNull();
    expect(screen.getByText(interpolate(en.rateChecker.updatedAt, { time: formatTime("en", UPDATED_AT) }))).toBeInTheDocument();
    expect(screen.getByText(en.rateChecker.disclaimer)).toBeInTheDocument();
    expect(en.rateChecker.disclaimer).toBe(en.disclaimer.short);
    expect(screen.getByText(interpolate(en.disclaimer.full, { spread: "5%" }))).toBeInTheDocument();
  });

  it("renders one full-width Request exchange CTA and a WhatsApp text link under it", () => {
    renderChecker();
    expect(screen.getAllByRole("button", { name: en.rateChecker.requestExchange })).toHaveLength(1);
    expect(requestButton()).toHaveClass("w-full");
    expect(screen.getByRole("link", { name: en.rateChecker.chatOnWhatsApp })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/convert/i);
  });

  it("renders Dari / Ke, Indonesian number formatting and the Indonesian disclaimer", () => {
    renderChecker("id");
    expect(idDict.rateChecker.from).toBe("Dari");
    expect(idDict.rateChecker.to).toBe("Ke");
    expect(screen.getByText("Dari")).toBeInTheDocument();
    expect(screen.getByText("Ke")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^Dari/ })).toHaveValue("1.000,00");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(idDict.rateChecker.title);
    expect(screen.getByText("+5% DARI HARGA PASAR")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tukar mata uang" })).toBeInTheDocument();
    expect(screen.getByTestId("to-value")).toHaveTextContent(formatAmount("id", calculateReceive(rateFor("USDT_BTC"), 1000), "BTC"));
    // The card's disclaimer is the shared short disclaimer (kept identical by construction).
    expect(screen.getByText(idDict.rateChecker.disclaimer)).toBeInTheDocument();
    expect(idDict.rateChecker.disclaimer).toBe(idDict.disclaimer.short);
    expect(idDict.rateChecker.disclaimer).toMatch(/^Kurs indikatif\. Kurs .*final akan dikonfirmasi oleh tim .*kami\.$/);
  });
});

/* ------------------------------------------------------------------ */
/* Amount                                                              */
/* ------------------------------------------------------------------ */

describe("RateChecker — amount", () => {
  it("typing 500 updates the To amount and blur formats the input", async () => {
    const user = userEvent.setup();
    renderChecker();
    const input = amountInput();
    await user.clear(input);
    await user.type(input, "500");
    expect(input).toHaveValue("500");
    expect(within(toValue()).getByText(estimateNumber("USDT_BTC", 500))).toBeInTheDocument();
    expect(screen.queryAllByText("0.00952381")).toHaveLength(0);
    await user.tab();
    expect(input).toHaveValue("500.00");
  });

  it("flags invalid text, shows the empty hint, and warns (without blocking) below the minimum", async () => {
    const user = userEvent.setup();
    renderChecker();
    const input = amountInput();
    const helper = () => document.getElementById(input.getAttribute("aria-describedby") ?? "");
    expect(helper()).toHaveTextContent(CURRENCIES.USDT.name);

    await user.clear(input);
    expect(helper()).toHaveTextContent(en.rateChecker.enterAmount);
    // No estimate → the To panel shows a placeholder zero, not a stale number.
    expect(toValue()).toHaveTextContent("0");
    expect(toValue()).toHaveTextContent(en.rateChecker.enterAmount);

    await user.type(input, "abc");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(helper()).toHaveTextContent(en.rateChecker.invalidAmount);
    // Request exchange stays enabled; the prefill just carries no amount.
    expect(requestButton()).toBeEnabled();

    await user.clear(input);
    await user.type(input, "5");
    const min = interpolate(en.rateChecker.minAmount, { amount: formatAmount("en", AMOUNT_LIMITS.USDT.min, "USDT", { compact: true }) });
    expect(helper()).toHaveTextContent(min);
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(within(toValue()).getByText(estimateNumber("USDT_BTC", 5))).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/* Swap                                                                */
/* ------------------------------------------------------------------ */

describe("RateChecker — swap", () => {
  it("swaps to BTC → USDT, carries the previous To amount into From and recomputes To at market / 1.05", async () => {
    const user = userEvent.setup();
    renderChecker();
    expect(swapButton()).not.toHaveAttribute("aria-disabled");

    await user.click(swapButton());
    expect(fromSelect()).toHaveTextContent("BTC");
    expect(toSelect()).toHaveTextContent("USDT");
    expect(amountInput()).toHaveValue("0.00952381");
    const expected = formatAmount("en", (0.00952381 * 100_000) / 1.05, "USDT", { withSymbol: false });
    expect(expected).toBe("907.03");
    expect(within(toValue()).getByText(expected)).toBeInTheDocument();
    expect(within(toValue()).getByText(estimateNumber("BTC_USDT", 0.00952381))).toBeInTheDocument();
    // The quote direction is unchanged (BTC stays the "1 unit" side); our price is now below market.
    expect(marketRow()).toHaveTextContent(/1 BTC = 100,000\.00 USDT/);
    expect(ourRow()).toHaveTextContent(/1 BTC = 95,238\.10 USDT/);
    expect(screen.getByText(CURRENCIES.BTC.name)).toBeInTheDocument();
    expect(screen.getByText(CURRENCIES.USDT.name)).toBeInTheDocument();

    // Swapping back rounds 907.029… to USDT's 2 input decimals.
    await user.click(swapButton());
    expect(fromSelect()).toHaveTextContent("USDT");
    expect(toSelect()).toHaveTextContent("BTC");
    expect(amountInput()).toHaveValue("907.03");
    expect(within(toValue()).getByText(estimateNumber("USDT_BTC", 907.03))).toBeInTheDocument();
    expect(ourRow()).toHaveTextContent(/1 BTC = 105,000\.00 USDT/);
  });

  it("keeps the amount when there is no estimate to carry over", async () => {
    const user = userEvent.setup();
    setMarket({ status: "unavailable", connection: "polling", snapshot: null });
    renderChecker();
    await user.click(swapButton());
    expect(fromSelect()).toHaveTextContent("BTC");
    expect(toSelect()).toHaveTextContent("USDT");
    expect(amountInput()).toHaveValue(formatAmount("en", 1000, "BTC", { withSymbol: false }));
  });
});

/* ------------------------------------------------------------------ */
/* Currency selection                                                  */
/* ------------------------------------------------------------------ */

describe("RateChecker — currency selection", () => {
  it("From lists 5 currencies; To lists BTC and IDR for USDT, and only USDT for IDR", async () => {
    const user = userEvent.setup();
    renderChecker();
    await user.click(fromSelect());
    let listbox = screen.getByRole("listbox", { name: en.rateChecker.sendCurrencyLabel });
    expect(within(listbox).getAllByRole("option").map((o) => o.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("USDT"), expect.stringContaining("SOL"), expect.stringContaining("ETH"), expect.stringContaining("BTC"), expect.stringContaining("IDR")]),
    );
    expect(within(listbox).getAllByRole("option")).toHaveLength(5);
    expect(within(listbox).getByRole("option", { name: /USDT/ })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Escape}");

    await user.click(toSelect());
    listbox = screen.getByRole("listbox", { name: en.rateChecker.receiveCurrencyLabel });
    const toOptions = within(listbox).getAllByRole("option");
    expect(toOptions).toHaveLength(2);
    expect(toOptions[0]).toHaveTextContent("BTC");
    expect(toOptions[1]).toHaveTextContent("IDR");
    await user.keyboard("{Escape}");

    await user.click(fromSelect());
    await user.click(within(screen.getByRole("listbox")).getByRole("option", { name: /IDR/ }));
    expect(fromSelect()).toHaveTextContent("IDR");
    expect(toSelect()).toHaveTextContent("USDT");
    expect(screen.getAllByText("1 USDT =").length).toBeGreaterThan(0);
    expect(marketRow()).toHaveTextContent(/1 USDT = Rp16,485/);
    expect(ourRow()).toHaveTextContent(/1 USDT = Rp17,309/);
    await user.click(toSelect());
    const only = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(only).toHaveLength(1);
    expect(only[0]).toHaveTextContent("USDT");
  });

  it("selecting SOL as the sent currency forces BTC and shows 1 SOL = market price", async () => {
    const user = userEvent.setup();
    renderChecker();
    await user.click(fromSelect());
    await user.click(within(screen.getByRole("listbox")).getByRole("option", { name: /SOL/ }));

    expect(fromSelect()).toHaveTextContent("SOL");
    expect(toSelect()).toHaveTextContent("BTC");
    // Untouched amount resets to the coin default (10 SOL).
    expect(amountInput()).toHaveValue("10.0000");
    expect(marketRow()).toHaveTextContent(new RegExp(`1 SOL = ${marketText("SOL_BTC").replace(".", "\\.")}`));
    expect(within(toValue()).getByText(estimateNumber("SOL_BTC", 10))).toBeInTheDocument();
    expect(screen.getByText(CURRENCIES.SOL.name)).toBeInTheDocument();
    await user.click(toSelect());
    expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(1);
  });

  it("selecting IDR as the received currency for USDT shows Rp16,485 market and Rp15,700 our rate", async () => {
    const user = userEvent.setup();
    renderChecker();
    await user.click(toSelect());
    await user.click(within(screen.getByRole("listbox")).getByRole("option", { name: /IDR/ }));

    expect(toSelect()).toHaveTextContent("IDR");
    expect(marketRow()).toHaveTextContent(/1 USDT = Rp16,485/);
    expect(ourRow()).toHaveTextContent(/1 USDT = Rp15,700/);
    expect(within(toValue()).getByText(estimateNumber("USDT_IDR", 1000))).toBeInTheDocument();
  });

  it("is keyboard operable: ArrowDown opens, arrows move, Enter selects, Escape closes", async () => {
    const user = userEvent.setup();
    renderChecker();
    const trigger = fromSelect();
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const options = within(listbox).getAllByRole("option");
    expect(options).toHaveLength(5);
    expect(listbox).toHaveAttribute("aria-activedescendant", options[0].id);
    await user.keyboard("{ArrowDown}");
    expect(listbox).toHaveAttribute("aria-activedescendant", options[1].id);
    await user.keyboard("{End}");
    expect(listbox).toHaveAttribute("aria-activedescendant", options[4].id);
    await user.keyboard("{Home}");
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    expect(fromSelect()).toHaveTextContent("SOL");
    expect(fromSelect()).toHaveAttribute("aria-expanded", "false");
    expect(fromSelect()).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(fromSelect()).toHaveAttribute("aria-expanded", "false");
    expect(fromSelect()).toHaveFocus();
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  });

  it("closes on click outside", async () => {
    const user = userEvent.setup();
    renderChecker();
    await user.click(fromSelect());
    expect(fromSelect()).toHaveAttribute("aria-expanded", "true");
    await user.click(document.body);
    expect(fromSelect()).toHaveAttribute("aria-expanded", "false");
  });

  it("switches the pair when another section dispatches cryptix:select-pair (reverse pairs included)", () => {
    renderChecker();
    act(() => {
      window.dispatchEvent(new CustomEvent(SELECT_PAIR_EVENT, { detail: { pairId: "ETH_BTC" } }));
    });
    expect(fromSelect()).toHaveTextContent("ETH");
    expect(toSelect()).toHaveTextContent("BTC");
    expect(marketRow()).toHaveTextContent(new RegExp(`1 ETH = ${marketText("ETH_BTC").replace(".", "\\.")}`));
    expect(screen.getByText("-0.42%")).toBeInTheDocument();
    // BTC_USDT is a supported reverse pair.
    act(() => {
      window.dispatchEvent(new CustomEvent(SELECT_PAIR_EVENT, { detail: { pairId: "BTC_USDT" } }));
    });
    expect(fromSelect()).toHaveTextContent("BTC");
    expect(toSelect()).toHaveTextContent("USDT");
    expect(ourRow()).toHaveTextContent(/1 BTC = 95,238\.10 USDT/);
    // Garbage is ignored.
    act(() => {
      window.dispatchEvent(new CustomEvent(SELECT_PAIR_EVENT, { detail: { pairId: "ETH_SOL" } }));
    });
    expect(fromSelect()).toHaveTextContent("BTC");
  });

  it("preselects the pair from ?pair= on mount", () => {
    window.history.replaceState(null, "", "/?pair=USDT_IDR");
    renderChecker();
    expect(toSelect()).toHaveTextContent("IDR");
    expect(ourRow()).toHaveTextContent(/Rp15,700/);
  });
});

/* ------------------------------------------------------------------ */
/* Market states                                                       */
/* ------------------------------------------------------------------ */

describe("RateChecker — market states", () => {
  it("unavailable: shows the unavailable copy and —, hides numbers, retry refreshes, request stays enabled without a rate snapshot", async () => {
    const user = userEvent.setup();
    const { refresh } = setMarket({ status: "unavailable", connection: "polling", snapshot: null });
    renderChecker();
    expect(screen.getByText(en.rateChecker.unavailableTitle)).toBeInTheDocument();
    expect(screen.getByText(en.rateChecker.unavailableBody)).toBeInTheDocument();
    expect(within(toValue()).getByText("—")).toBeInTheDocument();
    expect(toValue()).toHaveTextContent(en.rateChecker.estimateUnavailable);
    expect(screen.queryAllByText("100,000.00 USDT")).toHaveLength(0);
    expect(screen.queryAllByText("0.00952381")).toHaveLength(0);
    expect(screen.queryByText("+5% FROM MARKET")).not.toBeInTheDocument();
    expect(screen.queryByText(en.rateChecker.marketRate)).not.toBeInTheDocument();
    expect(screen.getByText(en.common.unavailable)).toBeInTheDocument();
    // The full disclaimer falls back to the default spread; the short one stays.
    expect(screen.getByText(interpolate(en.disclaimer.full, { spread: "5%" }))).toBeInTheDocument();
    expect(screen.getByText(en.rateChecker.disclaimer)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: en.common.retry }));
    expect(refresh).toHaveBeenCalledTimes(1);

    await user.click(requestButton());
    expect(screen.getByTestId("probe")).toHaveAttribute("data-open", "true");
    expect(readPrefill()).toEqual({ pairId: "USDT_BTC", amount: 1000 });

    // WhatsApp message carries the pair and amount but no estimate line.
    const link = screen.getByRole("link", { name: en.rateChecker.chatOnWhatsApp });
    const message = decodeURIComponent((link.getAttribute("href") ?? "").split("?text=")[1] ?? "");
    expect(message).toContain("USDT → BTC");
    expect(message).toContain("1,000 USDT");
    expect(message).not.toContain(en.whatsapp.exchangeInquiry.estimateLabel);
  });

  it("before the first snapshot: skeleton and Loading… instead of the unavailable copy", () => {
    setMarket({ status: "unavailable", connection: "connecting", snapshot: null });
    renderChecker();
    expect(screen.getByTestId("rate-lines-loading")).toBeInTheDocument();
    expect(screen.queryByText(en.rateChecker.unavailableTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(en.common.unavailable)).not.toBeInTheDocument();
    expect(screen.getAllByText(en.common.loading).length).toBeGreaterThan(0);
    expect(within(toValue()).getByText("—")).toBeInTheDocument();
    expect(screen.queryAllByText("100,000.00 USDT")).toHaveLength(0);
    // The visitor can still request an exchange or chat while data loads.
    expect(requestButton()).toBeEnabled();
  });

  it("stale: keeps the numbers but shows the last-updated note", () => {
    const staleAt = new Date(NOW.getTime() - 120_000).toISOString();
    setMarket({ status: "stale", snapshot: snapshot({ status: "stale", updatedAt: staleAt }) });
    renderChecker();
    expect(marketRow()).toHaveTextContent(/100,000\.00 USDT/);
    expect(within(toValue()).getByText("0.00952381")).toBeInTheDocument();
    // The note describes the SHOWN rate's own timestamp (the fixture rates carry UPDATED_AT).
    const note = interpolate(en.rateChecker.staleNote, { time: formatRelativeTime("en", UPDATED_AT) });
    expect(screen.getByText(note)).toBeInTheDocument();
    expect(screen.getByText(en.common.lastUpdated)).toBeInTheDocument();
  });

  it("polling / offline / reconnecting: fresh numbers stay visible with the connection note", () => {
    setMarket({ connection: "polling" });
    const first = renderChecker();
    expect(screen.getByText(en.market.pollingNote)).toBeInTheDocument();
    expect(marketRow()).toHaveTextContent(/100,000\.00 USDT/);
    expect(screen.getByText(en.common.reconnecting)).toBeInTheDocument();
    first.unmount();

    setMarket({ connection: "offline" });
    const second = renderChecker();
    expect(screen.getByText(en.market.offlineNote)).toBeInTheDocument();
    expect(screen.queryByText(en.market.pollingNote)).not.toBeInTheDocument();
    second.unmount();

    // A reconnecting stream is stated once, on the indicator.
    setMarket({ connection: "reconnecting" });
    renderChecker();
    expect(screen.getAllByText(en.common.reconnecting)).toHaveLength(1);
    expect(screen.queryByText(en.market.pollingNote)).not.toBeInTheDocument();
    expect(screen.queryByText(en.market.offlineNote)).not.toBeInTheDocument();
    expect(marketRow()).toHaveTextContent(/100,000\.00 USDT/);
  });

  it("uses the snapshot spread for the badge, our rate, the explainer and the disclaimer", () => {
    setMarket({ snapshot: snapshot({ spread: 0.03, rates: computeIndicativeRates(QUOTES, 0.03) }) });
    renderChecker();
    expect(screen.getByText("+3% FROM MARKET")).toBeInTheDocument();
    expect(ourRow()).toHaveTextContent(/1 BTC = 103,000\.00 USDT/);
    expect(screen.getByRole("tooltip", { hidden: true })).toHaveTextContent(interpolate(en.rateChecker.spreadExplainer, { spread: "3%" }));
    expect(screen.getByText(interpolate(en.disclaimer.full, { spread: "3%" }))).toBeInTheDocument();
    expect(within(toValue()).getByText(formatAmount("en", 1000 / 103_000, "BTC", { withSymbol: false }))).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

describe("RateChecker — actions", () => {
  it("Request exchange opens the modal with pair, amount, estimate and the indicative rate snapshot", async () => {
    const user = userEvent.setup();
    renderChecker();
    const probe = screen.getByTestId("probe");
    expect(probe).toHaveAttribute("data-open", "false");
    const before = Date.now();
    await user.click(requestButton());
    expect(probe).toHaveAttribute("data-open", "true");
    const prefill = readPrefill();
    expect(prefill?.pairId).toBe("USDT_BTC");
    expect(prefill?.amount).toBe(1000);
    expect(prefill?.estimatedReceive).toBeCloseTo(calculateReceive(rateFor("USDT_BTC"), 1000), 12);
    expect(prefill?.rateSnapshot).toMatchObject({
      marketPriceDisplay: 100_000,
      ourPriceDisplay: 105_000,
      quoteBase: "BTC",
      quoteCurrency: "USDT",
      spread: 0.05,
    });
    const capturedAt = Date.parse(prefill?.rateSnapshot?.capturedAt ?? "");
    expect(Number.isNaN(capturedAt)).toBe(false);
    expect(capturedAt).toBeGreaterThanOrEqual(before - 1);
    expect(capturedAt).toBeLessThanOrEqual(Date.now() + 1);
  });

  it("after a swap the prefill describes the reverse pair", async () => {
    const user = userEvent.setup();
    renderChecker();
    await user.click(swapButton());
    await user.click(requestButton());
    const prefill = readPrefill();
    expect(prefill?.pairId).toBe("BTC_USDT");
    expect(prefill?.amount).toBe(0.00952381);
    expect(prefill?.estimatedReceive).toBeCloseTo(calculateReceive(rateFor("BTC_USDT"), 0.00952381), 9);
    expect(prefill?.rateSnapshot).toMatchObject({ quoteBase: "BTC", quoteCurrency: "USDT", marketPriceDisplay: 100_000 });
    expect(prefill?.rateSnapshot?.ourPriceDisplay).toBeCloseTo(100_000 / 1.05, 6);
  });

  it("WhatsApp link carries the localized inquiry for the current pair, amount and estimate", () => {
    renderChecker();
    const link = screen.getByRole("link", { name: en.rateChecker.chatOnWhatsApp });
    const href = link.getAttribute("href") ?? "";
    expect(href.startsWith("https://wa.me/6281234567890?text=")).toBe(true);
    expect(href).toContain(encodeURIComponent("USDT → BTC"));
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    const message = decodeURIComponent(href.split("?text=")[1]);
    expect(message).toContain(`${en.whatsapp.exchangeInquiry.amountLabel}: 1,000 USDT`);
    expect(message).toContain(`${en.whatsapp.exchangeInquiry.estimateLabel}: 0.00952381 BTC`);
  });

  it("falls back to #contact when WhatsApp is not configured", () => {
    site.whatsappNumber = "";
    renderChecker();
    const link = screen.getByRole("link", { name: en.rateChecker.chatOnWhatsApp });
    expect(link).toHaveAttribute("href", "#contact");
    expect(link).not.toHaveAttribute("target");
  });
});
