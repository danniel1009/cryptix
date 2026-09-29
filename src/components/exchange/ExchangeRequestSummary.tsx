"use client";

import { PencilLine, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CurrencyIcon } from "@/components/ui/CurrencyIcon";
import { interpolate } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { ExchangeRequestFormApi } from "./useExchangeRequestForm";

export interface ExchangeRequestSummaryProps {
  form: ExchangeRequestFormApi;
  /** Id of the element that labels the summary region (the "You are requesting" label). */
  labelId: string;
}

/**
 * Header of the request form: what the visitor is REQUESTING — "1,000.00 USDT →
 * 0.00952381 BTC" — and the indicative rate it is based on. The numbers follow
 * the form (edit the amount or the pair and the line recalculates from the live
 * rate); when the market cannot quote the pair, the rate the rate checker showed
 * at click time is used and labelled with its capture time. It is an indication
 * the team confirms, never a quote or an order.
 */
export function ExchangeRequestSummary({ form, labelId }: ExchangeRequestSummaryProps) {
  const { t, formatAmount, formatPrice, formatSpread, formatTime, formatRelativeTime } = useI18n();
  const {
    pair,
    amount,
    estimate,
    summaryRate,
    marketStatus,
    connection,
    lastUpdatedAt,
    hasPrefill,
    detailsOpen,
    openDetails,
  } = form;
  const copy = t.exchangeRequest.summary;

  const hasAmount = Number.isFinite(amount) && amount > 0;
  const sent = hasAmount ? formatAmount(amount, pair.from) : pair.from;
  const received = estimate !== null ? formatAmount(estimate, pair.to) : pair.to;
  /** One text node on purpose: read in one go by assistive tech, wraps at the arrow on narrow screens. */
  const line = `${sent} → ${received}`;

  const isStale = marketStatus === "stale";
  const dimmed = summaryRate?.source === "live" && isStale;

  /* Market state notes: rare changes, so a polite live region. */
  const marketNotes: { key: string; text: string; tone: "warning" | "muted" }[] = [];
  if (marketStatus === "unavailable") {
    marketNotes.push({ key: "unavailable", text: t.common.marketUnavailable, tone: "warning" });
  } else if (isStale && lastUpdatedAt) {
    marketNotes.push({
      key: "stale",
      text: interpolate(t.common.updatedAgo, { time: formatRelativeTime(lastUpdatedAt) }),
      tone: "warning",
    });
  }
  if (connection === "reconnecting" || connection === "polling" || connection === "offline") {
    marketNotes.push({ key: connection, text: t.exchangeRequest.marketNote[connection], tone: "muted" });
  }

  let rateBlock: ReactNode;
  if (summaryRate) {
    rateBlock = (
      <div className={cn("flex flex-col gap-1.5 transition-opacity duration-300", dimmed && "opacity-80")}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-xs text-muted">{copy.rate}</span>
          <span className="nums font-mono text-sm font-medium text-fg">
            {`1 ${summaryRate.quoteBase} = ${formatPrice(summaryRate.ourPriceDisplay, summaryRate.quoteCurrency)}`}
          </span>
          <Badge size="sm" className="sm:ml-auto">
            {interpolate(t.common.spreadBadge, { spread: formatSpread(summaryRate.spread) })}
          </Badge>
        </div>
        <p className="text-xs leading-relaxed text-faint">
          {interpolate(copy.marketNote, {
            market: formatPrice(summaryRate.marketPriceDisplay, summaryRate.quoteCurrency),
            spread: formatSpread(summaryRate.spread),
          })}
        </p>
        {summaryRate.capturedAt ? (
          <p className="text-xs leading-relaxed text-faint">
            {interpolate(copy.capturedAt, { time: formatTime(summaryRate.capturedAt) })}
          </p>
        ) : null}
      </div>
    );
  } else {
    rateBlock = <p className="text-xs leading-relaxed text-muted">{t.exchangeRequest.estimateUnavailableHint}</p>;
  }

  return (
    <section
      aria-labelledby={labelId}
      className="relative overflow-hidden rounded-2xl border border-accent/20 bg-accent-soft/60 p-4 sm:p-5"
    >
      {/* Soft light from the top-left corner, like the hero's glowing line. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-accent/15 blur-3xl"
      />

      <div className="relative flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <p id={labelId} className="pt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
            {copy.title}
          </p>
          {!detailsOpen ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={openDetails}
              leftIcon={<PencilLine />}
              className="-mr-2 -mt-1 h-8 px-2.5 text-muted hover:text-fg"
            >
              {t.exchangeRequest.editDetails}
            </Button>
          ) : null}
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <span className="flex shrink-0 items-center -space-x-2.5">
            <CurrencyIcon code={pair.from} size={32} decorative />
            <CurrencyIcon code={pair.to} size={32} decorative className="rounded-full ring-2 ring-surface" />
          </span>
          <p className="nums min-w-0 font-mono text-xl leading-tight tracking-[-0.01em] text-fg sm:text-2xl">{line}</p>
        </div>

        <div className="border-t border-accent/15 pt-4">{rateBlock}</div>

        <div aria-live="polite" className="flex flex-col gap-1.5 empty:hidden">
          {marketNotes.map((note) => (
            <p
              key={note.key}
              className={cn(
                "flex items-start gap-2 text-xs leading-relaxed",
                note.tone === "warning" ? "text-warning" : "text-muted",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full",
                  note.tone === "warning" ? "bg-warning" : "border border-muted",
                )}
              />
              {note.text}
            </p>
          ))}
        </div>

        {hasPrefill ? (
          <p className="flex items-center gap-2 text-xs text-faint">
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={1.75} />
            <span>{t.exchangeRequest.prefillNote}</span>
          </p>
        ) : null}
      </div>
    </section>
  );
}
