import type { Variants } from "framer-motion";
import { REVEAL_EASE } from "@/components/ui/Reveal";

/**
 * Stagger variants for the market rows. The ui `RevealGroup`/`RevealItem`
 * primitives only render generic tags; table rows and list items need the
 * same choreography on `motion.tbody` / `motion.tr` / `motion.ul` /
 * `motion.li`, so the variants live here and are applied directly.
 */

export function rowGroupVariants(stagger = 0.06, delay = 0.1): Variants {
  return {
    hidden: {},
    visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
  };
}

export function rowItemVariants(reduced: boolean, y = 12): Variants {
  return {
    hidden: { opacity: 0, y: reduced ? 0 : y },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: reduced ? 0.25 : 0.5, ease: REVEAL_EASE },
    },
  };
}

/** Shared `viewport` options (once, -80px margin — same as `Reveal`). */
export const ROW_VIEWPORT = { once: true, margin: "-80px" } as const;
