"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * `true` once the element has entered the viewport (never flips back).
 * Framer's `useInView` constructs an IntersectionObserver unguarded, which
 * throws in environments without one (jsdom, very old browsers); this local
 * hook treats "no observer" as "already in view" so the animation still runs.
 */
export function useOnceInView<T extends Element>(ref: RefObject<T | null>, threshold = 0.2): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || inView) return;

    if (typeof IntersectionObserver === "undefined") {
      const timer = setTimeout(() => setInView(true), 0);
      return () => clearTimeout(timer);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, threshold, inView]);

  return inView;
}
