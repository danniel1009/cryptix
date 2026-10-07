import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Footer } from "@/components/layout/Footer";
import { interpolate } from "@/lib/i18n/dictionaries";
import { en } from "@/lib/i18n/dictionaries/en";
import { LOCALE_COOKIE } from "@/lib/i18n/types";
import type { MarketContextValue } from "@/providers/MarketProvider";
import { renderWithProviders, TEST_RUNTIME_CONFIG, UNCONFIGURED_RUNTIME_CONFIG } from "@/test/renderWithProviders";

/** The footer only reads `snapshot?.spread`; no market data is fine. */
const market: MarketContextValue = {
  snapshot: null,
  connection: "connecting",
  status: "unavailable",
  lastUpdatedAt: null,
  isStale: false,
  refresh: vi.fn(),
  getRate: () => undefined,
  getQuote: () => undefined,
};
vi.mock("@/providers/MarketProvider", () => ({
  useMarket: () => market,
  MarketProvider: ({ children }: { children: React.ReactNode }) => children,
}));

/** The contact column's list — the navigation column also carries a "Contact" → #contact link, so never query the page. */
function contactColumn(): HTMLElement {
  const list = screen.getByRole("heading", { name: en.footer.contactTitle }).nextElementSibling;
  if (!(list instanceof HTMLElement)) throw new Error("contact column list not found");
  return list;
}
const whatsappLink = () => within(contactColumn()).queryByRole("link", { name: en.footer.whatsapp });
const mailto = () => contactColumn().querySelector<HTMLAnchorElement>('a[href^="mailto:"]');
const fallbackLink = () => within(contactColumn()).queryByRole("link", { name: en.nav.contact });

beforeEach(() => {
  document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0`;
});

describe("Footer — contact column", () => {
  it("links WhatsApp (provider number, general inquiry, new tab) and the provider e-mail", () => {
    renderWithProviders(<Footer />, { runtime: TEST_RUNTIME_CONFIG });

    const wa = whatsappLink();
    expect(wa).not.toBeNull();
    const href = wa?.getAttribute("href") ?? "";
    expect(href.startsWith("https://wa.me/6281234567890?text=")).toBe(true);
    expect(decodeURIComponent(href.split("?text=")[1])).toBe(
      interpolate(en.whatsapp.generalInquiry, { brand: "Cryptix" }),
    );
    expect(wa).toHaveAttribute("target", "_blank");
    expect(wa).toHaveAttribute("rel", "noopener noreferrer");

    expect(mailto()?.getAttribute("href")).toBe("mailto:hello@example.com");
    expect(mailto()).toHaveTextContent("hello@example.com");
    expect(fallbackLink()).toBeNull();
  });

  it("reflects a different runtime number and e-mail (not build-time constants)", () => {
    renderWithProviders(<Footer />, { runtime: { whatsappNumber: "6282317600972", contactEmail: "desk@example.com" } });
    expect(whatsappLink()?.getAttribute("href")?.startsWith("https://wa.me/6282317600972?text=")).toBe(true);
    expect(mailto()?.getAttribute("href")).toBe("mailto:desk@example.com");
  });

  it("omits the mailto link when the e-mail is empty but WhatsApp is configured", () => {
    renderWithProviders(<Footer />, { runtime: { whatsappNumber: "6282317600972", contactEmail: "" } });
    expect(whatsappLink()).not.toBeNull();
    expect(mailto()).toBeNull();
    expect(fallbackLink()).toBeNull();
  });

  it("shows only the #contact fallback when neither channel is configured", () => {
    renderWithProviders(<Footer />, { runtime: UNCONFIGURED_RUNTIME_CONFIG });
    expect(whatsappLink()).toBeNull();
    expect(mailto()).toBeNull();
    expect(fallbackLink()).toHaveAttribute("href", "#contact");
  });
});
