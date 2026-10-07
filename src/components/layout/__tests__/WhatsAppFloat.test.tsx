import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WhatsAppFloat } from "@/components/layout/WhatsAppFloat";
import { interpolate } from "@/lib/i18n/dictionaries";
import { en } from "@/lib/i18n/dictionaries/en";
import { id } from "@/lib/i18n/dictionaries/id";
import { LOCALE_COOKIE } from "@/lib/i18n/types";
import { renderWithProviders, TEST_RUNTIME_CONFIG, UNCONFIGURED_RUNTIME_CONFIG } from "@/test/renderWithProviders";

const link = (dict: typeof en = en) => screen.getByRole("link", { name: dict.whatsapp.floating.ariaLabel });
const messageOf = (href: string) => decodeURIComponent(href.split("?text=")[1] ?? "");

beforeEach(() => {
  document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0`;
  window.location.hash = "";
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WhatsAppFloat", () => {
  it("links to wa.me with the PROVIDER's number and the localised general inquiry (new tab)", () => {
    renderWithProviders(<WhatsAppFloat />, { runtime: TEST_RUNTIME_CONFIG });
    const href = link().getAttribute("href") ?? "";
    expect(href.startsWith("https://wa.me/6281234567890?text=")).toBe(true);
    expect(messageOf(href)).toBe(interpolate(en.whatsapp.generalInquiry, { brand: "Cryptix" }));
    expect(link()).toHaveAttribute("target", "_blank");
    expect(link()).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("a different runtime number changes the link — the number is not a build-time constant", () => {
    renderWithProviders(<WhatsAppFloat />, { runtime: { whatsappNumber: "6282317600972", contactEmail: "" } });
    expect(link().getAttribute("href")?.startsWith("https://wa.me/6282317600972?text=")).toBe(true);
  });

  it("uses the Indonesian message under the id locale", () => {
    renderWithProviders(<WhatsAppFloat />, { locale: "id" });
    expect(id.whatsapp.floating.ariaLabel).not.toBe(en.whatsapp.floating.ariaLabel); // precondition
    expect(messageOf(link(id).getAttribute("href") ?? "")).toBe(
      interpolate(id.whatsapp.generalInquiry, { brand: "Cryptix" }),
    );
  });

  it("falls back to #contact (same tab, smooth scroll) when no number is configured", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <WhatsAppFloat />
        <div id="contact" />
      </>,
      { runtime: UNCONFIGURED_RUNTIME_CONFIG },
    );
    expect(link()).toHaveAttribute("href", "#contact");
    expect(link()).not.toHaveAttribute("target");
    expect(link()).not.toHaveAttribute("rel");

    await user.click(link());
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe("#contact");
  });

  it("renders the fallback outside any provider (tests / stories never crash)", () => {
    renderWithProviders(<WhatsAppFloat />, { runtime: UNCONFIGURED_RUNTIME_CONFIG });
    expect(link()).toHaveAttribute("href", "#contact");
  });
});
