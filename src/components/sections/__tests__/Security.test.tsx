import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Security } from "@/components/sections/Security";
import { SECURITY_ITEM_ICONS } from "@/components/sections/security/icons";
import { en } from "@/lib/i18n/dictionaries/en";
import { id } from "@/lib/i18n/dictionaries/id";
import { I18nProvider, useI18n } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/types";

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

function LocaleProbe() {
  const { setLocale } = useI18n();
  return (
    <button type="button" onClick={() => setLocale("id")}>
      switch-to-id
    </button>
  );
}

function renderSecurity(locale: Locale = "en") {
  return render(
    <I18nProvider initialLocale={locale}>
      <Security />
      <LocaleProbe />
    </I18nProvider>,
  );
}

/** Phrases the section must never contain, whatever the dictionary says (docs/ARCHITECTURE.md). */
const FORBIDDEN = [/100%/i, /bank[- ]grade/i, /licen[cs]ed/i, /guarantee/i, /regulat/i, /berlisensi/i, /dijamin/i];

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Security", () => {
  it("has one icon per dictionary item", () => {
    expect(SECURITY_ITEM_ICONS).toHaveLength(en.security.items.length);
    expect(en.security.items).toHaveLength(6);
  });

  it("renders the section with the navigation id, a labelled h2 and the description", () => {
    renderSecurity();
    const section = document.getElementById("security");
    expect(section).not.toBeNull();
    expect(section?.tagName).toBe("SECTION");
    const heading = screen.getByRole("heading", { level: 2, name: en.security.title });
    expect(section).toHaveAttribute("aria-labelledby", heading.id);
    expect(screen.getByText(en.security.description)).toBeInTheDocument();
  });

  it("renders the six item titles and bodies in dictionary order", () => {
    renderSecurity();
    const titles = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(en.security.items.map((item) => item.title));
    for (const item of en.security.items) {
      expect(screen.getByText(item.body)).toBeInTheDocument();
    }
    // Six list cells, each with an icon well.
    const cells = screen.getAllByRole("listitem");
    expect(cells).toHaveLength(6);
    for (const cell of cells) {
      expect(cell.querySelector("svg")).not.toBeNull();
    }
  });

  it("renders the no-custody / manual-confirmation note", () => {
    renderSecurity();
    expect(screen.getByText(en.security.note)).toBeInTheDocument();
  });

  it("makes no regulatory, licensing or absolute safety claims", () => {
    const { container } = renderSecurity();
    const text = container.textContent ?? "";
    for (const pattern of FORBIDDEN) {
      expect(text).not.toMatch(pattern);
    }
  });

  it("renders in Indonesian", () => {
    expect(id.security.title).not.toBe(en.security.title);
    renderSecurity("id");
    expect(screen.getByRole("heading", { level: 2, name: id.security.title })).toBeInTheDocument();
    const titles = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(id.security.items.map((item) => item.title));
    expect(screen.getByText(id.security.note)).toBeInTheDocument();
  });

  it("switches from English to Indonesian when the locale changes", async () => {
    const user = userEvent.setup();
    renderSecurity("en");
    expect(screen.getByText(en.security.note)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "switch-to-id" }));
    expect(screen.getByRole("heading", { level: 2, name: id.security.title })).toBeInTheDocument();
    expect(screen.getByText(id.security.note)).toBeInTheDocument();
    expect(screen.queryByText(en.security.note)).not.toBeInTheDocument();
  });
});
