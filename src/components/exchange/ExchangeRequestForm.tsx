"use client";

import { CircleAlert, Info, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { interpolate } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { EXCHANGE_REQUEST_LIMITS } from "@/lib/validation/schemas";
import { PairSelect } from "./PairSelect";
import { amountLimitsFor, type ExchangeRequestFieldName, type ExchangeRequestFormApi } from "./useExchangeRequestForm";

export interface ExchangeRequestFormProps {
  /** The <form> id; the submit button lives in the modal footer and targets it via `form=`. */
  id: string;
  form: ExchangeRequestFormApi;
  /** The <form> element (owned by the dialog, shared with the hook for error focus). */
  formRef?: RefObject<HTMLFormElement | null>;
  /** Receives the first text field so the modal can move focus there on open. */
  firstFieldRef?: RefObject<HTMLInputElement | null>;
}

/** Tiny mono group label (uppercase by CSS only — the dictionary stays sentence case). */
function GroupLabel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">
      {children}
    </p>
  );
}

/** Preceded by a real space so the accessible name reads "Message (Optional)". */
function OptionalMark({ text }: { text: string }) {
  return (
    <>
      {" "}
      <span className="text-xs font-normal text-faint">({text})</span>
    </>
  );
}

/**
 * The request form body. Two-column field grid on sm+, single column on
 * mobile; the footer actions are rendered by the modal so they stay sticky
 * inside the sheet. Nothing here executes anything — it collects a request.
 */
