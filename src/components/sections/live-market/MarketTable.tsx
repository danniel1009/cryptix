"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { useI18n } from "@/lib/i18n/provider";
import type { MarketStatus } from "@/lib/market/types";
import { cn } from "@/lib/utils";
import { MarketTableRow, MarketTableSkeletonRow } from "./MarketRow";
import { ROW_VIEWPORT, rowGroupVariants } from "./motion";
import type { MarketRowModel, MarketView } from "./rows";

export interface MarketTableProps {
  rows: MarketRowModel[];
  view: MarketView;
  /** Number of placeholder rows while loading. */
  skeletonRows?: number;
  className?: string;
}

const HEAD = "px-6 py-4 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-faint first:pl-7 last:pr-7";

/**
 * Desktop (lg+) market board: a real <table> inside a Card — hairline row
 * dividers, no zebra, hover highlight, numbers right-aligned in mono.
 * Rows stagger in once; the tbody is keyed on loading so the reveal replays
 * when the first snapshot replaces the skeletons.
 */
export function MarketTable({ rows, view, skeletonRows = 4, className }: MarketTableProps) {
  const { t } = useI18n();
  const loading = view === "loading";
  const status: MarketStatus = loading ? "unavailable" : view;
  const cols = t.market.columns;

  return (
    <Card padding="none" className={cn("overflow-hidden", className)}>
      <table className="w-full border-collapse text-left" aria-busy={loading || undefined}>
        <caption className="sr-only">{loading ? t.common.loading : t.market.title}</caption>
        <colgroup>
          <col className="w-[30%]" />
          <col className="w-[22%]" />
          <col className="w-[14%]" />
          <col className="w-[18%]" />
          <col className="w-[16%]" />
        </colgroup>
        <thead>
          <tr className="bg-white/[0.015]">
            <th scope="col" className={HEAD}>
              {cols.pair}
            </th>
            <th scope="col" className={cn(HEAD, "text-right")}>
              {cols.price}
            </th>
            <th scope="col" className={cn(HEAD, "text-right")}>
              {cols.change24h}
            </th>
            <th scope="col" className={cn(HEAD, "text-right")}>
              {cols.updated}
            </th>
            <th scope="col" className={cn(HEAD, "text-right")}>
              {cols.status}
            </th>
          </tr>
        </thead>
        {loading ? (
          <tbody>
            {Array.from({ length: skeletonRows }, (_, i) => (
              <MarketTableSkeletonRow key={i} />
            ))}
          </tbody>
        ) : (
          <motion.tbody
            key="rows"
            initial="hidden"
            whileInView="visible"
            viewport={ROW_VIEWPORT}
            variants={rowGroupVariants()}
          >
            {rows.map((row) => (
              <MarketTableRow key={row.key} row={row} status={status} />
            ))}
          </motion.tbody>
        )}
      </table>
    </Card>
  );
}
