"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import {
  AMOUNT_LIMITS,
  DEFAULT_EXCHANGE_SPREAD,
  DEFAULT_PAIR_ID,
  SUPPORTED_PAIRS,
  getPairById,
  isPairId,
  type ExchangePair,
  type PairId,
} from "@/config/exchange";
import { submitExchangeRequest, type SubmitErrorCode } from "@/lib/api/client";
import { formatAmount, parseAmountInput } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/types";
import { calculateReceive } from "@/lib/market/rates";
import type { IndicativeRate, MarketStatus } from "@/lib/market/types";
import {
  validateExchangeRequest,
  type ExchangeRequestInput,
  type ValidationErrorCode,
} from "@/lib/validation/schemas";
import type { ExchangeRequestPrefill } from "@/providers/ExchangeRequestProvider";
import { useMarket, type MarketConnection } from "@/providers/MarketProvider";

/**
 * State machine of the exchange request form (values → validation → submit →
 * success). Pure UI state; the API contract lives in `@/lib/api/client` and
 * the rules in `@/lib/validation/schemas`.
 *
 * Live estimate: while the visitor has not typed into the estimate field
 * themselves, the displayed estimate is DERIVED every render from the market
 * rate (`useMarket().getRate(pairId)` × amount), so it follows the feed with
 * no effects and no stale copies. Once edited it is frozen until
 * `recalculate()` hands it back to the live rate. When market data is
 * unavailable nothing is computed; the field keeps whatever it holds (the
 * prefill or the visitor's own number) and the team confirms the final rate.
 */

/** Text fields the visitor types into (amount/estimate are kept as typed text). */
export type ExchangeRequestFieldName =
  | "fullName"
  | "whatsapp"
  | "email"
  | "pairId"
  | "amount"
  | "estimatedReceive"
  | "message"
  | "consent";

export type ExchangeRequestFieldErrors = Partial<Record<ExchangeRequestFieldName, ValidationErrorCode>>;

/** Non-field API outcomes; every one has a message in `t.form.errors`. */
export type ExchangeRequestFormErrorCode = Exclude<SubmitErrorCode, "validation_error">;

export interface ExchangeRequestFormValues {
  fullName: string;
  whatsapp: string;
  email: string;
  pairId: PairId;
  /** As typed, in either locale convention ("1,000.50" / "1.000,50"). */
  amountText: string;
  /** Only meaningful while `estimateEdited` (or as the prefill seed before the market answers). */
  estimateText: string;
  estimateEdited: boolean;
  message: string;
  consent: boolean;
  /** Honeypot — humans never see the field, so it must stay "". */
  hp: string;
}

export type EstimateMode =
  /** Derived from the live rate; follows pair/amount/feed changes. */
  | "live"
  /** The visitor typed their own number; auto-update paused. */
  | "edited"
  /** Market data unavailable: nothing is computed, the field is free text. */
  | "unavailable";

export interface ExchangeRequestSuccess {
  reference: string;
  pairId: PairId;
  amount: number;
  estimatedReceive: number | null;
}

export interface UseExchangeRequestFormOptions {
  prefill: ExchangeRequestPrefill | null;
  /** The <form> element, so the first invalid control can receive focus after a failed submit. */
  formRef?: RefObject<HTMLFormElement | null>;
}

export interface ExchangeRequestFormApi {
  values: ExchangeRequestFormValues;
  errors: ExchangeRequestFieldErrors;
  formError: ExchangeRequestFormErrorCode | null;
  submitting: boolean;
  success: ExchangeRequestSuccess | null;
  hasPrefill: boolean;
  pair: ExchangePair;
  rate: IndicativeRate | undefined;
  marketStatus: MarketStatus;
  connection: MarketConnection;
  lastUpdatedAt: Date | null;
  /** Effective spread (from the snapshot; the static default before the market answers). */
  spread: number;
  /** Parsed `amountText`; NaN when empty or invalid. */
  amount: number;
  /** What the estimate input shows right now. */
  estimateText: string;
  estimateMode: EstimateMode;
  /** True when a live estimate can be produced for the current pair. */
  canCompute: boolean;
  setText: (field: "fullName" | "whatsapp" | "email" | "message", value: string) => void;
  setPairId: (pairId: string) => void;
  setAmountText: (value: string) => void;
  setEstimateText: (value: string) => void;
  setConsent: (value: boolean) => void;
  setHp: (value: string) => void;
  /** Hand the estimate back to the live rate after a manual edit. */
  recalculate: () => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
  /** After a success: keep the contact details, clear the exchange details, back to the form. */
  startAnother: () => void;
}

