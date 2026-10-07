import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hero } from "@/components/sections/Hero";
import { en } from "@/lib/i18n/dictionaries/en";
import { id } from "@/lib/i18n/dictionaries/id";
import { I18nProvider, useI18n } from "@/lib/i18n/provider";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/types";
import { computeIndicativeRates } from "@/lib/market/rates";
import type { MarketQuote, MarketSnapshot } from "@/lib/market/types";
import type { MarketContextValue } from "@/providers/MarketProvider";
import { RuntimeConfigProvider, type RuntimePublicConfig } from "@/providers/RuntimeConfigProvider";

/* ------------------------------------------------------------------ */
/* Mocks                                                               */
/* ------------------------------------------------------------------ */

const mocks = vi.hoisted(() => ({
  /** Set per test before rendering; read lazily by the mocked hook. */
  market: { value: null as MarketContextValue | null },
}));

/** Runtime contact config under test control — set before rendering, read by <RuntimeConfigProvider>. */
const runtime: RuntimePublicConfig = { whatsappNumber: "", contactEmail: "" };

vi.mock("@/providers/MarketProvider", () => ({
  useMarket: () => {
    if (!mocks.market.value) throw new Error("test did not set the market mock");
    return mocks.market.value;
  },
  MarketProvider: ({ children }: { children: React.ReactNode }) => children,
}));

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const NOW = new Date("2026-09-29T09:00:00.000Z");
const SPREAD = 0.05;

function buildSnapshot(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  const updatedAt = NOW.toISOString();
  const quotes: MarketQuote[] = [
    { base: "BTC", quote: "USDT", price: 100_000, change24hPct: 1.24, updatedAt, source: "binance" },
    { base: "ETH", quote: "BTC", price: 0.03, change24hPct: -0.42, updatedAt, source: "binance" },
    { base: "SOL", quote: "BTC", price: 0.00172, change24hPct: 2.1, updatedAt, source: "binance" },
    { base: "USDT", quote: "IDR", price: 16_485, change24hPct: 0.05, updatedAt, source: "indodax" },
  ];
  return {
    status: "live",
    generatedAt: updatedAt,
    updatedAt,
    spread: SPREAD,
    quotes,
    rates: computeIndicativeRates(quotes, SPREAD),
    sources: ["binance", "indodax"],
    error: null,
    ...overrides,
  };
}

function marketValue(overrides: Partial<MarketContextValue> = {}): MarketContextValue {
  const snapshot = buildSnapshot();
  return {
    snapshot,
    connection: "live",
    status: "live",
    lastUpdatedAt: NOW,
    isStale: false,
    refresh: vi.fn(),
    getRate: (pairId) => snapshot.rates.find((r) => r.pairId === pairId),
    getQuote: () => undefined,
    ...overrides,
  };
}

/** Lets a test flip the locale the way the LanguageSwitcher would. */
function LocaleProbe() {
  const { setLocale } = useI18n();
  return (
    <button type="button" onClick={() => setLocale("id")}>
      probe-switch-to-id
    </button>
  );
}

function renderHero(initialLocale: Locale = "en") {
  return render(
    <I18nProvider initialLocale={initialLocale}>
      <RuntimeConfigProvider value={runtime}>
        <Hero />
        <LocaleProbe />
        {/* Scroll targets the CTAs point at. */}
        <div id="exchange" />
        <div id="contact" />
      </RuntimeConfigProvider>
    </I18nProvider>,
  );
}

const heading = () => screen.getByRole("heading", { level: 1 });

