"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Card } from "@/components/ui/Card";
import { RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { useReducedMotionSafe } from "@/hooks/useReducedMotionSafe";
import { cn } from "@/lib/utils";

export interface ProcessStep {
  /** Tiny mono label rendered in the node and the card ("01"). */
  number: string;
  title: string;
  body: string;
}

export interface ProcessStepsProps {
  steps: readonly ProcessStep[];
  className?: string;
}

/**
 * Seconds one connector segment takes to draw. Three segments join four
 * steps, so the whole line draws in 3 × 0.4 s = 1.2 s; node `i` fills accent
 * at `i × SEGMENT_DURATION`, exactly when the line reaches it.
 */
export const SEGMENT_DURATION = 0.4;

/**
 * The four-step process as one DOM tree that lays itself out both ways:
 *
 *   ≥ lg  — four columns; a node ("01") sits above each card and a hairline
 *           runs from node to node. When the list scrolls into view the
 *           accent line draws itself left → right and each node fills as the
 *           line reaches it.
 *   < lg  — vertical timeline; nodes on a left rail, the same cards beside
 *           them, the rail growing top → bottom.
 *
 * Both connector orientations are rendered (one is hidden per breakpoint) so
 * the content — node, title, body — exists exactly once for assistive tech.
 * Under reduced motion the line is static and complete and nodes fill without
 * delay; the global stylesheet already zeroes transitions.
 */
export function ProcessSteps({ steps, className }: ProcessStepsProps) {
  const reduced = useReducedMotionSafe();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2, margin: "-80px" });
  const drawn = reduced || inView;

  return (
    <div ref={ref} className={className}>
      <RevealGroup as="ol" stagger={0.1} className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const delay = reduced ? 0 : index * SEGMENT_DURATION;
          const segmentTransition = {
            duration: reduced ? 0 : SEGMENT_DURATION,
            delay,
            ease: "easeInOut" as const,
          };

          return (
            <RevealItem key={step.number} as="li" className="relative flex gap-5 lg:flex-col lg:gap-0">
              {isLast ? null : (
                <>
                  {/* Mobile rail: node centre → top of the next node. */}
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-6 left-6 top-6 w-px -translate-x-1/2 bg-line lg:hidden"
                  >
                    <motion.span
                      className="absolute inset-0 origin-top bg-accent shadow-[0_0_10px_rgba(34,229,138,0.45)]"
                      initial={false}
                      animate={{ scaleY: drawn ? 1 : 0 }}
                      transition={segmentTransition}
                    />
                  </span>
                  {/* Desktop connector: node centre → left edge of the next node. */}
                  <span
                    aria-hidden="true"
                    className="absolute -right-6 left-6 top-6 hidden h-px -translate-y-1/2 bg-line lg:block"
                  >
                    <motion.span
                      className="absolute inset-0 origin-left bg-accent shadow-[0_0_10px_rgba(34,229,138,0.45)]"
                      initial={false}
                      animate={{ scaleX: drawn ? 1 : 0 }}
                      transition={segmentTransition}
                    />
                  </span>
                </>
              )}

              <StepNode number={step.number} active={drawn} delay={delay} />

              <Card
                padding="none"
                data-step-card=""
                data-highlight={isLast ? "true" : "false"}
                className={cn(
                  "min-w-0 flex-1 p-6 lg:mt-8 lg:p-7",
                  isLast && "border-accent/30 shadow-glow-sm",
                )}
              >
                <span className="nums hidden font-mono text-xs font-medium tracking-[0.18em] text-accent lg:inline-block">
                  {step.number}
                </span>
                <h3 className="text-lg font-medium tracking-tight text-fg lg:mt-3">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted sm:text-[15px]">{step.body}</p>
              </Card>
            </RevealItem>
          );
        })}
      </RevealGroup>
    </div>
  );
}

interface StepNodeProps {
  number: string;
  active: boolean;
  /** Seconds before this node fills (matches the line reaching it). */
  delay: number;
}

/**
 * 48px circular well with the mono step number. Decorative: the ordered list
 * and the card carry the semantics, so the duplicate number is aria-hidden.
 */
function StepNode({ number, active, delay }: StepNodeProps) {
  return (
    <span
      aria-hidden="true"
      data-step-node=""
      data-active={active ? "true" : "false"}
      style={{ transitionDelay: `${delay}s` }}
      className={cn(
        "nums relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border font-mono text-sm font-medium",
        "transition-[background-color,border-color,color,box-shadow] duration-500 ease-out-expo",
        active ? "border-accent bg-accent text-bg shadow-glow-sm" : "border-line bg-surface-2 text-muted",
      )}
    >
      {number}
    </span>
  );
}
