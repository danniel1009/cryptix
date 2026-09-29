"use client";

import { Container } from "@/components/ui/Container";
import { RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { useI18n } from "@/lib/i18n/provider";
import { SECURITY_ITEM_ICONS } from "./icons";

/**
 * Hairlines between cells, per breakpoint (docs/DESIGN.md "Ruled feature grid"):
 *   1 column  → a horizontal line above every cell but the first
 *   2 columns → vertical line before even cells; first row has no top line
 *   3 columns → vertical lines before columns 2 and 3; first row has no top line
 * Lines live on the cells (not on a coloured gap) so they fade in with the cell.
 */
export const CELL_DIVIDER_CLASSES = [
  "border-line border-t first:border-t-0",
  "sm:even:border-l sm:[&:nth-child(-n+2)]:border-t-0",
  "lg:[&:nth-child(3n+1)]:border-l-0 lg:[&:not(:nth-child(3n+1))]:border-l",
  "lg:[&:nth-child(-n+3)]:border-t-0 lg:[&:nth-child(n+4)]:border-t",
].join(" ");

/**
 * Full-bleed ruled grid of the six security items: top/bottom hairlines span
 * the viewport, the cells sit inside the page container with vertical rules.
 */
export function SecurityGrid({ className }: { className?: string }) {
  const { t } = useI18n();

  return (
    <div className={className}>
      <div className="w-full border-y border-line">
        <Container>
          <RevealGroup
            as="ul"
            role="list"
            className="grid grid-cols-1 border-line sm:grid-cols-2 sm:border-x lg:grid-cols-3"
          >
            {t.security.items.map((item, index) => {
              const Icon = SECURITY_ITEM_ICONS[index] ?? SECURITY_ITEM_ICONS[0];
              return (
                <RevealItem key={item.title} as="li" className={`flex ${CELL_DIVIDER_CLASSES}`}>
                  <article className="flex h-full w-full flex-col gap-6 px-6 py-8 transition-colors duration-300 hover:bg-white/[0.02] sm:px-8 lg:px-10 lg:py-10">
                    <div className="flex items-start justify-between">
                      <span
                        aria-hidden="true"
                        className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface-2 text-fg"
                      >
                        <Icon className="h-5 w-5" strokeWidth={1.75} />
                      </span>
                      <span aria-hidden="true" className="nums font-mono text-xs text-faint">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-base font-medium tracking-tight text-fg sm:text-lg">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
                    </div>
                  </article>
                </RevealItem>
              );
            })}
          </RevealGroup>
        </Container>
      </div>
    </div>
  );
}
