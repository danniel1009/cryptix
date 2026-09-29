import { siteConfig } from "@/config/site";
import type { Locale } from "@/lib/i18n/types";
import {
  isValidationErrorCode,
  type ContactInput,
  type ExchangeRequestInput,
  type ValidationErrorCode,
} from "@/lib/validation/schemas";

/**
 * Client-safe wrappers around the form endpoints. No server imports.
 *
 * Every outcome is a value, never an exception: network failures, timeouts
 * and unparseable responses all become `{ ok: false, code: "network_error" }`
 * / `"unknown"`, so a form only has to switch on `result.code` and map it via
 * `t.form.errors[code]` (field errors via `t.validation[code]`).
 */

export const CONTACT_ENDPOINT = "/api/contact";
export const EXCHANGE_REQUEST_ENDPOINT = "/api/exchange-request";
export const SUBMIT_TIMEOUT_MS = 15_000;

export type SubmitErrorCode =
  | "validation_error"
  | "rate_limited"
  | "delivery_failed"
  | "network_error"
  | "spam_detected"
  | "unknown";

export type SubmitResult =
  | { ok: true; reference: string }
  | { ok: false; code: "validation_error"; errors: Partial<Record<string, ValidationErrorCode>> }
  | { ok: false; code: "rate_limited"; retryAfterSeconds: number }
  | { ok: false; code: "delivery_failed" | "network_error" | "spam_detected" | "unknown" };

export interface SubmitOptions {
  /** Language of the visitor; sent as `Accept-Language` and as `locale` in the body. */
  locale?: Locale;
  /** Caller-owned abort signal (e.g. component unmount). Aborting yields `network_error`. */
  signal?: AbortSignal;
  /** Overall timeout; defaults to 15 s. */
  timeoutMs?: number;
  /** Injected for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

const DEFAULT_RETRY_AFTER_SECONDS = 60;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Keep only entries whose value is one of our codes (never trust the wire blindly). */
function pickFieldErrors(value: unknown): Partial<Record<string, ValidationErrorCode>> {
  const errors: Partial<Record<string, ValidationErrorCode>> = {};
  if (!isRecord(value)) return errors;
  for (const [field, code] of Object.entries(value)) {
    if (isValidationErrorCode(code)) errors[field] = code;
  }
  return errors;
}

function readRetryAfter(body: Record<string, unknown> | null, response: Response): number {
  const fromBody = body?.retryAfterSeconds;
  if (typeof fromBody === "number" && Number.isFinite(fromBody) && fromBody > 0) return Math.ceil(fromBody);
  const header = Number(response.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return Math.ceil(header);
  return DEFAULT_RETRY_AFTER_SECONDS;
}

/** Map an HTTP response + parsed body (or null) to the discriminated union. Exported for tests. */
export function mapSubmitResponse(response: Response, body: unknown): SubmitResult {
  const record = isRecord(body) ? body : null;
  if (record?.ok === true && typeof record.reference === "string") {
    return { ok: true, reference: record.reference };
  }
  const code = typeof record?.code === "string" ? record.code : null;
  switch (code) {
    case "validation_error":
      return { ok: false, code, errors: pickFieldErrors(record?.errors) };
    case "rate_limited":
      return { ok: false, code, retryAfterSeconds: readRetryAfter(record, response) };
    case "delivery_failed":
    case "spam_detected":
      return { ok: false, code };
    default:
      break;
  }
  // No usable body: fall back to the status code.
  if (response.status === 429) {
    return { ok: false, code: "rate_limited", retryAfterSeconds: readRetryAfter(record, response) };
  }
  return { ok: false, code: "unknown" };
}

async function postJson(endpoint: string, payload: Record<string, unknown>, options: SubmitOptions): Promise<SubmitResult> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const locale = options.locale ?? siteConfig.defaultLocale;
  const timeoutMs = options.timeoutMs ?? SUBMIT_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener("abort", onExternalAbort, { once: true });
  }

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
        "Accept-Language": locale,
      },
      body: JSON.stringify({ ...payload, locale }),
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    });
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return mapSubmitResponse(response, body);
  } catch {
    // fetch rejects on DNS/TLS/connection failures, aborts and timeouts.
    return { ok: false, code: "network_error" };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onExternalAbort);
  }
}

export function submitContact(input: ContactInput, options: SubmitOptions = {}): Promise<SubmitResult> {
  return postJson(CONTACT_ENDPOINT, { ...input }, options);
}

export function submitExchangeRequest(
  input: ExchangeRequestInput,
  options: SubmitOptions = {},
): Promise<SubmitResult> {
  return postJson(EXCHANGE_REQUEST_ENDPOINT, { ...input }, options);
}
