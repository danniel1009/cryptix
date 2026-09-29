import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Faq } from "@/components/sections/Faq";
import { buildFaqJsonLd } from "@/components/sections/faq/FaqJsonLd";
import { DEFAULT_EXCHANGE_SPREAD, type PairId } from "@/config/exchange";
import { interpolate } from "@/lib/i18n/dictionaries";
import { en } from "@/lib/i18n/dictionaries/en";
import { id } from "@/lib/i18n/dictionaries/id";
import { I18nProvider, useI18n } from "@/lib/i18n/provider";
import { LOCALE_COOKIE } from "@/lib/i18n/types";
import { computeIndicativeRates } from "@/lib/market/rates";
import type { MarketQuote, MarketSnapshot } from "@/lib/market/types";
import { ExchangeRequestProvider, useExchangeRequest } from "@/providers/ExchangeRequestProvider";
import type { MarketContextValue } from "@/providers/MarketProvider";

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const NOW = "2026-09-29T08:00:00.000Z";

const QUOTES: MarketQuote[] = [
  { base: "BTC", quote: "USDT", price: 100_000, change24hPct: 1.2, updatedAt: NOW, source: "binance" },
  { base: "ETH", quote: "BTC", price: 0.03, change24hPct: -0.4, updatedAt: NOW, source: "binance" },
  { base: "SOL", quote: "BTC", price: 0.00172, change24hPct: 2.1, updatedAt: NOW, source: "binance" },
  { base: "USDT", quote: "IDR", price: 16_485, change24hPct: 0.05, updatedAt: NOW, source: "indodax" },
];

function makeSnapshot(spread = 0.05): MarketSnapshot {
  return {
    status: "live",
    generatedAt: NOW,
    updatedAt: NOW,
    spread,
    quotes: QUOTES,
    rates: computeIndicativeRates(QUOTES, spread),
    sources: ["binance", "indodax"],
    error: null,
  };
}

/** Mutable so individual tests can swap the snapshot (reset in beforeEach). */
const mockMarket: MarketContextValue = {
  snapshot: makeSnapshot(),
  connection: "live",
  status: "live",
  lastUpdatedAt: new Date(NOW),
  isStale: false,
  refresh: vi.fn(),
  getRate: (pairId: PairId) => mockMarket.snapshot?.rates.find((r) => r.pairId === pairId),
  getQuote: () => undefined,
};

vi.mock("@/providers/MarketProvider", () => ({
  useMarket: () => mockMarket,
  MarketProvider: ({ children }: { children: ReactNode }) => children,
}));

/** WhatsApp number under test control (env-independent). */
const siteState = { whatsappNumber: "" };

vi.mock("@/config/site", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/site")>();
  return {
    ...actual,
    siteConfig: {
      ...actual.siteConfig,
      get whatsappNumber() {
        return siteState.whatsappNumber;
      },
    },
  };
});

/* ------------------------------------------------------------------ */
/* Environment                                                         */
/* ------------------------------------------------------------------ */

beforeAll(() => {
  // jsdom has no IntersectionObserver; framer-motion's `whileInView` (used by
  // <Reveal>) constructs one unguarded. Stub it to report "in view" at once.
  if (typeof IntersectionObserver === "undefined") {
    class IntersectionObserverStub {
      readonly root = null;
      readonly rootMargin = "";
      readonly thresholds: number[] = [];
      constructor(private readonly callback: IntersectionObserverCallback) {}
      observe(target: Element) {
        const entry = {
          target,
          isIntersecting: true,
          intersectionRatio: 1,
          time: 0,
          boundingClientRect: target.getBoundingClientRect(),
          intersectionRect: target.getBoundingClientRect(),
          rootBounds: null,
        } as IntersectionObserverEntry;
        this.callback([entry], this as unknown as IntersectionObserver);
      }
      unobserve() {}
      disconnect() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }
    vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
  }
});

