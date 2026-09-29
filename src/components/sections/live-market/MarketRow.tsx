"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useCallback } from "react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Badge } from "@/components/ui/Badge";
import { CurrencyIcon } from "@/components/ui/CurrencyIcon";
import { Skeleton } from "@/components/ui/Skeleton";
import { CURRENCIES, type CurrencyCode } from "@/config/exchange";
import { useReducedMotionSafe } from "@/hooks/useReducedMotionSafe";
import { priceDecimals } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";
import type { MarketStatus } from "@/lib/market/types";
import { cn } from "@/lib/utils";
import { rowItemVariants } from "./motion";
import { changeDirection, type MarketRowModel } from "./rows";
import { StatusDot } from "./StatusDot";

/**
 * Row building blocks shared by the desktop table (`MarketTableRow`) and the
 * mobile cards. Every number goes through the locale formatters; prices tween
 * and flash via `AnimatedNumber`.
 */

/** Overlapping coin marks + "BTC / USDT" (mono) with the currency names underneath. */
export function PairCell({ base, quote, className }: { base: CurrencyCode; quote: CurrencyCode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3.5", className)}>
      <span className="flex shrink-0 -space-x-2.5" aria-hidden="true">
        <CurrencyIcon code={base} size={32} decorative className="relative z-10 rounded-full ring-2 ring-surface" />
        <CurrencyIcon code={quote} size={32} decorative className="rounded-full ring-2 ring-surface" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="font-mono text-sm font-medium tracking-tight text-fg">{`${base} / ${quote}`}</span>
        <span className="truncate text-xs text-faint">{`${CURRENCIES[base].name} · ${CURRENCIES[quote].name}`}</span>
      </span>
    </div>
  );
}

export interface PriceValueProps {
  value: number;
  currency: CurrencyCode;
  /** Stale data is de-emphasised. */
  muted?: boolean;
  className?: string;
}

/**
 * Price = number (tweened + flashed) with the quote currency as a muted
 * affix: "Rp" prefix for symbol currencies, " USDT" suffix otherwise. The
 * decimals come from the TARGET value so the digit count never jitters
 * mid-tween; the visible text equals `formatPrice(value, currency)`.
 */
export function PriceValue({ value, currency, muted = false, className }: PriceValueProps) {
  const { formatNumber } = useI18n();
  const { symbol } = CURRENCIES[currency];
  const decimals = priceDecimals(value, currency);
  const format = useCallback(
    (n: number) => formatNumber(n, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
    [formatNumber, decimals],
  );
  return (
    <span className={cn("font-mono nums", muted ? "text-muted" : "text-fg", className)}>
      {symbol ? <span className="text-[0.85em] text-muted">{symbol}</span> : null}
      <AnimatedNumber value={value} format={format} />
      {symbol ? null : (
        <>
          {" "}
          <span className="text-[0.85em] text-muted">{currency}</span>
        </>
      )}
    </span>
  );
}

/** 24h change pill: green ↗ up, red ↘ down, neutral for flat / unknown. */
export function ChangeBadge({ change, className }: { change: number | null | undefined; className?: string }) {
  const { formatPercent } = useI18n();
  const direction = changeDirection(change);
  const variant = direction === "up" ? "success" : direction === "down" ? "danger" : "neutral";
  const Arrow = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  return (
    <Badge
      variant={variant}
      className={cn("gap-1 tracking-[0.04em] nums [&>svg]:h-3 [&>svg]:w-3 [&>svg]:shrink-0", className)}
    >
      {direction === "unknown" ? null : <Arrow aria-hidden="true" strokeWidth={2.4} />}
      {direction === "unknown" ? "—" : formatPercent(change as number)}
    </Badge>
  );
}

/** Observation time (mono) with the provider name underneath (mono, faint). */
export function UpdatedCell({
  updatedAt,
  source,
  align = "left",
  className,
}: {
  updatedAt: string | null;
  source: string | null;
  align?: "left" | "right";
  className?: string;
}) {
  const { t, formatTime } = useI18n();
  return (
    <div className={cn("flex flex-col gap-0.5", align === "right" && "items-end text-right", className)}>
      <span className="font-mono text-sm nums text-muted">{updatedAt ? formatTime(updatedAt) : "—"}</span>
      <span className="font-mono text-[11px] tracking-wide text-faint">
        <span className="sr-only">{`${t.market.columns.source}: `}</span>
        {source ?? "—"}
      </span>
    </div>
  );
}

/** Label for the per-row dot: the data status, or "unavailable" for a row without a quote. */
export function useRowStatus(status: MarketStatus, hasData: boolean): { state: MarketStatus; label: string } {
  const { t } = useI18n();
  const state: MarketStatus = hasData ? status : "unavailable";
  return { state, label: t.market[state] };
}

export interface MarketTableRowProps {
  row: MarketRowModel;
  /** Data status of the whole snapshot. */
  status: MarketStatus;
}

const CELL = "px-6 py-5 align-middle first:pl-7 last:pr-7";

/**
 * Desktop table row. Numbers are hidden (—) when the snapshot is unavailable
 * so old prices are never shown as live; muted when stale.
 */
export function MarketTableRow({ row, status }: MarketTableRowProps) {
  const reduced = useReducedMotionSafe();
  const { data } = row;
  const showNumbers = data !== undefined && status !== "unavailable";
  const rowStatus = useRowStatus(status, data !== undefined);

  return (
    <motion.tr
      variants={rowItemVariants(reduced)}
      className="border-t border-line transition-colors duration-200 hover:bg-white/[0.025]"
    >
      <td className={CELL}>
        <PairCell base={row.base} quote={row.quote} />
      </td>
      <td className={cn(CELL, "text-right")}>
        {showNumbers ? (
          <PriceValue value={data.price} currency={row.quote} muted={status === "stale"} className="text-base" />
        ) : (
          <span className="font-mono text-base text-faint">—</span>
        )}
      </td>
      <td className={cn(CELL, "text-right")}>
        {showNumbers ? <ChangeBadge change={data.change24hPct} /> : <ChangeBadge change={null} />}
      </td>
      <td className={cn(CELL, "text-right")}>
        <UpdatedCell updatedAt={data?.updatedAt ?? null} source={data?.source ?? null} align="right" />
      </td>
      <td className={cn(CELL, "text-right")}>
        <StatusDot state={rowStatus.state} label={rowStatus.label} className="justify-end" />
      </td>
    </motion.tr>
  );
}

/** Loading placeholder row (decorative; the table announces loading once). */
export function MarketTableSkeletonRow() {
  return (
    <tr className="border-t border-line">
      <td className={CELL}>
        <div className="flex items-center gap-3.5">
          <Skeleton className="h-8 w-14 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-2.5 w-36" />
          </div>
        </div>
      </td>
      <td className={CELL}>
        <Skeleton className="ml-auto h-4 w-32" />
      </td>
      <td className={CELL}>
        <Skeleton className="ml-auto h-5 w-16 rounded-full" />
      </td>
      <td className={CELL}>
        <div className="ml-auto w-20 space-y-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-2.5 w-2/3" />
        </div>
      </td>
      <td className={CELL}>
        <Skeleton className="ml-auto h-3 w-12" />
      </td>
    </tr>
  );
}
