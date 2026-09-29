import { render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { I18nProvider } from "@/lib/i18n/provider";

/**
 * Framer initialises its reduced-motion probe once per module instance, so
 * this branch lives in its own file: `matchMedia` reports
 * `prefers-reduced-motion: reduce` before the first render.
 */
class IdleIntersectionObserver {
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
  vi.stubGlobal("IntersectionObserver", IdleIntersectionObserver);
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
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

describe("HowItWorks under prefers-reduced-motion", () => {
  it("shows the process complete without waiting for the viewport or a stagger", () => {
    render(
      <I18nProvider initialLocale="en">
        <HowItWorks />
      </I18nProvider>,
    );
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    const nodes = items.map((item) => item.querySelector<HTMLElement>("[data-step-node]"));
    // Nothing scrolled into view (the observer never fires), yet every node is filled at once.
    expect(nodes.map((n) => n?.dataset.active)).toEqual(["true", "true", "true", "true"]);
    expect(nodes.map((n) => n?.style.transitionDelay)).toEqual(["0s", "0s", "0s", "0s"]);
  });
});
