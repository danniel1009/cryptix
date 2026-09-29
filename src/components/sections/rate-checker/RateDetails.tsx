"use client";

import { Info, RefreshCw } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tooltip } from "@/components/ui/Tooltip";
import type { CurrencyCode } from "@/config/exchange";
import { interpolate } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { RateCheckerState } from "./useRateChecker";

/**
 * "1 {base} = {price}" with a tweening number. The animated span is hidden from
 * assistive tech and a visually hidden copy carries the final text, so screen
 * readers hear one value, not the tween.
 */
function RateEquation({
  base,
  value,
  currency,
  className,
}: {
  base: CurrencyCode;
  value: number;
  currency: CurrencyCode;
  className?: string;
}) {
  const { formatPrice } = useI18n();
  return (
    <span className={cn("nums whitespace-nowrap font-mono", className)}>
      <span>1 {base} = </span>
      <span aria-hidden="true">
        <AnimatedNumber key={currency} value={value} format={(n) => formatPrice(n, currency)} />
      </span>
      <span className="sr-only">{formatPrice(value, currency)}</span>
    </span>
  );
}

/**
 * The rate lines under the panels: a primary live market line (price, 24h
 * change, live indicator, updated time), the "Market rate" / "Our rate" rows
 * (the latter clearly marked but not aggressive), the derived / stale notes
 * and the short disclaimer. Loading shows a skeleton; unavailable shows the
 * unavailable copy with a retry button — never old prices as live.
 */
export function RateDetails({ rc }: { rc: RateCheckerState }) {
  const { t, formatPercent, formatSpread, formatTime, formatRelativeTime } = useI18n();
  const { rate } = rc;
  const spread = formatSpread(rc.spread);
  const stale = rc.status === "stale";
  const showNumbers = !rc.loading && rc.rateAvailable && rate !== undefined;

  return (
    <div className="mt-6 space-y-3">
      {/* Primary line */}
      <div
        className={cn(
          "flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-center transition-opacity duration-300",
          stale && "opacity-70",
        )}
      >
        {showNumbers ? (
          <>
            <RateEquation
              base={rate.quoteBase}
              value={rate.marketPriceDisplay}
              currency={rate.quoteCurrency}
              className="text-sm text-fg sm:text-base"
            />
            {rate.change24hPct !== null ? (
              <span
                className={cn("nums font-mono text-xs", rate.change24hPct >= 0 ? "text-accent" : "text-danger")}
                aria-label={`${t.market.columns.change24h} ${formatPercent(rate.change24hPct)}`}
              >
                {formatPercent(rate.change24hPct)}
              </span>
            ) : null}
          </>
        ) : null}
        <LiveIndicator state={rc.indicator} label={rc.loading ? t.common.loading : undefined} />
        {rc.lastUpdatedAt ? (
          <span className="nums text-xs text-faint">
            {interpolate(t.rateChecker.updatedAt, { time: formatTime(rc.rate?.updatedAt ?? rc.lastUpdatedAt) })}
          </span>
        ) : null}
      </div>

      {rc.loading ? (
        <div data-testid="rate-lines-loading" aria-busy="true" className="rounded-xl border border-line/60 px-4 py-3">
          <Skeleton lines={2} />
          <p className="sr-only">{t.common.loading}</p>
        </div>
      ) : showNumbers ? (
        <>
          <dl
            className={cn(
              "divide-y divide-line/60 rounded-xl border border-line/60 text-sm transition-opacity duration-300",
              stale && "opacity-70",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
              <dt className="text-muted">{t.rateChecker.marketRate}</dt>
              <dd className="text-fg">
                <RateEquation base={rate.quoteBase} value={rate.marketPriceDisplay} currency={rate.quoteCurrency} />
              </dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-l-2 border-l-accent bg-accent-soft px-4 py-3">
              <dt className="flex items-center gap-1.5 font-medium text-fg">
                {t.rateChecker.ourRate}
                <Tooltip content={interpolate(t.rateChecker.spreadExplainer, { spread })}>
                  <button
                    type="button"
                    aria-label={t.rateChecker.spreadInfoLabel}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-faint transition-colors duration-150 hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                  >
                    <Info aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>
              </dt>
              <dd className="flex flex-wrap items-center justify-end gap-2">
                <RateEquation
                  base={rate.quoteBase}
                  value={rate.ourPriceDisplay}
                  currency={rate.quoteCurrency}
                  className="font-medium text-fg"
                />
                <Badge variant="accent" size="sm">
                  {interpolate(t.rateChecker.spreadBadge, { spread })}
                </Badge>
              </dd>
            </div>
          </dl>
          {rate.derived ? (
            <p className="text-center text-xs text-faint">
              {interpolate(t.rateChecker.derivedNote, { sources: rate.sources.join(", ") })}
            </p>
          ) : null}
          {stale && rc.lastUpdatedAt ? (
            <p className="text-center text-xs text-warning">
              {interpolate(t.rateChecker.staleNote, { time: formatRelativeTime(rc.rate?.updatedAt ?? rc.lastUpdatedAt) })}
            </p>
          ) : null}
        </>
      ) : (
        <div role="status" className="rounded-xl border border-dashed border-line-strong px-5 py-6 text-center">
          <p className="text-sm font-medium text-fg">{t.rateChecker.unavailableTitle}</p>
          <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted">{t.rateChecker.unavailableBody}</p>
          <Button variant="secondary" size="sm" className="mt-4" leftIcon={<RefreshCw />} onClick={() => rc.refresh()}>
            {t.common.retry}
          </Button>
        </div>
      )}

      <p className="text-center text-xs leading-relaxed text-muted">{t.rateChecker.disclaimer}</p>
    </div>
  );
}