const FIELD_NAMES: readonly ExchangeRequestFieldName[] = [
  "fullName",
  "whatsapp",
  "email",
  "pairId",
  "amount",
  "estimatedReceive",
  "message",
  "consent",
];

function isFieldName(value: string): value is ExchangeRequestFieldName {
  return (FIELD_NAMES as readonly string[]).includes(value);
}

/** Keep only errors for fields this form renders (the wire may name anything). */
export function pickFieldErrors(
  errors: Partial<Record<string, ValidationErrorCode>>,
): ExchangeRequestFieldErrors {
  const picked: ExchangeRequestFieldErrors = {};
  for (const [field, code] of Object.entries(errors)) {
    if (code && isFieldName(field)) picked[field] = code;
  }
  return picked;
}

function initialValues(
  prefill: ExchangeRequestPrefill | null,
  locale: Locale,
  keep?: Pick<ExchangeRequestFormValues, "fullName" | "whatsapp" | "email">,
): ExchangeRequestFormValues {
  const pairId = prefill && isPairId(prefill.pairId) ? prefill.pairId : DEFAULT_PAIR_ID;
  const pair = getPairById(pairId) ?? SUPPORTED_PAIRS[0];
  const amount = prefill?.amount;
  const estimate = prefill?.estimatedReceive;
  return {
    fullName: keep?.fullName ?? "",
    whatsapp: keep?.whatsapp ?? "",
    email: keep?.email ?? "",
    pairId,
    amountText:
      typeof amount === "number" && Number.isFinite(amount) && amount > 0
        ? formatAmount(locale, amount, pair.from, { withSymbol: false })
        : "",
    estimateText:
      typeof estimate === "number" && Number.isFinite(estimate) && estimate > 0
        ? formatAmount(locale, estimate, pair.to, { withSymbol: false })
        : "",
    estimateEdited: false,
    message: "",
    consent: false,
    hp: "",
  };
}

function withoutError(errors: ExchangeRequestFieldErrors, field: ExchangeRequestFieldName): ExchangeRequestFieldErrors {
  if (!(field in errors)) return errors;
  const next = { ...errors };
  delete next[field];
  return next;
}