beforeEach(() => {
  mockMarket.snapshot = makeSnapshot();
  siteState.whatsappNumber = "";
  document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0`;
});

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Observes the modal state so the CTA test asserts an outcome, not a wiring. */
function ModalProbe() {
  const { isOpen } = useExchangeRequest();
  return <span data-testid="modal-state">{isOpen ? "open" : "closed"}</span>;
}

/** Switches the provider locale the way the LanguageSwitcher would. */
function LocaleSwitch() {
  const { setLocale } = useI18n();
  return (
    <button type="button" onClick={() => setLocale("id")}>
      switch-to-id
    </button>
  );
}

function renderFaq() {
  return render(
    <I18nProvider initialLocale="en">
      <ExchangeRequestProvider>
        <Faq />
        <ModalProbe />
        <LocaleSwitch />
      </ExchangeRequestProvider>
    </I18nProvider>,
  );
}

const SPREAD_5 = "5%";
const enQuestion = (i: number, spread = SPREAD_5) => interpolate(en.faq.items[i].question, { spread });
const enAnswer = (i: number, spread = SPREAD_5) => interpolate(en.faq.items[i].answer, { spread });

function readJsonLd(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]');
  expect(script).not.toBeNull();
  return JSON.parse(script!.textContent ?? "") as {
    "@context": string;
    "@type": string;
    inLanguage?: string;
    mainEntity: { "@type": string; name: string; acceptedAnswer: { "@type": string; text: string } }[];
  };
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe("Faq section", () => {
  it("fixture sanity: 8 items, spread placeholders exist, en and id differ", () => {
    expect(en.faq.items).toHaveLength(8);
    expect(en.faq.items.some((i) => i.answer.includes("{spread}"))).toBe(true);
    expect(en.faq.items[2].question).toContain("{spread}");
    expect(en.faq.items[0].question).not.toBe(id.faq.items[0].question);
  });

  it("renders the section landmark with its heading and all 8 questions in order", () => {
    const { container } = renderFaq();
    const section = container.querySelector("section#faq");
    expect(section).not.toBeNull();
    const heading = screen.getByRole("heading", { level: 2, name: en.faq.title });
    expect(section).toHaveAttribute("aria-labelledby", heading.id);
    expect(screen.getByText(en.faq.description)).toBeInTheDocument();

    const questionHeadings = screen.getAllByRole("heading", { level: 3 });
    expect(questionHeadings).toHaveLength(8);
    questionHeadings.forEach((h3, i) => {
      // The mono index ("01") is aria-hidden, so the accessible name is the question alone.
      expect(within(h3).getByRole("button")).toHaveAccessibleName(enQuestion(i));
    });
  });

  it("opens the first item by default and keeps the others closed", () => {
    renderFaq();
    const first = screen.getByRole("button", { name: enQuestion(0) });
    expect(first).toHaveAttribute("aria-expanded", "true");
    expect(within(screen.getByRole("region", { name: enQuestion(0) })).getByText(enAnswer(0))).toBeInTheDocument();
    expect(screen.queryByText(enAnswer(1))).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: enQuestion(1) })).toHaveAttribute("aria-expanded", "false");
  });

  it("clicking the 2nd question expands its answer with the spread interpolated", async () => {
    const user = userEvent.setup();
    renderFaq();
    const second = screen.getByRole("button", { name: enQuestion(1) });

    await user.click(second);

    expect(second).toHaveAttribute("aria-expanded", "true");
    const region = screen.getByRole("region", { name: enQuestion(1) });
    const answer = within(region).getByText(enAnswer(1));
    expect(answer).toBeInTheDocument();
    expect(answer.textContent).toContain(SPREAD_5);
    expect(answer.textContent).not.toContain("{spread}");
    // Single-open accordion: the default item closed.
    expect(screen.getByRole("button", { name: enQuestion(0) })).toHaveAttribute("aria-expanded", "false");
  });

  it("interpolates the spread into a question ('Market price + 5%') and leaves no raw placeholder", () => {
    const { container } = renderFaq();
    expect(screen.getByRole("button", { name: 'What does "Market price + 5%" mean?' })).toBeInTheDocument();
    expect(container.textContent).not.toContain("{spread}");
  });

  it("takes the spread from the market snapshot, falling back to the default without one", () => {
    mockMarket.snapshot = makeSnapshot(0.07);
    const first = renderFaq();
    expect(screen.getByRole("button", { name: enQuestion(2, "7%") })).toBeInTheDocument();
    expect(readJsonLd(first.container).mainEntity[1].acceptedAnswer.text).toBe(enAnswer(1, "7%"));
    first.unmount();

    mockMarket.snapshot = null;
    const second = renderFaq();
    expect(DEFAULT_EXCHANGE_SPREAD).toBe(0.05);
    expect(screen.getByRole("button", { name: enQuestion(2, SPREAD_5) })).toBeInTheDocument();
    expect(readJsonLd(second.container).mainEntity[1].acceptedAnswer.text).toBe(enAnswer(1, SPREAD_5));
  });

  it("renders FAQPage JSON-LD that parses with 8 interpolated mainEntity entries", () => {
    const { container } = renderFaq();
    const data = readJsonLd(container);
    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@type"]).toBe("FAQPage");
    expect(data.inLanguage).toBe("en-US");
    expect(data.mainEntity).toHaveLength(8);
    data.mainEntity.forEach((entity, i) => {
      expect(entity["@type"]).toBe("Question");
      expect(entity.name).toBe(enQuestion(i));
      expect(entity.acceptedAnswer["@type"]).toBe("Answer");
      expect(entity.acceptedAnswer.text).toBe(enAnswer(i));
    });
    expect(JSON.stringify(data)).not.toContain("{spread}");
  });

  it("buildFaqJsonLd escapes '<' so '</script>' can never close the tag, and still round-trips", () => {
    const items = [{ question: "Is <b>this</b> safe?", answer: "Yes </script><script>alert(1)</script> \u2028 done" }];
    const raw = buildFaqJsonLd(items, "id");
    expect(raw).not.toContain("<");
    expect(raw).not.toContain("</script");
    expect(raw).not.toContain("\u2028");
    const parsed = JSON.parse(raw) as { inLanguage: string; mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
    expect(parsed.inLanguage).toBe("id-ID");
    expect(parsed.mainEntity[0].name).toBe(items[0].question);
    expect(parsed.mainEntity[0].acceptedAnswer.text).toBe(items[0].answer);
  });

  it("primary CTA opens the exchange request modal", async () => {
    const user = userEvent.setup();
    renderFaq();
    expect(screen.getByTestId("modal-state")).toHaveTextContent("closed");

    await user.click(screen.getByRole("button", { name: en.common.requestExchange }));

    expect(screen.getByTestId("modal-state")).toHaveTextContent("open");
  });

  it("WhatsApp CTA falls back to #contact (same tab) when no number is configured", () => {
    renderFaq();
    const link = screen.getByRole("link", { name: en.common.chatOnWhatsApp });
    expect(link).toHaveAttribute("href", "#contact");
    expect(link).not.toHaveAttribute("target");
    expect(link).not.toHaveAttribute("rel");
  });

  it("WhatsApp CTA opens wa.me with the localised general inquiry when configured", () => {
    siteState.whatsappNumber = "6281234567890";
    renderFaq();
    const link = screen.getByRole("link", { name: en.common.chatOnWhatsApp });
    const href = link.getAttribute("href") ?? "";
    expect(href.startsWith("https://wa.me/6281234567890?text=")).toBe(true);
    const message = decodeURIComponent(href.split("?text=")[1]);
    expect(message).toBe(interpolate(en.whatsapp.generalInquiry, { brand: "Cryptix" }));
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows the 'more help' line with a link to #contact", () => {
    renderFaq();
    expect(screen.getByText(en.faq.moreHelp, { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: en.faq.moreHelpCta })).toHaveAttribute("href", "#contact");
  });

  it("switching to Indonesian changes the first question, the CTA labels and the JSON-LD", async () => {
    const user = userEvent.setup();
    const { container } = renderFaq();
    expect(screen.getByRole("button", { name: enQuestion(0) })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "switch-to-id" }));

    const idQuestion0 = interpolate(id.faq.items[0].question, { spread: SPREAD_5 });
    expect(screen.getByRole("button", { name: idQuestion0 })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: enQuestion(0) })).not.toBeInTheDocument();
    // The first panel stays open across the switch (stable ids) and shows the Indonesian answer.
    expect(screen.getByRole("button", { name: idQuestion0 })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(interpolate(id.faq.items[0].answer, { spread: SPREAD_5 }))).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: id.faq.title })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: id.common.requestExchange })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: id.faq.moreHelpCta })).toHaveAttribute("href", "#contact");

    const data = readJsonLd(container);
    expect(data.inLanguage).toBe("id-ID");
    expect(data.mainEntity[0].name).toBe(idQuestion0);
    expect(data.mainEntity[2].name).toBe(interpolate(id.faq.items[2].question, { spread: SPREAD_5 }));
  });
});
