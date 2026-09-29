"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import {
  AMOUNT_LIMITS,
  DEFAULT_EXCHANGE_SPREAD,
  DEFAULT_PAIR_ID,
  SUPPORTED_PAIRS,
  getPairById,
  isCurrencyCode,
  isPairId,
  type CurrencyCode,
  type ExchangePair,
  type PairId,
} from "@/config/exchange";
import { submitExchangeRequest, type SubmitErrorCode } from "@/lib/api/client";
import { formatAmount, parseAmountInput } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";
import { INTL_LOCALES, type Locale } from "@/lib/i18n/types";
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
 *
 * Summary rate (the header "Indicative rate 1 BTC = …"): the LIVE rate for
 * the current pair whenever the market can quote it; otherwise the rate the
 * rate checker showed when the visitor clicked "Request exchange"
 * (`prefill.rateSnapshot`, labelled with its capture time); otherwise nothing.
 *
 * Details group: opened WITH a prefill the pair / amount / estimate fields are
 * collapsed behind "Edit details"; opened without one they are expanded. Any
 * validation error on one of those fields (client or server) expands them.
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
  /**
   * The exact number `amountText` was formatted from (prefill); null once the
   * visitor edits the text, which is then parsed instead. Keeps "1,000,000"
   * (IDR) exact — grouped integers are ambiguous for a locale-agnostic parser.
   */
  amountValue: number | null;
  /** Only meaningful while `estimateEdited` (or as the prefill seed before the market answers). */
  estimateText: string;
  /** Same role as `amountValue`, for the prefilled estimate. */
  estimateValue: number | null;
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

/**
 * The rate quoted in the summary header, in the pair's display direction
 * ("1 quoteBase = ourPriceDisplay quoteCurrency"). Never a quote or an order —
 * an indication the team confirms.
 */
