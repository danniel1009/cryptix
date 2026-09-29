"use client";

import { useCallback, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * Reactive `window.matchMedia(query).matches`.
 * `defaultValue` is used on the server and in environments without matchMedia.
 */
export function useMediaQuery(query: string, defaultValue = false): boolean {
  const supported = typeof window !== "undefined" && typeof window.matchMedia === "function";

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!supported) return noopSubscribe();
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query, supported],
  );

  const getSnapshot = useCallback(
    () => (supported ? window.matchMedia(query).matches : defaultValue),
    [query, supported, defaultValue],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => defaultValue);
}
