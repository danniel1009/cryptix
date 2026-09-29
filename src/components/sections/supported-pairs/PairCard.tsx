"use client";

import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CurrencyIcon } from "@/components/ui/CurrencyIcon";
import { CURRENCIES, pairLabel, type ExchangePair, type PairId } from "@/config/exchange";
import { interpolate } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import type { IndicativeRate, MarketStatus } from "@/lib/market/types";
import { cn } from "@/lib/utils";

export interface PairCardProps {
  pair: ExchangePair;
  /** Indicative rate from the market snapshot, when one exists for this pair. */
  rate: IndicativeRate | undefined;
  status: MarketStatus;
  onCheckRate: (pairId: PairId) => void;
}

/**
 * One supported pair: coin marks, "USDT → BTC", the currency names, the live
 * indicative line (our price + market reference) and a "Check rate" button.
 *
 * Old numbers are never shown as live: when `status` is "unavailable" the
 * rate block falls back to the indicative placeholder even if a stale
 * snapshot is still in memory. Stale data stays visible but de-emphasised.
 */
export function PairCard({ pair, rate, status, onCheckRate }: PairCardProps) {
  const { t, formatPrice } = useI18n();
  const from = CURRENCIES[pair.from];
  const to = CURRENCIES[pair.to];
  const label = pairLabel(pair);
  const showRate = rate !== undefined && status !== "unavailable";
  const stale = status === "stale";

  return (
    <Card interactive padding="md" className="flex h-full w-full flex-col">
      {/* Coin marks */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2" aria-hidden="true">
          <CurrencyIcon code={pair.from} size={40} decorative />
          <ArrowRight className="h-4 w-4 text-faint" strokeWidth={1.75} />
          <CurrencyIcon code={pair.to} size={40} decorative />
        </div>
        {from.network ? (
          <Badge variant="neutral" size="sm">
            {from.network}
          </Badge>
        ) : null}
      </div>

      {/* Label + names */}
      <div className="mt-5">
        <h3 className="nums font-mono text-lg font-medium tracking-tight text-fg">{label}</h3>
        <p className="mt-1 text-sm text-muted">
          <span className="sr-only">{t.pairs.youSend}: </span>
          {from.name}
          <span aria-hidden="true"> → </span>
          <span className="sr-only">{t.pairs.youReceive}: </span>
          {to.name}
        </p>
      </div>

      {/* Indicative rate */}
      <div
        aria-live="polite"
        className="mt-5 rounded-xl border border-line bg-surface-2/60 px-4 py-3.5"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-faint">
            {showRate ? t.pairs.ourRate : t.pairs.indicativeLabel}
          </span>
          {showRate && stale ? (
            <Badge variant="warning" size="sm">
              {t.market.stale}
            </Badge>
          ) : null}
        </div>
        {showRate ? (
          <>
            <p
              className={cn(
                "nums mt-1.5 font-mono text-base font-medium tracking-tight sm:text-lg",
                stale ? "text-muted" : "text-fg",
              )}
            >
              1 {rate.quoteBase} = {formatPrice(rate.ourPriceDisplay, rate.quoteCurrency)}
            </p>
            <p className="nums mt-1 font-mono text-xs text-faint">
              {t.common.marketPrice} {formatPrice(rate.marketPriceDisplay, rate.quoteCurrency)}
            </p>
          </>
        ) : (
          <>
            <p className="nums mt-1.5 font-mono text-base font-medium tracking-tight text-faint sm:text-lg">
              1 {pair.quoteBase} = —
            </p>
            <p className="mt-1 text-xs text-faint">{t.common.marketPrice} —</p>
          </>
        )}
      </div>

      <Button
        variant="secondary"
        size="sm"
        fullWidth
        className="mt-5 h-11 sm:h-9"
        rightIcon={<ArrowRight />}
        aria-label={interpolate(t.pairs.checkRateFor, { pair: label })}
        onClick={() => onCheckRate(pair.id)}
      >
        {t.pairs.checkRate}
      </Button>
    </Card>
  );
}
