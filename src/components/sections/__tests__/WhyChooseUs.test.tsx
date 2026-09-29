import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { WhyChooseUs } from "@/components/sections/WhyChooseUs";
import { en } from "@/lib/i18n/dictionaries/en";
import { id } from "@/lib/i18n/dictionaries/id";
import { I18nProvider, useI18n } from "@/lib/i18n/provider";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/types";

/* jsdom has neither IntersectionObserver (framer whileInView) nor matchMedia. */
class MockIntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: readonly number[] = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

beforeAll(() => {
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
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
  document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0`;
});

/** Lets a test flip the provider locale the way the LanguageSwitcher does. */
function LocaleProbe() {
  const { setLocale, locale } = useI18n();
  return (
    <button type="button" onClick={() => setLocale(locale === "en" ? "id" : "en")}>
      toggle-locale
    </button>
  );
}

function renderSection(initialLocale: Locale = "en") {
  return render(
    <I18nProvider initialLocale={initialLocale}>
      <WhyChooseUs />
      <LocaleProbe />
    </I18nProvider>,
  );
}

function featureItems(): HTMLElement[] {
  return within(screen.getByRole("list")).getAllByRole("listitem");
}

describe("WhyChooseUs", () => {
  it("has distinct English and Indonesian copy for the probe keys", () => {
    expect(en.whyChooseUs.statement).not.toBe(id.whyChooseUs.statement);
    expect(en.whyChooseUs.title).not.toBe(id.whyChooseUs.title);
    en.whyChooseUs.items.forEach((item, i) => {
      expect(item.title).not.toBe(id.whyChooseUs.items[i].title);
    });
  });

  it("renders the #why section labelled by its h2", () => {
    renderSection();
    const section = document.getElementById("why");
    expect(section).not.toBeNull();
    expect(section?.tagName).toBe("SECTION");
    const heading = screen.getByRole("heading", { level: 2, name: en.whyChooseUs.title });
    expect(section).toHaveAttribute("aria-labelledby", heading.id);
    expect(screen.getByText(en.whyChooseUs.eyebrow)).toBeInTheDocument();
    expect(screen.getByText(en.whyChooseUs.description)).toBeInTheDocument();
  });

  it("opens with the big centred statement, before the heading", () => {
    renderSection();
    const statement = screen.getByText(en.whyChooseUs.statement);
    expect(statement.tagName).toBe("P");
    const heading = screen.getByRole("heading", { level: 2 });
    // Statement precedes the heading in document order.
    expect(statement.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders the four value propositions in order, each with an icon well", () => {
    renderSection();
    const items = featureItems();
    expect(items).toHaveLength(4);
    en.whyChooseUs.items.forEach((item, i) => {
      const cell = items[i];
      expect(within(cell).getByRole("heading", { level: 3 })).toHaveTextContent(item.title);
      expect(within(cell).getByText(item.body)).toBeInTheDocument();
      const icon = cell.querySelector("svg");
      expect(icon).not.toBeNull();
      expect(icon?.closest('[aria-hidden="true"]')).not.toBeNull();
    });
    const h3s = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(h3s).toEqual(en.whyChooseUs.items.map((i) => i.title));
  });

  it("switches the statement, heading and items to Indonesian", async () => {
    const user = userEvent.setup();
    renderSection();
    expect(screen.getByText(en.whyChooseUs.statement)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "toggle-locale" }));

    expect(screen.getByText(id.whyChooseUs.statement)).toBeInTheDocument();
    expect(screen.queryByText(en.whyChooseUs.statement)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(id.whyChooseUs.title);
    const h3s = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(h3s).toEqual(id.whyChooseUs.items.map((i) => i.title));
  });

  it("renders Indonesian from an Indonesian start", () => {
    renderSection("id");
    expect(screen.getByText(id.whyChooseUs.statement)).toBeInTheDocument();
    expect(featureItems()).toHaveLength(4);
  });
});