export function useExchangeRequestForm({ prefill, formRef }: UseExchangeRequestFormOptions): ExchangeRequestFormApi {
  const { locale } = useI18n();
  const { snapshot, getRate, status: marketStatus, connection, lastUpdatedAt } = useMarket();

  const [values, setValues] = useState<ExchangeRequestFormValues>(() => initialValues(prefill, locale));
  const [errors, setErrors] = useState<ExchangeRequestFieldErrors>({});
  const [formError, setFormError] = useState<ExchangeRequestFormErrorCode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<ExchangeRequestSuccess | null>(null);

  /** Render timestamp for the anti-spam `ts` field (taken on mount, not during render). */
  const tsRef = useRef<number | null>(null);
  /** Re-entrancy guard for submit: a ref, so a stale closure can never double-send. */
  const inFlightRef = useRef(false);
  /** Aborts the in-flight request on unmount so no result lands on a dead form. */
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    tsRef.current = Date.now();
    const controller = new AbortController();
    abortRef.current = controller;
    return () => {
      controller.abort();
      abortRef.current = null;
      inFlightRef.current = false;
    };
  }, []);

  /* ────────────── derived market / estimate state ────────────── */

  const pair = getPairById(values.pairId) ?? SUPPORTED_PAIRS[0];
  const rate = getRate(pair.id);
  const amount = parseAmountInput(values.amountText);
  const canCompute = marketStatus !== "unavailable" && rate !== undefined;

  const computed = canCompute && rate ? calculateReceive(rate, amount) : 0;

  const estimateMode: EstimateMode = values.estimateEdited ? "edited" : canCompute ? "live" : "unavailable";
  const estimateText =
    estimateMode === "live"
      ? computed > 0
        ? formatAmount(locale, computed, pair.to, { withSymbol: false })
        : ""
      : values.estimateText;

  /* ────────────── field setters ────────────── */

  const setText = useCallback((field: "fullName" | "whatsapp" | "email" | "message", value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => withoutError(prev, field));
    setFormError(null);
  }, []);

  const setPairId = useCallback((next: string) => {
    if (!isPairId(next)) return;
    setValues((prev) => {
      if (prev.pairId === next) return prev;
      // A pair change invalidates a prefilled estimate (it belonged to the old pair);
      // a manual edit is the visitor's own number and is kept.
      return { ...prev, pairId: next, estimateText: prev.estimateEdited ? prev.estimateText : "" };
    });
    setErrors((prev) => withoutError(withoutError(prev, "pairId"), "amount"));
    setFormError(null);
  }, []);

  const setAmountText = useCallback((value: string) => {
    setValues((prev) => ({
      ...prev,
      amountText: value,
      estimateText: prev.estimateEdited ? prev.estimateText : "",
    }));
    setErrors((prev) => withoutError(prev, "amount"));
    setFormError(null);
  }, []);

  const setEstimateText = useCallback((value: string) => {
    setValues((prev) => ({ ...prev, estimateText: value, estimateEdited: true }));
    setErrors((prev) => withoutError(prev, "estimatedReceive"));
    setFormError(null);
  }, []);

  const recalculate = useCallback(() => {
    setValues((prev) => ({ ...prev, estimateText: "", estimateEdited: false }));
    setErrors((prev) => withoutError(prev, "estimatedReceive"));
  }, []);

  const setConsent = useCallback((value: boolean) => {
    setValues((prev) => ({ ...prev, consent: value }));
    setErrors((prev) => withoutError(prev, "consent"));
    setFormError(null);
  }, []);

  const setHp = useCallback((value: string) => {
    setValues((prev) => ({ ...prev, hp: value }));
  }, []);

  /* ────────────── submit ────────────── */

  const focusFirstInvalid = useCallback(() => {
    // Runs after React has committed the error state (aria-invalid is set).
    requestAnimationFrame(() => {
      formRef?.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    });
  }, [formRef]);

  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (inFlightRef.current) return;

      const trimmedEstimate = estimateText.trim();
      const parsedEstimate = trimmedEstimate.length > 0 ? parseAmountInput(trimmedEstimate) : null;
      const candidate = {
        fullName: values.fullName,
        whatsapp: values.whatsapp,
        email: values.email,
        pairId: values.pairId,
        // Empty → undefined so the schema reports "required" rather than "invalid_amount".
        amount: values.amountText.trim().length > 0 ? amount : undefined,
        estimatedReceive: parsedEstimate,
        message: values.message,
        consent: values.consent,
        hp: values.hp,
        ts: tsRef.current ?? undefined,
      };

      const validation = validateExchangeRequest(candidate);
      if (!validation.success) {
        setErrors(pickFieldErrors(validation.errors));
        setFormError(validation.errors._form ? "unknown" : null);
        focusFirstInvalid();
        return;
      }

      const payload: ExchangeRequestInput = { ...candidate, amount: validation.data.amount };
      const signal = abortRef.current?.signal;

      inFlightRef.current = true;
      setSubmitting(true);
      setFormError(null);
      setErrors({});

      void submitExchangeRequest(payload, { locale, signal }).then((result) => {
        if (signal?.aborted) return; // unmounted while waiting
        inFlightRef.current = false;
        setSubmitting(false);
        if (result.ok) {
          setSuccess({
            reference: result.reference,
            pairId: values.pairId,
            amount: validation.data.amount,
            estimatedReceive: validation.data.estimatedReceive,
          });
          return;
        }
        if (result.code === "validation_error") {
          const fieldErrors = pickFieldErrors(result.errors);
          setErrors(fieldErrors);
          // A validation error that names no field we render still needs a visible outcome.
          setFormError(Object.keys(fieldErrors).length === 0 ? "unknown" : null);
          focusFirstInvalid();
          return;
        }
        setFormError(result.code);
      });
    },
    [amount, estimateText, focusFirstInvalid, locale, values],
  );

  const startAnother = useCallback(() => {
    tsRef.current = Date.now();
    inFlightRef.current = false;
    setValues((prev) =>
      initialValues(null, locale, { fullName: prev.fullName, whatsapp: prev.whatsapp, email: prev.email }),
    );
    setErrors({});
    setFormError(null);
    setSubmitting(false);
    setSuccess(null);
  }, [locale]);

  return {
    values,
    errors,
    formError,
    submitting,
    success,
    hasPrefill: prefill !== null,
    pair,
    rate,
    marketStatus,
    connection,
    lastUpdatedAt,
    spread: snapshot?.spread ?? DEFAULT_EXCHANGE_SPREAD,
    amount,
    estimateText,
    estimateMode,
    canCompute,
    setText,
    setPairId,
    setAmountText,
    setEstimateText,
    setConsent,
    setHp,
    recalculate,
    submit,
    startAnother,
  };
}

/** Amount limits of the pair's SENT currency (informational; the team confirms final terms). */
export function amountLimitsFor(pair: ExchangePair): { min: number; max: number } {
  return AMOUNT_LIMITS[pair.from];
}
