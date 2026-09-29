"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useReducedMotionSafe } from "@/hooks/useReducedMotionSafe";
import { useI18n } from "@/lib/i18n/provider";
import type { MarketStatus } from "@/lib/market/types";
import { cn } from "@/lib/utils";
import { ChangeBadge, PairCell, PriceValue, UpdatedCell, useRowStatus } from "./MarketRow";
import { ROW_VIEWPORT, rowGroupVariants, rowItemVariants } from "./motion";
import type { MarketRowModel, MarketView } from "./rows";
import { StatusDot } from "./StatusDot";

export interface MarketCardsProps {
  rows: MarketRowModel[];
  view: MarketView;
  skeletonRows?: number;
  className?: string;
}

const LABEL = "font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-faint";

function MarketCard({ row, status }: { row: MarketRowModel; status: MarketStatus }) {
  const { t } = useI18n();
  const reduced = useReducedMotionSafe();
  const { data } = row;
  const showNumbers = data !== undefined && status !== "unavailable";
  const rowStatus = useRowStatus(status, data !== undefined);
  const cols = t.market.columns;

  return (
    <motion.li variants={rowItemVariants(reduced)} className="list-none">
      <Card padding="sm" className="flex h-full flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <PairCell base={row.base} quote={row.quote} />
          <StatusDot state={rowStatus.state} label={rowStatus.label} className="mt-1 shrink-0" />
        </div>

        <div className="flex flex-col gap-1">
          <span className={LABEL}>{cols.price}</span>
          {showNumbers ? (
            <PriceValue value={data.price} currency={row.quote} muted={status === "stale"} className="text-2xl tracking-tight" />
          ) : (
            <span className="font-mono text-2xl text-faint">—</span>
          )}
        </div>

        <div className="flex items-end justify-between gap-4 border-t border-line pt-4">
          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>{cols.change24h}</span>
            <ChangeBadge change={showNumbers ? data.change24hPct : null} />
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={LABEL}>{cols.updated}</span>
            <UpdatedCell updatedAt={data?.updatedAt ?? null} source={data?.source ?? null} align="right" />
          </div>
        </div>
      </Card>
    </motion.li>
  );
}

function MarketCardSkeleton() {
  return (
    <li className="list-none" aria-hidden="true">
      <Card padding="sm" className="flex h-full flex-col gap-5">
        <div className="flex items-center gap-3.5">
          <Skeleton className="h-8 w-14 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-2.5 w-32" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-2.5 w-10" />
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="flex justify-between border-t border-line pt-4">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20" />
        </div>
      </Card>
    </li>
  );
}

/**
 * Mobile / tablet market board: stacked cards (1 column, 2 from `sm`) with
 * the same content as the table — no horizontally scrolling table on phones.
 */
export function MarketCards({ rows, view, skeletonRows = 4, className }: MarketCardsProps) {
  const { t } = useI18n();
  const loading = view === "loading";
  const status: MarketStatus = loading ? "unavailable" : view;
  const grid = "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4";

  if (loading) {
    return (
      <div className={className} aria-busy="true">
        <p className="sr-only">{t.common.loading}</p>
        <ul className={cn(grid, "m-0 p-0")}>
          {Array.from({ length: skeletonRows }, (_, i) => (
            <MarketCardSkeleton key={i} />
          ))}
        </ul>
      </div>
    );
  }

  return (
    <motion.ul
      aria-label={t.market.title}
      className={cn(grid, "m-0 p-0", className)}
      initial="hidden"
      whileInView="visible"
      viewport={ROW_VIEWPORT}
      variants={rowGroupVariants()}
    >
      {rows.map((row) => (
        <MarketCard key={row.key} row={row} status={status} />
      ))}
    </motion.ul>
  );
}
