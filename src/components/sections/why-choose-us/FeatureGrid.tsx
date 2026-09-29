"use client";

import { Activity, BadgePercent, MessageCircle, Route, type LucideIcon } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { cn } from "@/lib/utils";

export interface FeatureItem {
  title: string;
  body: string;
}

export interface FeatureGridProps {
  items: readonly FeatureItem[];
  className?: string;
}

/** One icon per value proposition, in dictionary order: pricing, live data, support, process. */
const ICONS: readonly LucideIcon[] = [BadgePercent, Activity, MessageCircle, Route];

/**
 * Hairlines per cell so the ruled grid reads correctly at every width
 * (docs/DESIGN.md): one column with horizontal rules on mobile, two columns
 * on `sm`, four columns separated by vertical rules on `lg`. The wrapper
 * draws the full-bleed top/bottom rules, so the last row never doubles them.
 */
function cellRules(index: number, count: number): string {
  const lastTwoColumnRowStart = count - (count % 2 === 0 ? 2 : 1);
  return cn(
    "border-line",
    index < count - 1 ? "border-b" : "border-b-0",
    index < lastTwoColumnRowStart ? "sm:border-b" : "sm:border-b-0",
    index % 2 === 1 ? "sm:border-l" : "sm:border-l-0",
    "lg:border-b-0",
    index > 0 ? "lg:border-l" : "lg:border-l-0",
  );
}

/**
 * Full-bleed ruled feature grid: top and bottom hairlines span the viewport,
 * the cells sit inside the page container, each with a 48px circular icon
 * well, a medium-weight title and a muted body.
 */
export function FeatureGrid({ items, className }: FeatureGridProps) {
  return (
    <div className={cn("w-full border-y border-line", className)}>
      <Container>
        <RevealGroup as="ul" role="list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, index) => {
            const Icon = ICONS[index % ICONS.length];
            return (
              <RevealItem key={`feature-${index}`} as="li" className={cn("p-8 lg:p-10", cellRules(index, items.length))}>
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface-2 text-fg"
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <h3 className="mt-6 text-lg font-medium tracking-tight text-fg">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted sm:text-[15px]">{item.body}</p>
              </RevealItem>
            );
          })}
        </RevealGroup>
      </Container>
    </div>
  );
}