beforeEach(() => {
  runtime.whatsappNumber = "";
  mocks.market.value = marketValue();
  document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0`;
  window.location.hash = "";
  // jsdom logs "not implemented" for scrollTo; we assert on the call instead.
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe("Hero — copy", () => {
  it("has distinct English and Indonesian headline copy (precondition)", () => {
    expect(en.hero.titleLine1).not.toBe(id.hero.titleLine1);
    expect(en.hero.titleLine2).not.toBe(id.hero.titleLine2);
  });

  it("renders the English headline as ONE h1 with both lines, plus subtitle and trust note", () => {
    renderHero();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(heading()).toHaveTextContent(en.hero.titleLine1);
    expect(heading()).toHaveTextContent(en.hero.titleLine2);
    expect(screen.getByText(en.hero.subtitle)).toBeInTheDocument();
    expect(screen.getByText(en.hero.trustNote)).toBeInTheDocument();
    expect(screen.getByText(en.hero.eyebrow)).toBeInTheDocument();
  });

  it("renders the section with id=top labelled by the headline", () => {
    const { container } = renderHero();
    const section = container.querySelector("section#top");
    expect(section).not.toBeNull();
    expect(section).toHaveAttribute("aria-labelledby", heading().id);
  });

  it("renders the three supporting points and the four process steps in order", () => {
    const { container } = renderHero();
    for (const point of en.hero.supporting) {
      expect(screen.getByText(point)).toBeInTheDocument();
    }
    const strip = container.querySelector("ol");
    expect(strip).not.toBeNull();
    const items = within(strip as HTMLElement).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    items.forEach((li, i) => {
      expect(li).toHaveTextContent(en.hero.processSteps[i]);
    });
  });

  it("switches to the Indonesian headline when the locale changes", async () => {
    const user = userEvent.setup();
    renderHero();
    expect(heading()).toHaveTextContent(en.hero.titleLine1);

    await user.click(screen.getByRole("button", { name: "probe-switch-to-id" }));

    expect(heading()).toHaveTextContent(id.hero.titleLine1);
    expect(heading()).toHaveTextContent(id.hero.titleLine2);
    expect(heading()).not.toHaveTextContent(en.hero.titleLine1);
    expect(screen.getByText(id.hero.subtitle)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: id.hero.ctaPrimary })).toBeInTheDocument();
    for (const step of id.hero.processSteps) {
      expect(screen.getByText(step)).toBeInTheDocument();
    }
  });

  it("renders Indonesian from the start when the initial locale is id", () => {
    renderHero("id");
    expect(heading()).toHaveTextContent(id.hero.titleLine1);
  });
});

describe("Hero — primary CTA", () => {
  it("is an anchor pointing at #exchange", () => {
    renderHero();
    const cta = screen.getByRole("link", { name: en.hero.ctaPrimary });
    expect(cta.tagName).toBe("A");
    expect(cta).toHaveAttribute("href", "#exchange");
    expect(cta).not.toHaveAttribute("target");
  });

  it("smooth-scrolls to the exchange section and updates the hash when clicked", async () => {
    const user = userEvent.setup();
    renderHero();
    await user.click(screen.getByRole("link", { name: en.hero.ctaPrimary }));

    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "smooth", top: expect.any(Number) }));
    expect(window.location.hash).toBe("#exchange");
  });
});

describe("Hero — secondary CTA", () => {
  it("links to wa.me with the localized general inquiry when WhatsApp is configured", () => {
    runtime.whatsappNumber = "6281234567890";
    renderHero();
    const cta = screen.getByRole("link", { name: en.hero.ctaSecondary });
    const href = cta.getAttribute("href") ?? "";
    expect(href.startsWith("https://wa.me/6281234567890?text=")).toBe(true);
    const message = decodeURIComponent(href.split("?text=")[1]);
    expect(message).toContain("Cryptix");
    expect(message).toBe(en.whatsapp.generalInquiry.replace("{brand}", "Cryptix"));
    expect(cta).toHaveAttribute("target", "_blank");
    expect(cta).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("uses the Indonesian message after switching locale", async () => {
    runtime.whatsappNumber = "6281234567890";
    const user = userEvent.setup();
    renderHero();
    await user.click(screen.getByRole("button", { name: "probe-switch-to-id" }));
    const cta = screen.getByRole("link", { name: id.hero.ctaSecondary });
    const message = decodeURIComponent((cta.getAttribute("href") ?? "").split("?text=")[1]);
    expect(message).toBe(id.whatsapp.generalInquiry.replace("{brand}", "Cryptix"));
  });

  it("falls back to #contact (same tab, scrolls) when WhatsApp is not configured", async () => {
    runtime.whatsappNumber = "";
    const user = userEvent.setup();
    renderHero();
    const cta = screen.getByRole("link", { name: en.hero.ctaSecondary });
    expect(cta).toHaveAttribute("href", "#contact");
    expect(cta).not.toHaveAttribute("target");
    expect(cta).not.toHaveAttribute("rel");

    await user.click(cta);
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe("#contact");
  });
});

describe("Hero — market status pill", () => {
  const status = () => screen.getByRole("status");

  it("says LIVE when the feed is live", () => {
    renderHero();
    expect(status()).toHaveTextContent(en.market.live);
  });

  it("flags a degraded connection while keeping fresh data (polling / reconnecting / offline)", () => {
    for (const connection of ["polling", "reconnecting", "offline"] as const) {
      mocks.market.value = marketValue({ connection });
      const { unmount } = renderHero();
      expect(status()).toHaveTextContent(en.market.reconnecting);
      unmount();
    }
  });

  it("says STALE when the data is stale", () => {
    mocks.market.value = marketValue({ status: "stale", isStale: true });
    renderHero();
    expect(status()).toHaveTextContent(en.market.stale);
  });

  it("says UNAVAILABLE when the data is unavailable — even if the transport is live", () => {
    mocks.market.value = marketValue({ status: "unavailable", connection: "live" });
    renderHero();
    expect(status()).toHaveTextContent(en.market.unavailable);
  });

  it("says Loading… before the first snapshot instead of flashing unavailable", () => {
    mocks.market.value = marketValue({
      snapshot: null,
      status: "unavailable",
      connection: "connecting",
      lastUpdatedAt: null,
    });
    renderHero();
    expect(status()).toHaveTextContent(en.common.loading);
    expect(status()).not.toHaveTextContent(en.market.unavailable);
  });

  it("localizes the status label", async () => {
    const user = userEvent.setup();
    mocks.market.value = marketValue({ connection: "polling" });
    renderHero();
    await user.click(screen.getByRole("button", { name: "probe-switch-to-id" }));
    expect(status()).toHaveTextContent(id.market.reconnecting);
  });
});

describe("Hero — decoration", () => {
  it("renders the background, sparkline and glow line as aria-hidden, non-interactive decoration", () => {
    const { container } = renderHero();
    const section = container.querySelector("section#top") as HTMLElement;
    const svg = section.querySelector("svg[aria-hidden='true'] path[d^='M']");
    expect(svg).not.toBeNull();
    const decorations = section.querySelectorAll(":scope > div[aria-hidden='true']");
    // Background wrapper + glow line, both hidden from AT and pointer-transparent.
    expect(decorations.length).toBeGreaterThanOrEqual(2);
    decorations.forEach((el) => expect(el.className).toContain("pointer-events-none"));
  });

  it("exposes exactly the two CTAs and the scroll hint as interactive controls", () => {
    renderHero();
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([en.hero.ctaPrimary, en.hero.ctaSecondary]);
    expect(screen.getByRole("button", { name: en.hero.scrollHint })).toBeInTheDocument();
  });
});
