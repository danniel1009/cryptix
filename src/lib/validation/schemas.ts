import { z } from "zod";
import { AMOUNT_LIMITS, PAIR_IDS, getPairById, type PairId } from "@/config/exchange";
import { normalizePhone, sanitizeLine, sanitizeText } from "@/lib/security/sanitize";

/**
 * Shared zod 4 schemas for the contact form and the exchange request form.
 *
 * Used on BOTH sides: the browser runs them for instant feedback, the API
 * routes run them as the authority. Therefore this module must stay free of
 * server-only imports.
 *
 * Error MESSAGES ARE CODES. Every issue message is a `ValidationErrorCode`
 * which the UI maps to text via `t.validation[code]`. Rules:
 *   - missing / undefined value            → "required"
 *   - wrong JSON type (number for a string) → "invalid_value"
 *   - empty after trimming                 → "required"
 *   - the rest are field-specific (too_short, invalid_email, amount_too_small …)
 *
 * The transforms sanitise as they parse (trim, strip control characters,
 * collapse whitespace, normalise phones), so `data` returned by `validate*()`
 * is already safe to store and to render into e-mails after HTML escaping.
 */

export const VALIDATION_ERROR_CODES = [
  "required",
  "invalid_email",
  "invalid_phone",
  "too_short",
  "too_long",
  "invalid_pair",
  "invalid_amount",
  "amount_too_small",
  "amount_too_large",
  "consent_required",
  "invalid_value",
] as const;

export type ValidationErrorCode = (typeof VALIDATION_ERROR_CODES)[number];

export function isValidationErrorCode(value: unknown): value is ValidationErrorCode {
  return typeof value === "string" && (VALIDATION_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * First error code per field. `_form` carries issues that are not attached to
 * a field (e.g. the payload was not an object at all).
 */
export type FieldErrors<T> = Partial<Record<Extract<keyof T, string> | "_form", ValidationErrorCode>>;

export type ValidationResult<TInput, TData> =
  | { success: true; data: TData }
  | { success: false; errors: FieldErrors<TInput> };

/** Length limits, exported so inputs can set `maxLength` and copy can quote them. */
export const CONTACT_LIMITS = {
  name: { min: 2, max: 80 },
  email: { max: 120 },
  subject: { min: 3, max: 120 },
  message: { min: 10, max: 2000 },
} as const;

export const EXCHANGE_REQUEST_LIMITS = {
  fullName: { min: 2, max: 80 },
  email: { max: 120 },
  message: { max: 1000 },
} as const;

/** Optional leading "+", then 8–15 digits (E.164 length range). Applied AFTER normalizePhone(). */
export const PHONE_PATTERN = /^\+?\d{8,15}$/;

// ───────────────────────── building blocks ─────────────────────────

/** Error resolver for base types: undefined → required, wrong type → invalid_value. */
function requiredOrInvalid(issue: { input?: unknown }): ValidationErrorCode {
  return issue.input === undefined ? "required" : "invalid_value";
}

/**
 * Required text. `multiline` keeps newlines (messages); otherwise the value is
 * forced onto one line. zod 4 runs every check on the piped string, so an
 * empty value yields both "required" and "too_short" — the first wins in
 * `issuesToFieldErrors`, which is why min(1, "required") comes first.
 */
function textField(min: number, max: number, options: { multiline?: boolean } = {}) {
  const clean = options.multiline ? sanitizeText : sanitizeLine;
  return z
    .string({ error: requiredOrInvalid })
    .transform((value) => clean(value))
    .pipe(z.string().min(1, "required").min(min, "too_short").max(max, "too_long"));
}

/** Optional multi-line text; empty becomes `null`. */
function optionalTextField(max: number) {
  return z
    .string({ error: () => "invalid_value" })
    .transform((value) => sanitizeText(value))
    .pipe(z.string().max(max, "too_long"))
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));
}

function emailField(max: number) {
  return z
    .string({ error: requiredOrInvalid })
    .transform((value) => sanitizeLine(value))
    .pipe(z.string().min(1, "required").max(max, "too_long").pipe(z.email("invalid_email")));
}

const phoneField = z
  .string({ error: requiredOrInvalid })
  .transform((value) => normalizePhone(value))
  .pipe(z.string().min(1, "required").regex(PHONE_PATTERN, "invalid_phone"));

const pairIdField = z
  .string({ error: requiredOrInvalid })
  .pipe(z.enum(PAIR_IDS, { error: () => "invalid_pair" }));

/** Amount in the SENT currency. NaN/Infinity/≤ 0 → invalid_amount. Limits are checked per pair below. */
const amountField = z
  .number({
    error: (issue) =>
      issue.input === undefined
        ? "required"
        : typeof issue.input === "number"
          ? "invalid_amount"
          : "invalid_value",
  })
  .positive("invalid_amount");

/** Estimated receive in the RECEIVED currency; informational, optional, normalised to `number | null`. */
const estimatedReceiveField = z
  .number({ error: () => "invalid_value" })
  .nonnegative("invalid_value")
  .nullish()
  .transform((value) => value ?? null);

