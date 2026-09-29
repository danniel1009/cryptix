"use client";

import { motion } from "framer-motion";
import { useId, useMemo, useRef } from "react";
import { REVEAL_EASE } from "@/components/ui/Reveal";
import { useReducedMotionSafe } from "@/hooks/useReducedMotionSafe";
import { cn } from "@/lib/utils";
import { generateSparklinePoints, SPARKLINE_VIEWBOX, toAreaPath, toSmoothPath } from "./sparkline-path";
import { useOnceInView } from "./useOnceInView";

export interface SparklineProps {
  className?: string;
  /** Seed for the deterministic curve (same seed → same path on server and client). */
  seed?: number;
}

const ACCENT = "#22E58A";
/** How long the line takes to draw itself once the hero is in view. */
const DRAW_DURATION_S = 2.5;
/** Stroke alpha of the crisp line (docs: accent at ~35%). The halo and fill stay well below it. */
const LINE_OPACITY = 0.35;
const HALO_OPACITY = 0.1;
const FILL_OPACITY = 0.05;

/**
 * Decorative market curve for the hero background. A soft blurred copy sits
 * beneath the crisp line, and a very faint area fill anchors it to the
 * baseline. The line draws itself (pathLength 0 → 1) once, when it enters the
 * viewport; under reduced motion it is simply shown fully drawn.
 */
export function Sparkline({ className, seed }: SparklineProps) {
  const ref = useRef<SVGSVGElement>(null);
  const reduced = useReducedMotionSafe();
  const inView = useOnceInView(ref);
  // useId may contain characters that are invalid in a url(#…) reference.
  const id = `spark-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const fillId = `${id}-fill`;
  const blurId = `${id}-blur`;

  const { line, area } = useMemo(() => {
    const points = generateSparklinePoints({ seed });
    return { line: toSmoothPath(points), area: toAreaPath(points) };
  }, [seed]);

  const lineProps = {
    d: line,
    fill: "none",
    stroke: ACCENT,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    vectorEffect: "non-scaling-stroke",
  } as const;

  const drawTransition = {
    pathLength: { duration: DRAW_DURATION_S, ease: REVEAL_EASE },
    opacity: { duration: 0.5 },
  };

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${SPARKLINE_VIEWBOX.width} ${SPARKLINE_VIEWBOX.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className={cn("h-full w-full overflow-visible", className)}
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity={FILL_OPACITY} />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </linearGradient>
        <filter id={blurId} x="-5%" y="-60%" width="110%" height="220%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      {reduced ? (
        <>
          <path d={area} fill={`url(#${fillId})`} />
          <path {...lineProps} strokeWidth={4} strokeOpacity={HALO_OPACITY} filter={`url(#${blurId})`} />
          <path {...lineProps} strokeWidth={1.25} strokeOpacity={LINE_OPACITY} />
        </>
      ) : (
        <>
          <motion.path
            d={area}
            fill={`url(#${fillId})`}
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : undefined}
            transition={{ duration: 1.4, delay: DRAW_DURATION_S * 0.5, ease: "easeOut" }}
          />
          <motion.path
            {...lineProps}
            strokeWidth={4}
            strokeOpacity={HALO_OPACITY}
            filter={`url(#${blurId})`}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={inView ? { pathLength: 1, opacity: 1 } : undefined}
            transition={drawTransition}
          />
          <motion.path
            {...lineProps}
            strokeWidth={1.25}
            strokeOpacity={LINE_OPACITY}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={inView ? { pathLength: 1, opacity: 1 } : undefined}
            transition={drawTransition}
          />
        </>
      )}
    </svg>
  );
}
