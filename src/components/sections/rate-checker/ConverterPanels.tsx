"use client";

import { useId } from "react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { interpolate } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { AmountInput } from "./AmountInput";
import { CurrencySelect } from "./CurrencySelect";
import { SwapButton } from "./SwapButton";
import type { RateCheckerState } from "./useRateChecker";

const PANEL =
  "rounded-2xl border border-line/60 bg-surface-2 p-5 transition-[border-color,box-shadow] duration-200 sm:p-6";
/** The amount is the biggest text in the card (docs/CONVERTER.md). */
const BIG_NUMBER = "nums font-mono font-medium leading-tight tracking-tight";

/**
 * Size class for the big amounts: long values (e.g. "15,700,000" or
 * "0.00952381") step down on narrow screens so they never clip or wrap
 * mid-digit next to the coin chip; short values get the full display size.
 */
export function bigNumberSize(text: string): string {
  const len = text.replace(/\s/g, "").length;
  if (len <= 7) return "text-4xl sm:text-5xl";
  if (len <= 10) return "text-3xl sm:text-5xl";
  if (len <= 13) return "text-2xl sm:text-4xl";
  return "text-xl sm:text-3xl";
}

/**
 * The two stacked converter panels ("From" with the amount input, "To" with the
 * read-only estimate) and the swap button overlapping both. Each panel is a
 * `grid-cols-[1fr_auto]`: label + big number + helper line stacked on the left,
 * the coin chip vertically centred on the right — identical on mobile.
 */
export function ConverterPanels({ rc }: { rc: RateCheckerState }) {
  const { t, formatAmount } = useI18n();
  const uid = useId();
  const amountId = `${uid}-amount`;
  // NB: `${uid}-from-label` / `${uid}-to-label` belong to the CurrencySelects (`${id}-label`).
  const fromLabelId = `${uid}-from-title`;
  const amountLabelId = `${uid}-amount-label`;
  const fromHelperId = `${uid}-from-helper`;
  const toLabelId = `${uid}-to-title`;

  const hint = rc.hint;
  const invalid = hint?.kind === "invalid";
  const fromHelper =
    hint === null
      ? t.common.currencyNames[rc.from]
      : hint.kind === "empty"
        ? t.rateChecker.enterAmount
        : hint.kind === "invalid"
          ? t.rateChecker.invalidAmount
          : interpolate(hint.kind === "min" ? t.rateChecker.minAmount : t.rateChecker.maxAmount, {
              amount: formatAmount(hint.limit, rc.from, { compact: true }),
            });
  const fromHelperTone =
    hint === null || hint.kind === "empty" ? "text-faint" : hint.kind === "invalid" ? "text-danger" : "text-warning";

  const estimate = rc.estimatedReceive;
  const estimateText = estimate !== null ? formatAmount(estimate, rc.to) : null;
  const toHelper = rc.loading
    ? t.common.loading
    : !rc.rateAvailable
      ? t.rateChecker.estimateUnavailable
      : t.common.currencyNames[rc.to];
  /** What assistive tech hears when there is no number to read. */
  const emptyStatusText = rc.loading
    ? t.common.loading
    : !rc.rateAvailable
      ? t.rateChecker.estimateUnavailable
      : t.rateChecker.enterAmount;
  const stale = rc.status === "stale";

  return (
    <div className="flex flex-col gap-2">
      {/* From */}
      <div
        className={cn(
          PANEL,
          "focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgba(34,229,138,0.22)]",
          invalid && "border-danger/50 focus-within:border-danger/60 focus-within:shadow-[0_0_0_3px_rgba(240,82,95,0.10)]",
        )}
      >
        <div className="grid grid-cols-[1fr_auto] items-center gap-x-4">
          <div className="min-w-0">
            <label id={fromLabelId} htmlFor={amountId} className="block text-sm text-muted">
              {t.rateChecker.from}
            </label>
            <span id={amountLabelId} className="sr-only">
              {t.rateChecker.amountLabel}
            </span>
            <AmountInput
              id={amountId}
              value={rc.amountText}
              onChange={rc.setAmountText}
              onBlur={rc.commitAmount}
              placeholder="0"
              labelledBy={`${fromLabelId} ${amountLabelId}`}
              describedBy={fromHelperId}
              invalid={invalid}
              className={cn("mt-2", bigNumberSize(rc.amountText))}
            />
            <p id={fromHelperId} className={cn("mt-2 truncate text-xs", fromHelperTone)}>
              {fromHelper}
            </p>
          </div>
          <CurrencySelect
            id={`${uid}-from`}
            label={t.rateChecker.sendCurrencyLabel}
            value={rc.from}
            options={rc.sendable}
            onChange={rc.setFrom}
          />
        </div>
      </div>

      {/* Swap — a zero-height row; the button overlaps both panels. */}
      <div className="relative z-10 h-0">
        <SwapButton
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          label={t.rateChecker.swap}
          disabled={!rc.canSwap}
          onSwap={rc.swap}
        />
      </div>

      {/* To */}
      <div className={PANEL}>
        <div className="grid grid-cols-[1fr_auto] items-center gap-x-4">
          <div className="min-w-0">
            <span id={toLabelId} className="block text-sm text-muted">
              {t.rateChecker.to}
            </span>
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              aria-labelledby={toLabelId}
              className={cn(BIG_NUMBER, bigNumberSize(estimateText ?? ""), "mt-2 break-all text-fg transition-opacity duration-300", stale && "opacity-70")}
            >
              {estimate !== null && estimateText ? (
                <>
                  <span aria-hidden="true">
                    <AnimatedNumber key={rc.to} value={estimate} format={(n) => formatAmount(n, rc.to, { withSymbol: false })} />
                  </span>
                  <span className="sr-only">{estimateText}</span>
                </>
              ) : (
                <>
                  <span aria-hidden="true" className="text-faint">
                    {rc.rateAvailable ? "0" : "—"}
                  </span>
                  <span className="sr-only">{emptyStatusText}</span>
                </>
              )}
            </div>
            <p className="mt-2 truncate text-xs text-faint">{toHelper}</p>
          </div>
          <CurrencySelect
            id={`${uid}-to`}
            label={t.rateChecker.receiveCurrencyLabel}
            value={rc.to}
            options={rc.receivable}
            onChange={rc.setTo}
          />
        </div>
      </div>
    </div>
  );
}