/** Consent checkbox: must be literally `true`. Input type stays `boolean` so forms can pass their state. */
const consentField = z
  .boolean({ error: (issue) => (issue.input === undefined ? "consent_required" : "invalid_value") })
  .pipe(z.literal(true, "consent_required"));

/** Anti-spam meta fields sent by the forms. The route inspects them before validation. */
const metaFields = {
  /** Honeypot — must stay empty. */
  hp: z.string({ error: () => "invalid_value" }).max(0, "invalid_value").optional().default(""),
  /** Form render timestamp (ms). */
  ts: z.number({ error: () => "invalid_value" }).optional(),
};

// ───────────────────────── schemas ─────────────────────────

export const contactSchema = z.object({
  name: textField(CONTACT_LIMITS.name.min, CONTACT_LIMITS.name.max),
  email: emailField(CONTACT_LIMITS.email.max),
  whatsapp: phoneField,
  subject: textField(CONTACT_LIMITS.subject.min, CONTACT_LIMITS.subject.max),
  message: textField(CONTACT_LIMITS.message.min, CONTACT_LIMITS.message.max, { multiline: true }),
  ...metaFields,
});

/**
 * Amount limits depend on the pair's SENT currency (AMOUNT_LIMITS). Shared by
 * the schema refinement and by `validateExchangeRequest`, which re-runs it
 * because zod skips object-level refinements when any field already failed —
 * and the user should see every error in one round trip.
 */
export function getAmountLimitError(
  pairId: PairId,
  amount: number,
): Extract<ValidationErrorCode, "amount_too_small" | "amount_too_large"> | null {
  const pair = getPairById(pairId);
  if (!pair || !Number.isFinite(amount)) return null;
  const limits = AMOUNT_LIMITS[pair.from];
  if (amount < limits.min) return "amount_too_small";
  if (amount > limits.max) return "amount_too_large";
  return null;
}

const exchangeRequestBaseSchema = z.object({
  fullName: textField(EXCHANGE_REQUEST_LIMITS.fullName.min, EXCHANGE_REQUEST_LIMITS.fullName.max),
  whatsapp: phoneField,
  email: emailField(EXCHANGE_REQUEST_LIMITS.email.max),
  pairId: pairIdField,
  amount: amountField,
  estimatedReceive: estimatedReceiveField,
  message: optionalTextField(EXCHANGE_REQUEST_LIMITS.message.max),
  consent: consentField,
  ...metaFields,
});

export const exchangeRequestSchema = exchangeRequestBaseSchema.superRefine((data, ctx) => {
  const code = getAmountLimitError(data.pairId, data.amount);
  if (code) ctx.addIssue({ code: "custom", path: ["amount"], message: code });
});

// ───────────────────────── types ─────────────────────────

/** What the form submits (strings as typed, amount already parsed to a number). */
export type ContactInput = z.input<typeof contactSchema>;
/** What comes out: sanitised and normalised. */
export type ContactData = z.output<typeof contactSchema>;
export type ExchangeRequestInput = z.input<typeof exchangeRequestSchema>;
export type ExchangeRequestData = z.output<typeof exchangeRequestSchema>;

// ───────────────────────── helpers ─────────────────────────

interface IssueLike {
  path: ReadonlyArray<PropertyKey>;
  message: string;
}

/**
 * Collapse zod issues to the FIRST code per top-level field. Messages that are
 * not one of our codes (zod defaults, which can only appear for unforeseen
 * shapes) degrade to "invalid_value" rather than leaking English text.
 */
export function issuesToFieldErrors<T>(issues: ReadonlyArray<IssueLike>): FieldErrors<T> {
  const errors: Record<string, ValidationErrorCode> = {};
  for (const issue of issues) {
    const head = issue.path[0];
    const key = typeof head === "string" || typeof head === "number" ? String(head) : "_form";
    if (errors[key]) continue;
    errors[key] = isValidationErrorCode(issue.message) ? issue.message : "invalid_value";
  }
  return errors as FieldErrors<T>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateContact(input: unknown): ValidationResult<ContactInput, ContactData> {
  const result = contactSchema.safeParse(input);
  if (result.success) return { success: true, data: result.data };
  return { success: false, errors: issuesToFieldErrors<ContactInput>(result.error.issues) };
}

export function validateExchangeRequest(
  input: unknown,
): ValidationResult<ExchangeRequestInput, ExchangeRequestData> {
  const result = exchangeRequestSchema.safeParse(input);
  if (result.success) return { success: true, data: result.data };
  const errors = issuesToFieldErrors<ExchangeRequestInput>(result.error.issues);
  // The object-level refinement did not run if another field failed; check the
  // amount limits independently so the user gets the complete picture at once.
  if (!errors.amount && !errors.pairId && isRecord(input)) {
    const pair = exchangeRequestBaseSchema.shape.pairId.safeParse(input.pairId);
    const amount = exchangeRequestBaseSchema.shape.amount.safeParse(input.amount);
    if (pair.success && amount.success) {
      const code = getAmountLimitError(pair.data, amount.data);
      if (code) errors.amount = code;
    }
  }
  return { success: false, errors };
}
