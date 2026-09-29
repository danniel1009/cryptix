"use client";

import { useCallback } from "react";
import { useReducedMotionSafe } from "@/hooks/useReducedMotionSafe";

/** Extra breathing room below the sticky header when scrolling to a section. */
export const SCROLL_EXTRA_OFFSET = 16;

export interface ScrollToOptions {
  /** Update `location.hash` (without the native jump). Default true. */
  updateHash?: boolean;
  behavior?: ScrollBehavior;
  /** Override the computed header offset (px). */
  offset?: number;
}

/** Height of the sticky header from the CSS variable set in globals.css. */
export function getHeaderOffset(): number {
  if (typeof window === "undefined") return 72 + SCROLL_EXTRA_OFFSET;
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--nav-h");
  const parsed = Number.parseFloat(raw);
  return (Number.isFinite(parsed) ? parsed : 72) + SCROLL_EXTRA_OFFSET;
}

/**
 * Scroll to `#id` (or the top when `id` is "" / "top") with the header offset.
 * Pure function so non-hook callers (event handlers outside React) can use it.
 */
export function scrollToId(id: string, options: ScrollToOptions = {}): boolean {
  if (typeof window === "undefined") return false;
  const { updateHash = true, behavior = "smooth", offset } = options;
  const clean = id.replace(/^#/, "");
  const isTop = clean === "" || clean === "top";
  const target = isTop ? null : document.getElementById(clean);
  if (!isTop && !target) return false;

  const top = target
    ? target.getBoundingClientRect().top + window.scrollY - (offset ?? getHeaderOffset())
    : 0;

  window.scrollTo({ top: Math.max(0, top), behavior });

  // Move focus with the scroll so keyboard / screen-reader users land in the section.
  const focusTarget = target ?? document.getElementById("main");
  if (focusTarget) {
    if (!focusTarget.hasAttribute("tabindex")) focusTarget.setAttribute("tabindex", "-1");
    focusTarget.focus({ preventScroll: true });
  }

  if (updateHash) {
    try {
      const url = isTop ? window.location.pathname + window.location.search : `#${clean}`;
      window.history.replaceState(window.history.state, "", url);
    } catch {
      /* history may be unavailable (sandboxed iframe) — scrolling already happened */
    }
  }
  return true;
}

/**
 * Returns a stable `scrollTo(id, options?)` that respects reduced motion.
 * Callers (navbar, mobile menu, footer) close their menus before calling it.
 */
export function useSmoothScrollTo() {
  const reduced = useReducedMotionSafe();
  return useCallback(
    (id: string, options: ScrollToOptions = {}) =>
      scrollToId(id, { behavior: reduced ? "auto" : "smooth", ...options }),
    [reduced],
  );
}