export interface SummaryRate {
  /** `live` = current market feed; `snapshot` = the rate shown in the rate checker when the modal was opened. */
  source: "live" | "snapshot";
  quoteBase: CurrencyCode;
  quoteCurrency: CurrencyCode;
  marketPriceDisplay: number;
  ourPriceDisplay: number;
  spread: number;
  /**
   * ISO time at which the rate checker showed exactly this rate; null when the
   * displayed number no longer matches what the visitor saw (the feed moved).
   */
  capturedAt: string | null;
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
  /** True while the form still holds values carried over from the rate checker. */
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
  /** `estimateText` as a positive number, or null when empty / not a number. */
  estimate: number | null;
  estimateMode: EstimateMode;
  /** True when a live estimate can be produced for the current pair. */
  canCompute: boolean;
  /** Rate for the summary header (live, else the prefill snapshot), null when neither exists. */
  summaryRate: SummaryRate | null;
  /** Whether the pair / amount / estimate group is expanded. */
  detailsOpen: boolean;
  /** Expand the pair / amount / estimate group ("Edit details"). One-way. */
  openDetails: () => void;
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

/** Fields rendered inside the collapsible "Exchange details" group. */
export const DETAIL_FIELD_NAMES: readonly ExchangeRequestFieldName[] = ["pairId", "amount", "estimatedReceive"];

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

/** True when any error belongs to the collapsible details group. */
export function hasDetailErrors(errors: ExchangeRequestFieldErrors): boolean {
  return DETAIL_FIELD_NAMES.some((field) => errors[field] !== undefined);
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Parse text that THIS form produced with `formatAmount(locale, …)` back into
 * a number, using the locale's own group / decimal separators. Exact for our
 * own output ("15,700,000" → 15 700 000, "0,00952381" → 0.00952381); never used
 * for what the visitor typed (that may follow either convention and goes
 * through `parseAmountInput`).
 */
function parseFormattedAmount(locale: Locale, text: string): number {
  const parts = new Intl.NumberFormat(INTL_LOCALES[locale]).formatToParts(1234.5);
  const group = parts.find((p) => p.type === "group")?.value ?? ",";
  const decimal = parts.find((p) => p.type === "decimal")?.value ?? ".";
  const normalized = text.trim().split(group).join("").replace(decimal, ".");
  return normalized.length > 0 ? Number(normalized) : NaN;
}

/**
 * The prefill's rate snapshot, if it still describes `pair`: it was captured
 * for the prefilled pair, so a pair change makes it meaningless. Malformed
 * snapshots (the provider type is loose) are ignored rather than displayed.
 */
export function snapshotRateFor(prefill: ExchangeRequestPrefill | null, pair: ExchangePair): SummaryRate | null {
  const snap = prefill?.rateSnapshot;
  if (!snap || prefill.pairId !== pair.id) return null;
  if (!isPositiveNumber(snap.marketPriceDisplay) || !isPositiveNumber(snap.ourPriceDisplay)) return null;
  if (!isCurrencyCode(snap.quoteBase) || !isCurrencyCode(snap.quoteCurrency)) return null;
  const currencies = new Set<CurrencyCode>([pair.from, pair.to]);
  if (!currencies.has(snap.quoteBase) || !currencies.has(snap.quoteCurrency) || snap.quoteBase === snap.quoteCurrency) {
    return null;
  }
  const spread = Number.isFinite(snap.spread) && snap.spread >= 0 && snap.spread < 1 ? snap.spread : DEFAULT_EXCHANGE_SPREAD;
  const capturedAt =
    typeof snap.capturedAt === "string" && !Number.isNaN(Date.parse(snap.capturedAt)) ? snap.capturedAt : null;
  return {
    source: "snapshot",
    quoteBase: snap.quoteBase,
    quoteCurrency: snap.quoteCurrency,
    marketPriceDisplay: snap.marketPriceDisplay,
    ourPriceDisplay: snap.ourPriceDisplay,
    spread,
    capturedAt,
  };
}

function initialValues(
  prefill: ExchangeRequestPrefill | null,
  locale: Locale,
  keep?: Pick<ExchangeRequestFormValues, "fullName" | "whatsapp" | "email">,
): ExchangeRequestFormValues {
  const pairId = prefill && isPairId(prefill.pairId) ? prefill.pairId : DEFAULT_PAIR_ID;
  const pair = getPairById(pairId) ?? SUPPORTED_PAIRS[0];
  const amount = isPositiveNumber(prefill?.amount) ? prefill.amount : null;
  const estimate = isPositiveNumber(prefill?.estimatedReceive) ? prefill.estimatedReceive : null;
  return {
    fullName: keep?.fullName ?? "",
    whatsapp: keep?.whatsapp ?? "",
    email: keep?.email ?? "",
    pairId,
    amountText: amount !== null ? formatAmount(locale, amount, pair.from, { withSymbol: false }) : "",
    amountValue: amount,
    estimateText: estimate !== null ? formatAmount(locale, estimate, pair.to, { withSymbol: false }) : "",
    estimateValue: estimate,
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
  /** Cleared by "Submit another request", which resets the exchange details. */
  const [hasPrefill, setHasPrefill] = useState(prefill !== null);
  const [detailsOpen, setDetailsOpen] = useState(prefill === null);

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
  const amount = values.amountValue ?? parseAmountInput(values.amountText);
  const canCompute = marketStatus !== "unavailable" && rate !== undefined;

  const computed = canCompute && rate ? calculateReceive(rate, amount) : 0;

  const estimateMode: EstimateMode = values.estimateEdited ? "edited" : canCompute ? "live" : "unavailable";
  const estimateText =
    estimateMode === "live"
      ? computed > 0
        ? formatAmount(locale, computed, pair.to, { withSymbol: false })
        : ""
      : values.estimateText;
  /**
   * The estimate as a number, at the precision the visitor sees: null when the
   * field is empty, NaN when the visitor typed something that is not a number
   * (validation reports it). Live text is our own formatting, so it is read
   * back exactly; a prefilled text keeps its exact source number.
   */
  let estimateNumber: number | null;
  if (estimateMode === "live") {
    if (computed > 0) {
      const shown = parseFormattedAmount(locale, estimateText);
      estimateNumber = Number.isFinite(shown) && shown > 0 ? shown : computed;
    } else {
      estimateNumber = null;
    }
  } else if (values.estimateText.trim().length === 0) {
    estimateNumber = null;
  } else {
    estimateNumber = values.estimateValue ?? parseAmountInput(values.estimateText);
  }
  const estimate = estimateNumber !== null && Number.isFinite(estimateNumber) && estimateNumber > 0 ? estimateNumber : null;

  const snapshotRate = hasPrefill ? snapshotRateFor(prefill, pair) : null;
  let summaryRate: SummaryRate | null = null;
  if (canCompute && rate) {
    summaryRate = {
      source: "live",
      quoteBase: rate.quoteBase,
      quoteCurrency: rate.quoteCurrency,
      marketPriceDisplay: rate.marketPriceDisplay,
      ourPriceDisplay: rate.ourPriceDisplay,
      spread: rate.spread,
      // "Rate as shown at …" is only true while the live number still IS the one the visitor saw.
      capturedAt: snapshotRate && snapshotRate.ourPriceDisplay === rate.ourPriceDisplay ? snapshotRate.capturedAt : null,
    };
  } else if (snapshotRate) {
    summaryRate = snapshotRate;
  }

  /* ────────────── field setters ────────────── */

  const openDetails = useCallback(() => setDetailsOpen(true), []);

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
      return prev.estimateEdited
        ? { ...prev, pairId: next }
        : { ...prev, pairId: next, estimateText: "", estimateValue: null };
    });
    setErrors((prev) => withoutError(withoutError(prev, "pairId"), "amount"));
    setFormError(null);
  }, []);

  const setAmountText = useCallback((value: string) => {
    setValues((prev) => ({
      ...prev,
      amountText: value,
      amountValue: null,
      estimateText: prev.estimateEdited ? prev.estimateText : "",
      estimateValue: prev.estimateEdited ? prev.estimateValue : null,
    }));
    setErrors((prev) => withoutError(prev, "amount"));
    setFormError(null);
  }, []);

  const setEstimateText = useCallback((value: string) => {
    setValues((prev) => ({ ...prev, estimateText: value, estimateValue: null, estimateEdited: true }));
    setErrors((prev) => withoutError(prev, "estimatedReceive"));
    setFormError(null);
  }, []);

  const recalculate = useCallback(() => {
    setValues((prev) => ({ ...prev, estimateText: "", estimateValue: null, estimateEdited: false }));
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

  /** Apply field errors; a collapsed details group must open so its errors can be seen and focused. */
  const showFieldErrors = useCallback(
    (fieldErrors: ExchangeRequestFieldErrors) => {
      setErrors(fieldErrors);
      if (hasDetailErrors(fieldErrors)) setDetailsOpen(true);
      focusFirstInvalid();
    },
    [focusFirstInvalid],
  );

  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (inFlightRef.current) return;

      const candidate = {
        fullName: values.fullName,
        whatsapp: values.whatsapp,
        email: values.email,
        pairId: values.pairId,
        // Empty → undefined so the schema reports "required" rather than "invalid_amount".
        amount: values.amountText.trim().length > 0 ? amount : undefined,
        estimatedReceive: estimateNumber,
        message: values.message,
        consent: values.consent,
        hp: values.hp,
        ts: tsRef.current ?? undefined,
      };

      const validation = validateExchangeRequest(candidate);
      if (!validation.success) {
        showFieldErrors(pickFieldErrors(validation.errors));
        setFormError(validation.errors._form ? "unknown" : null);
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
          showFieldErrors(fieldErrors);
          // A validation error that names no field we render still needs a visible outcome.
          setFormError(Object.keys(fieldErrors).length === 0 ? "unknown" : null);
          return;
        }
        setFormError(result.code);
      });
    },
    [amount, estimateNumber, locale, showFieldErrors, values],
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
    // The exchange details were cleared: nothing is pre-filled any more, and the visitor has to enter them.
    setHasPrefill(false);
    setDetailsOpen(true);
  }, [locale]);

  return {
    values,
    errors,
    formError,
    submitting,
    success,
    hasPrefill,
    pair,
    rate,
    marketStatus,
    connection,
    lastUpdatedAt,
    spread: snapshot?.spread ?? DEFAULT_EXCHANGE_SPREAD,
    amount,
    estimateText,
    estimate,
    estimateMode,
    canCompute,
    summaryRate,
    detailsOpen,
    openDetails,
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