export function ExchangeRequestForm({ id, form, formRef, firstFieldRef }: ExchangeRequestFormProps) {
  const { t, formatAmount, formatPrice, formatSpread, formatTime, formatRelativeTime } = useI18n();
  const uid = useId();
  const ids = {
    contact: `${uid}-contact`,
    exchange: `${uid}-exchange`,
    estimateNote: `${uid}-estimate-note`,
    hp: `${uid}-hp`,
  };
  const alertRef = useRef<HTMLDivElement | null>(null);

  const {
    values,
    errors,
    formError,
    hasPrefill,
    pair,
    rate,
    spread,
    marketStatus,
    connection,
    lastUpdatedAt,
    estimateText,
    estimateMode,
    canCompute,
  } = form;
  const fields = t.exchangeRequest.fields;
  const limits = amountLimitsFor(pair);

  const errorText = (field: ExchangeRequestFieldName): string | undefined => {
    const code = errors[field];
    return code ? t.validation[code] : undefined;
  };

  // A form-level error appears at the end of the form (next to the sticky actions);
  // bring it into view when it shows up. DOM-only effect, no state.
  useEffect(() => {
    if (!formError) return;
    const el = alertRef.current;
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest" });
  }, [formError]);

  const rateTime = lastUpdatedAt ?? (rate ? new Date(rate.updatedAt) : null);
  const isStale = marketStatus === "stale";
  const showRate = canCompute && rate !== undefined;

  /* Under the estimate field: what the number is based on right now. */
  let estimateNote: ReactNode;
  if (estimateMode === "edited") {
    estimateNote = (
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>{t.exchangeRequest.estimateEditedNote}</span>
        {canCompute ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={form.recalculate}
            leftIcon={<RefreshCw />}
            className="-my-1 h-8 px-2.5 text-accent hover:text-accent"
          >
            {t.exchangeRequest.recalculate}
          </Button>
        ) : null}
      </span>
    );
  } else if (estimateMode === "live" && rateTime) {
    estimateNote = interpolate(t.exchangeRequest.estimatedHint, { time: formatTime(rateTime) });
  } else if (estimateMode === "live") {
    estimateNote = fields.estimatedReceive.placeholder;
  } else {
    estimateNote = t.exchangeRequest.estimateUnavailableHint;
  }

  /* Market state notes: shown next to the rate; rare changes, so a polite live region. */
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

  return (
    <form
      id={id}
      ref={formRef}
      onSubmit={form.submit}
      noValidate
      autoComplete="on"
      className="relative flex flex-col gap-8"
    >
      {hasPrefill ? (
        <p className="flex w-fit max-w-full items-center gap-2 rounded-full border border-accent/20 bg-accent-soft/40 px-3.5 py-2 text-xs text-muted">
          <Sparkles aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={1.75} />
          <span>{t.exchangeRequest.prefillNote}</span>
        </p>
      ) : null}

      {/* ─────────────── Contact details ─────────────── */}
      <div role="group" aria-labelledby={ids.contact} className="flex flex-col gap-4">
        <GroupLabel id={ids.contact}>{t.exchangeRequest.sectionContact}</GroupLabel>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            ref={firstFieldRef}
            name="fullName"
            label={fields.fullName.label}
            placeholder={fields.fullName.placeholder}
            autoComplete="name"
            maxLength={EXCHANGE_REQUEST_LIMITS.fullName.max}
            required
            value={values.fullName}
            onChange={(event) => form.setText("fullName", event.target.value)}
            error={errorText("fullName")}
          />
          <Input
            name="whatsapp"
            type="tel"
            inputMode="tel"
            label={fields.whatsapp.label}
            placeholder={fields.whatsapp.placeholder}
            autoComplete="tel"
            required
            value={values.whatsapp}
            onChange={(event) => form.setText("whatsapp", event.target.value)}
            error={errorText("whatsapp")}
          />
          <Input
            name="email"
            type="email"
            inputMode="email"
            label={fields.email.label}
            placeholder={fields.email.placeholder}
            autoComplete="email"
            maxLength={EXCHANGE_REQUEST_LIMITS.email.max}
            required
            value={values.email}
            onChange={(event) => form.setText("email", event.target.value)}
            error={errorText("email")}
            wrapperClassName="sm:col-span-2"
          />
        </div>
      </div>

      {/* ─────────────── Exchange details ─────────────── */}
      <div role="group" aria-labelledby={ids.exchange} className="flex flex-col gap-4">
        <GroupLabel id={ids.exchange}>{t.exchangeRequest.sectionExchange}</GroupLabel>
        <PairSelect
          name="pairId"
          label={fields.pair.label}
          required
          value={values.pairId}
          onValueChange={form.setPairId}
          error={errorText("pairId")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            name="amount"
            inputMode="decimal"
            mono
            label={fields.amount.label}
            placeholder={fields.amount.placeholder}
            autoComplete="off"
            required
            value={values.amountText}
            onChange={(event) => form.setAmountText(event.target.value)}
            rightAddon={pair.from}
            error={errorText("amount")}
            hint={interpolate(t.exchangeRequest.amountHint, {
              min: formatAmount(limits.min, pair.from, { compact: true }),
              max: formatAmount(limits.max, pair.from, { compact: true }),
            })}
          />
          <div>
            <Input
              name="estimatedReceive"
              inputMode="decimal"
              mono
              label={fields.estimatedReceive.label}
              placeholder={fields.estimatedReceive.placeholder}
              autoComplete="off"
              value={estimateText}
              onChange={(event) => form.setEstimateText(event.target.value)}
              rightAddon={pair.to}
              error={errorText("estimatedReceive")}
              aria-describedby={ids.estimateNote}
              className={cn(isStale && estimateMode === "live" && "text-muted")}
            />
            <div id={ids.estimateNote} className="mt-2 text-xs leading-relaxed text-faint">
              {estimateNote}
            </div>
          </div>
        </div>

        {showRate ? (
          <div
            className={cn(
              "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-surface-2/60 px-4 py-3",
              isStale && "opacity-70",
            )}
          >
            <span className="text-xs text-muted">{t.common.ourRate}</span>
            <span className="font-mono nums text-sm text-fg">
              {formatAmount(1, rate.quoteBase, { compact: true })} = {formatPrice(rate.ourPriceDisplay, rate.quoteCurrency)}
            </span>
            <Badge size="sm" className="ml-auto">
              {interpolate(t.common.spreadBadge, { spread: formatSpread(spread) })}
            </Badge>
          </div>
        ) : null}

        <div aria-live="polite" className={cn("flex flex-col gap-1.5", marketNotes.length === 0 && "hidden")}>
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
      </div>

      <Textarea
        name="message"
        rows={3}
        label={
          <>
            {fields.message.label}
            <OptionalMark text={t.common.optional} />
          </>
        }
        placeholder={fields.message.placeholder}
        maxLength={EXCHANGE_REQUEST_LIMITS.message.max}
        value={values.message}
        onChange={(event) => form.setText("message", event.target.value)}
        error={errorText("message")}
        className="min-h-[96px]"
      />

      {/* ─────────────── Disclaimer + consent ─────────────── */}
      <div className="flex flex-col gap-4">
        <div className="flex gap-3 rounded-xl border border-accent/20 bg-accent-soft/40 px-4 py-3.5">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Info aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
          <p className="text-sm leading-relaxed text-muted">{t.exchangeRequest.disclaimer}</p>
        </div>
        <Checkbox
          name="consent"
          label={t.exchangeRequest.consent}
          checked={values.consent}
          onChange={(event) => form.setConsent(event.target.checked)}
          error={errorText("consent")}
        />
        <p className="text-xs text-faint">{t.exchangeRequest.noAccountNote}</p>
      </div>

      {formError ? (
        <div
          ref={alertRef}
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-fg"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-danger" strokeWidth={1.75} />
          <span>{t.form.errors[formError]}</span>
        </div>
      ) : null}

      {/* Honeypot: off-screen, out of the tab order, hidden from AT. Bots fill it; humans cannot. */}
      <div aria-hidden="true" className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden">
        <label htmlFor={ids.hp}>{t.form.honeypotLabel}</label>
        <input
          id={ids.hp}
          name="hp"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={values.hp}
          onChange={(event) => form.setHp(event.target.value)}
        />
      </div>
    </form>
  );
}
