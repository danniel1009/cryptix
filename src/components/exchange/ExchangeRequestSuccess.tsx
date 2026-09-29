"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { SUPPORTED_PAIRS, getPairById, pairLabel } from "@/config/exchange";
import { interpolate } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import type { ExchangeRequestSuccess as SuccessInfo } from "./useExchangeRequestForm";

export interface ExchangeRequestSuccessProps {
  success: SuccessInfo;
  /** "Submit another request" — keeps the contact details, clears the exchange details. */
  onNewRequest: () => void;
}

/**
 * Render "Your reference: {reference}" with the reference itself in mono,
 * without splitting the sentence out of the dictionary.
 */
function ReferenceLine({ template, reference }: { template: string; reference: string }): ReactNode {
  const parts = template.split("{reference}");
  if (parts.length < 2) return interpolate(template, { reference });
  return (
    <>
      {parts[0]}
      <span className="font-mono font-medium tracking-wide text-fg">{reference}</span>
      {parts.slice(1).join(reference)}
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-mono nums text-sm text-fg">{value}</dd>
    </div>
  );
}

/**
 * Success state of the exchange request modal: the request was RECEIVED (not
 * executed). Shows the reference the team will quote back and a summary of
 * what was asked for. The WhatsApp / close actions live in the modal footer.
 */
export function ExchangeRequestSuccess({ success, onNewRequest }: ExchangeRequestSuccessProps) {
  const { t, formatAmount } = useI18n();
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const copy = t.exchangeRequest.success;
  const pair = getPairById(success.pairId) ?? SUPPORTED_PAIRS[0];

  // The submit button that had focus is gone; land focus on the outcome so
  // keyboard and screen-reader users hear it. DOM-only effect.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="flex flex-col items-center py-2 text-center sm:py-4">
      <span
        aria-hidden="true"
        className="relative flex h-16 w-16 items-center justify-center rounded-full border border-accent/30 bg-accent-soft text-accent shadow-glow-sm"
      >
        <span className="absolute inset-0 animate-halo rounded-full bg-accent/25" />
        <Check className="relative h-7 w-7" strokeWidth={2.25} />
      </span>

      <h3
        ref={headingRef}
        tabIndex={-1}
        className="mt-6 text-2xl font-medium tracking-[-0.02em] text-fg outline-none sm:text-3xl"
      >
        {copy.title}
      </h3>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted sm:text-base">{copy.body}</p>

      <p className="mt-6 rounded-full border border-line bg-surface-2 px-4 py-2 text-sm text-muted">
        <ReferenceLine template={copy.reference} reference={success.reference} />
      </p>

      <dl className="mt-6 w-full max-w-sm divide-y divide-line rounded-2xl border border-line bg-surface-2/60 text-left">
        <SummaryRow label={t.exchangeRequest.fields.pair.label} value={pairLabel(pair)} />
        <SummaryRow label={t.exchangeRequest.fields.amount.label} value={formatAmount(success.amount, pair.from)} />
        {success.estimatedReceive !== null ? (
          <SummaryRow
            label={t.exchangeRequest.fields.estimatedReceive.label}
            value={formatAmount(success.estimatedReceive, pair.to)}
          />
        ) : null}
      </dl>

      <p className="mt-5 max-w-md text-xs leading-relaxed text-faint">{t.exchangeRequest.disclaimer}</p>

      <Button type="button" variant="ghost" size="sm" onClick={onNewRequest} className="mt-4">
        {copy.newRequest}
      </Button>
    </div>
  );
}
