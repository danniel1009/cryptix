import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { SEGMENT_DURATION } from "@/components/sections/how-it-works/ProcessSteps";
import { en } from "@/lib/i18n/dictionaries/en";
import { id } from "@/lib/i18n/dictionaries/id";
import { I18nProvider, useI18n } from "@/lib/i18n/provider";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/types";

/* ------------------------------------------------------------------ */
/* jsdom stubs: framer's whileInView / useInView need IntersectionObserver */
/* ------------------------------------------------------------------ */

const observers: MockIntersectionObserver[] = [];

class MockIntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: readonly number[] = [];
  private readonly targets = new Set<Element>();

  constructor(private readonly callback: IntersectionObserverCallback) {
    observers.push(this);
  }

  observe(target: Element) {
    this.targets.add(target);
  }
  unobserve(target: Element) {
    this.targets.delete(target);
  }
  disconnect() {
    this.targets.clear();
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  /** Fire an intersection for every observed element. */
  fire(isIntersecting: boolean) {
    const entries = Array.from(this.targets).map(
      (target) =>
        ({
          target,
          isIntersecting,
          intersectionRatio: isIntersecting ? 1 : 0,
          boundingClientRect: target.getBoundingClientRect(),
          intersectionRect: target.getBoundingClientRect(),
          rootBounds: null,
          time: 0,
        }) as IntersectionObserverEntry,
    );
    if (entries.length > 0) this.callback(entries, this as unknown as IntersectionObserver);
  }
}

/** Simulate every observed element scrolling into view. */
function enterViewport() {
  act(() => {
    for (const observer of [...observers]) observer.fire(true);
  });
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
  observers.length = 0;
  document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0`;
});

/* ------------------------------------------------------------------ */

/** Lets a test flip the provider locale the way the LanguageSwitcher does. */
function LocaleProbe() {
  const { setLocale, locale } = useI18n();
  return (
    <button type="button" data-locale={locale} onClick={() => setLocale(locale === "en" ? "id" : "en")}>
      toggle-locale
    </button>
  );
}

function renderSection(initialLocale: Locale = "en") {
  return render(
    <I18nProvider initialLocale={initialLocale}>
      <HowItWorks />
      <LocaleProbe />
    </I18nProvider>,
  );
}

function stepItems(): HTMLElement[] {
  const list = screen.getByRole("list");
  return within(list).getAllByRole("listitem");
}

function nodeOf(item: HTMLElement): HTMLElement {
  const node = item.querySelector<HTMLElement>("[data-step-node]");
  if (!node) throw new Error("step node missing");
  return node;
}

describe("HowItWorks", () => {
  it("has distinct English and Indonesian copy for the probe keys", () => {
    expect(en.howItWorks.title).not.toBe(id.howItWorks.title);
    en.howItWorks.steps.forEach((step, i) => {
      expect(step.title).not.toBe(id.howItWorks.steps[i].title);
    });
    expect(en.howItWorks.steps.map((s) => s.number)).toEqual(["01", "02", "03", "04"]);
  });

  it("renders the #how-it-works section labelled by its h2", () => {
    renderSection();
    const section = document.getElementById("how-it-works");
    expect(section).not.toBeNull();
    expect(section?.tagName).toBe("SECTION");
    const heading = screen.getByRole("heading", { level: 2, name: en.howItWorks.title });
    expect(section).toHaveAttribute("aria-labelledby", heading.id);
    expect(screen.getByText(en.howItWorks.eyebrow)).toBeInTheDocument();
    expect(screen.getByText(en.howItWorks.description)).toBeInTheDocument();
  });

  it("renders the four steps in order with 01…04, titles and bodies", () => {
    renderSection();
    const items = stepItems();
    expect(items).toHaveLength(4);
    en.howItWorks.steps.forEach((step, i) => {
      const item = items[i];
      expect(nodeOf(item)).toHaveTextContent(step.number);
      expect(within(item).getByRole("heading", { level: 3 })).toHaveTextContent(step.title);
      expect(within(item).getByText(step.body)).toBeInTheDocument();
    });
    // Titles appear in dictionary order in the DOM.
    const h3s = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(h3s).toEqual(en.howItWorks.steps.map((s) => s.title));
  });

  it("renders the manual-processing footnote", () => {
    renderSection();
    expect(screen.getByText(en.howItWorks.footnote)).toBeInTheDocument();
  });

  it("keeps the step numbers decorative (the list and card carry the semantics)", () => {
    renderSection();
    for (const item of stepItems()) {
      expect(nodeOf(item)).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("highlights only the final manual-exchange step", () => {
    renderSection();
    const cards = stepItems().map((item) => item.querySelector("[data-step-card]"));
    expect(cards.every((c) => c !== null)).toBe(true);
    expect(cards.map((c) => c?.getAttribute("data-highlight"))).toEqual(["false", "false", "false", "true"]);
    expect(cards[3]?.className).toContain("border-accent");
    expect(cards[0]?.className).not.toContain("border-accent");
  });

  it("fills the nodes in a stagger once the process scrolls into view", () => {
    renderSection();
    const nodes = stepItems().map(nodeOf);
    // Before the list is in view every node is idle.
    expect(nodes.map((n) => n.dataset.active)).toEqual(["false", "false", "false", "false"]);

    enterViewport();

    expect(nodes.map((n) => n.dataset.active)).toEqual(["true", "true", "true", "true"]);
    // The stagger follows the line: node i fills when segment i-1 finishes drawing.
    expect(nodes.map((n) => n.style.transitionDelay)).toEqual(
      [0, 1, 2, 3].map((i) => `${i * SEGMENT_DURATION}s`),
    );
    // Three connectors join four steps (one per orientation, both decorative).
    const connectors = stepItems().flatMap((item) =>
      Array.from(item.querySelectorAll(':scope > span[aria-hidden="true"]:not([data-step-node])')),
    );
    expect(connectors).toHaveLength(6);
  });

  it("switches every string to Indonesian when the locale changes", async () => {
    const user = userEvent.setup();
    renderSection();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(en.howItWorks.title);

    await user.click(screen.getByRole("button", { name: "toggle-locale" }));

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(id.howItWorks.title);
    expect(screen.getByText(id.howItWorks.description)).toBeInTheDocument();
    expect(screen.getByText(id.howItWorks.footnote)).toBeInTheDocument();
    const h3s = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(h3s).toEqual(id.howItWorks.steps.map((s) => s.title));
    expect(screen.queryByText(en.howItWorks.title)).not.toBeInTheDocument();
  });

  it("renders Indonesian from an Indonesian start", () => {
    renderSection("id");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(id.howItWorks.title);
    expect(stepItems()).toHaveLength(4);
  });
});
