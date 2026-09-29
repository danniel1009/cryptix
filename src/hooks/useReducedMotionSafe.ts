"use client";

import { useReducedMotion } from "framer-motion";

/**
 * Framer's `useReducedMotion()` returns `null` before it knows (SSR / first
 * render). This wrapper coerces to a boolean so callers can branch directly.
 */
export function useReducedMotionSafe(): boolean {
  return useReducedMotion() ?? false;
}
