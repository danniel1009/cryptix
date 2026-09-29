"use client";

import { animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useReducedMotionSafe } from "@/hooks/useReducedMotionSafe";
import { cn } from "@/lib/utils";

export interface AnimatedNumberProps {
  value: number;
  /** Formats the (possibly in-between) number for display. */
  format: (n: number) => string;
  className?: string;
  /** Briefly tint the text green/red when the value goes up/down. Default true. */
  flash?: boolean;
  /** Tween duration in seconds. */
  duration?: number;
  /** Flash colour hold in ms. */
  flashMs?: number;
}

const EASE = [0.22, 1, 0.36, 1] as const;

type Flash = { direction: "up" | "down"; id: number } | null;

/**
 * Tweens between numeric values (0.6s) and flashes on change. The first render
 * shows the value immediately (no animation, SSR-safe). Non-finite values are
 * ignored for animation and rendered as "—" when nothing valid was ever shown.
 */
export function AnimatedNumber({
  value,
  format,
  className,
  flash = true,
  duration = 0.6,
  flashMs = 900,
}: AnimatedNumberProps) {
  const reduced = useReducedMotionSafe();
  const [display, setDisplay] = useState<number>(value);
  const [flashState, setFlashState] = useState<Flash>(null);
  // "Adjust state while rendering" pattern: detect a change in `value` without an effect.
  const [prevValue, setPrevValue] = useState<number>(value);
  // Object.is: NaN must compare equal to itself or this would re-render forever.
  if (!Object.is(value, prevValue)) {
    setPrevValue(value);
    if (flash && Number.isFinite(value) && Number.isFinite(prevValue)) {
      setFlashState((f) => ({ direction: value > prevValue ? "up" : "down", id: (f?.id ?? 0) + 1 }));
    }
  }

  // Last number actually painted (updated from the tween callback).
  const shownRef = useRef<number>(value);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!Number.isFinite(value)) return;
    if (!mountedRef.current) {
      // First commit: nothing to tween from.
      mountedRef.current = true;
      shownRef.current = value;
      return;
    }
    const from = shownRef.current;
    if (from === value || reduced || duration <= 0) {
      // Reduced motion: `display` is bypassed in render below; keep the ref in sync.
      shownRef.current = value;
      return;
    }
    const controls = animate(from, value, {
      duration,
      ease: EASE,
      onUpdate: (latest) => {
        shownRef.current = latest;
        setDisplay(latest);
      },
      onComplete: () => {
        shownRef.current = value;
        setDisplay(value);
      },
    });
    return () => controls.stop();
  }, [value, reduced, duration]);

  // Clear the flash tint after a short hold. Re-armed on every change (`id`).
  useEffect(() => {
    if (!flashState) return;
    const timer = window.setTimeout(() => setFlashState(null), flashMs);
    return () => window.clearTimeout(timer);
  }, [flashState, flashMs]);

  const shown = reduced ? value : display;
  const text = Number.isFinite(shown) ? format(shown) : Number.isFinite(value) ? format(value) : "—";

  return (
    <span
      className={cn(
        "nums transition-colors duration-700 ease-out",
        flashState?.direction === "up" && "text-accent duration-100",
        flashState?.direction === "down" && "text-danger duration-100",
        className,
      )}
    >
      {text}
    </span>
  );
}
