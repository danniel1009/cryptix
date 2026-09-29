"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";
import { useReducedMotionSafe } from "@/hooks/useReducedMotionSafe";

/** Shared easing per docs/DESIGN.md. */
export const REVEAL_EASE = [0.22, 1, 0.36, 1] as const;

type RevealTag =
  | "div"
  | "section"
  | "span"
  | "article"
  | "ul"
  | "ol"
  | "li"
  | "p"
  | "h1"
  | "h2"
  | "h3"
  | "figure"
  | "header"
  | "footer";

export interface RevealProps {
  children?: ReactNode;
  /** Seconds. */
  delay?: number;
  /** Initial vertical offset in px (transforms are disabled under reduced motion). */
  y?: number;
  /** Animate only the first time it enters the viewport. */
  once?: boolean;
  /** Portion of the element that must be visible (0–1). */
  amount?: number | "some" | "all";
  duration?: number;
  as?: RevealTag;
  className?: string;
  id?: string;
  style?: React.CSSProperties;
}

/**
 * Fade-up on scroll. `{opacity:0,y:24} → {opacity:1,y:0}`, 0.6s, viewport
 * margin -80px. Under reduced motion it only fades (no transform).
 */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  once = true,
  amount,
  duration = 0.6,
  as = "div",
  className,
  id,
  style,
}: RevealProps) {
  const reduced = useReducedMotionSafe();
  const MotionTag = motion[as] as typeof motion.div;
  return (
    <MotionTag
      id={id}
      className={className}
      style={style}
      initial={{ opacity: 0, y: reduced ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-80px", amount }}
      transition={{ duration: reduced ? 0.25 : duration, delay, ease: REVEAL_EASE }}
    >
      {children}
    </MotionTag>
  );
}

/* ------------------------------------------------------------------ */
/* Staggered groups                                                    */
/* ------------------------------------------------------------------ */

export interface RevealGroupProps {
  children?: ReactNode;
  /** Seconds between children. */
  stagger?: number;
  delay?: number;
  once?: boolean;
  amount?: number | "some" | "all";
  as?: RevealTag;
  className?: string;
}

/**
 * Orchestrates `<RevealItem>` children with a stagger. Items must be direct
 * (or variant-inheriting) descendants.
 */
export function RevealGroup({
  children,
  stagger = 0.08,
  delay = 0,
  once = true,
  amount,
  as = "div",
  className,
}: RevealGroupProps) {
  const MotionTag = motion[as] as typeof motion.div;
  const variants: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
  };
  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "-80px", amount }}
      variants={variants}
    >
      {children}
    </MotionTag>
  );
}

export interface RevealItemProps {
  children?: ReactNode;
  y?: number;
  duration?: number;
  as?: RevealTag;
  className?: string;
}

export function RevealItem({ children, y = 24, duration = 0.6, as = "div", className }: RevealItemProps) {
  const reduced = useReducedMotionSafe();
  const MotionTag = motion[as] as typeof motion.div;
  const variants: Variants = {
    hidden: { opacity: 0, y: reduced ? 0 : y },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: reduced ? 0.25 : duration, ease: REVEAL_EASE },
    },
  };
  return (
    <MotionTag className={className} variants={variants}>
      {children}
    </MotionTag>
  );
}
