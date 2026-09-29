import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProcessStripProps {
  /** The four steps, in order (from `t.hero.processSteps`). */
  steps: readonly string[];
  className?: string;
}

/**
 * "Check rate → Request exchange → Contact our team → Manual exchange" as
 * tiny mono chips joined by chevrons. An ordered list (one item per step) so
 * the sequence reaches assistive tech without relying on the decorative
 * arrows. On phones the chips wrap, so the arrows are dropped there and the
 * "01–04" numbers carry the order instead.
 */
export function ProcessStrip({ steps, className }: ProcessStripProps) {
  return (
    <ol role="list" className={cn("flex flex-wrap items-center justify-center gap-x-2 gap-y-2 sm:gap-x-0", className)}>
      {steps.map((step, index) => (
        <li key={step} className="flex items-center">
          {index > 0 ? (
            <ChevronRight
              aria-hidden="true"
              className="mx-2 hidden h-3.5 w-3.5 shrink-0 text-faint sm:block"
              strokeWidth={1.75}
            />
          ) : null}
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1.5 font-mono text-[11px] uppercase leading-none tracking-[0.14em] text-muted">
            <span className="nums text-accent/80" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>{step}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
