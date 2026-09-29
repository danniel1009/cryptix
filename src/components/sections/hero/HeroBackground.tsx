"use client";

import { motion } from "framer-motion";
import { useReducedMotionSafe } from "@/hooks/useReducedMotionSafe";
import { cn } from "@/lib/utils";
import { Sparkline } from "./Sparkline";

interface Orb {
  className: string;
  x: number[];
  y: number[];
  /** Seconds for one full loop. */
  duration: number;
}

/** Soft, slow-drifting light sources. Sizes/positions are relative to the hero. */
const ORBS: readonly Orb[] = [
  {
    className: "left-[6%] top-[14%] h-64 w-64 bg-accent/[0.07] sm:h-80 sm:w-80",
    x: [0, 36, -18, 0],
    y: [0, -28, 18, 0],
    duration: 16,
  },
  {
    className: "right-[8%] top-[28%] h-72 w-72 bg-accent/[0.05] sm:h-96 sm:w-96",
    x: [0, -44, 20, 0],
    y: [0, 26, -16, 0],
    duration: 18,
  },
  {
    className: "bottom-[16%] left-[40%] h-56 w-56 bg-white/[0.025] sm:h-64 sm:w-64",
    x: [0, 28, -30, 0],
    y: [0, -18, 12, 0],
    duration: 13,
  },
];

/**
 * Everything behind the hero copy: a faint terminal grid fading to the
 * edges, a radial emerald glow behind the headline, a few drifting orbs
 * (static under reduced motion) and the animated market sparkline kept low
 * in the hero so it never competes with the text. Decorative — hidden from
 * AT and transparent to pointer events.
 */
export function HeroBackground() {
  const reduced = useReducedMotionSafe();

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none overflow-hidden">
      {/* Faint grid, strongest behind the headline */}
      <div className="grid-bg absolute inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_32%,black_0%,transparent_78%)]" />

      {/* Radial emerald glow behind the headline (≤ 25% alpha, heavily blurred) */}
      <div className="absolute left-1/2 top-[6%] h-[380px] w-[min(92vw,880px)] -translate-x-1/2 rounded-[50%] bg-accent/[0.14] blur-3xl sm:top-[10%] sm:h-[480px]" />

      {/* Drifting orbs */}
      {ORBS.map((orb, index) => (
        <motion.div
          key={index}
          className={cn("absolute rounded-full blur-3xl", orb.className)}
          animate={reduced ? undefined : { x: orb.x, y: orb.y }}
          transition={reduced ? undefined : { duration: orb.duration, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}

      {/* Market sparkline: low, short, fading at both ends */}
      <div className="absolute inset-x-[-4%] bottom-0 h-[14%] opacity-60 [mask-image:linear-gradient(90deg,transparent_0%,black_18%,black_82%,transparent_100%)] sm:h-[24%] sm:opacity-100 lg:h-[28%]">
        <Sparkline />
      </div>

      {/* Sink the curve back into the page before the glow line */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-[linear-gradient(to_bottom,transparent,var(--bg))] sm:h-60" />
    </div>
  );
}
