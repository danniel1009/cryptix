import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlatformsStrip } from "@/components/sections/PlatformsStrip";
import { en } from "@/lib/i18n/dictionaries/en";
import { id } from "@/lib/i18n/dictionaries/id";
import { useI18n } from "@/lib/i18n/provider";
import { renderWithProviders } from "@/test/renderWithProviders";

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

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
});

function LocaleProbe() {
  const { setLocale } = useI18n();
  return <button onClick={() => setLocale("id")}>to-id</button>;
}

describe("PlatformsStrip", () => {
  it("lists the three settlement platforms as external links with official logos and the non-affiliation note", () => {
    renderWithProviders(<PlatformsStrip />);
    expect(screen.getByRole("heading", { level: 2, name: en.platforms.title })).toBeInTheDocument();
    for (const name of ["Binance", "Trust Wallet", "Indodax"]) {
      const img = screen.getByRole("img", { name });
      expect(img).toHaveAttribute("src", expect.stringMatching(/^\/platforms\//));
      const link = img.closest("a");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link?.getAttribute("rel")).toContain("noopener");
      expect(link?.getAttribute("rel")).toContain("nofollow");
    }
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText(en.platforms.note)).toBeInTheDocument();
    expect(screen.getByText(en.platforms.roles.wallet)).toBeInTheDocument();
  });

  it("switches to Indonesian", async () => {
    renderWithProviders(
      <>
        <PlatformsStrip />
        <LocaleProbe />
      </>,
    );
    await userEvent.click(screen.getByText("to-id"));
    expect(screen.getByRole("heading", { level: 2, name: id.platforms.title })).toBeInTheDocument();
    expect(screen.getByText(id.platforms.note)).toBeInTheDocument();
    expect(screen.getByText(id.platforms.roles.wallet)).toBeInTheDocument();
  });
});
