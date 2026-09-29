"use client";

import { useEffect, useState } from "react";

export interface ScrollSpyOptions {
  /**
   * Observation band, expressed as IntersectionObserver rootMargin. The default
   * watches a band in the upper-middle of the viewport so the section under the
   * reader's eye wins, not the one merely peeking in at the bottom.
   */
  rootMargin?: string;
  threshold?: number | number[];
}

const DEFAULT_THRESHOLDS = [0, 0.1, 0.25, 0.5, 0.75, 1];

/**
 * Tracks which of the given section ids is currently "active" (most visible
 * inside the observation band). Returns `null` when none is — e.g. in the hero.
 */
export function useScrollSpy(ids: readonly string[], options: ScrollSpyOptions = {}): string | null {
  const [active, setActive] = useState<string | null>(null);
  const idsKey = ids.join("|");
  const { rootMargin = "-30% 0px -60% 0px", threshold = DEFAULT_THRESHOLDS } = options;
  const thresholdKey = Array.isArray(threshold) ? threshold.join(",") : String(threshold);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const idList = idsKey ? idsKey.split("|") : [];
    const elements = idList
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    // Visible pixel height of each section inside the band (not the ratio, which
    // would penalise tall sections).
    const visible = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRect.height : 0);
        }
        let best: string | null = null;
        let bestHeight = 0;
        for (const id of idList) {
          const h = visible.get(id) ?? 0;
          if (h > bestHeight) {
            best = id;
            bestHeight = h;
          }
        }
        setActive(best);
      },
      { rootMargin, threshold: thresholdKey.split(",").map(Number) },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [idsKey, rootMargin, thresholdKey]);

  return active;
}
