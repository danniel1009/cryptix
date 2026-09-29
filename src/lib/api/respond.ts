import { siteConfig } from "@/config/site";
import { isLocale, type Locale } from "@/lib/i18n/types";
import { sanitizeLine } from "@/lib/security/sanitize";
import type { ValidationErrorCode } from "@/lib/validation/schemas";

/**
 * Typed JSON helpers for the API routes. Every response is `Cache-Control:
 * no-store` (form endpoints must never be cached) and uses the wire shapes
 * documented in docs/ARCHITECTURE.md → "Forms API contract".
 *
 * Uses the standard `Response` (not `NextResponse`) so the routes can be
 * unit-tested by calling `POST(new Request(...))` with no framework.
 */

export type ApiErrorCode =
  | "validation_error"
  | "rate_limited"
  | "delivery_failed"
  | "spam_detected"
  | "bad_request"
  | "payload_too_large"
  | "method_not_allowed";

export type BadRequestReason = "invalid_json" | "invalid_body" | "unsupported_media_type" | "cross_site";

export type ApiSuccessBody<T extends object = { reference: string }> = { ok: true } & T;

export type ApiErrorBody =
  | { ok: false; code: "validation_error"; errors: Partial<Record<string, ValidationErrorCode>> }
  | { ok: false; code: "rate_limited"; retryAfterSeconds: number }
  | { ok: false; code: "bad_request"; reason?: BadRequestReason }
  | { ok: false; code: "delivery_failed" | "spam_detected" | "payload_too_large" | "method_not_allowed" };

export type ApiBody = ApiSuccessBody | ApiErrorBody;

/** Hard cap on request bodies for the form endpoints (defence against oversized payloads). */
export const MAX_BODY_BYTES = 32 * 1024;

const BASE_HEADERS: Record<string, string> = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...BASE_HEADERS, ...headers } });
}

export function ok<T extends object>(data: T): Response {
  return json({ ok: true, ...data }, 200);
}

export function validationError(errors: Partial<Record<string, ValidationErrorCode>>): Response {
  return json({ ok: false, code: "validation_error", errors }, 400);
}

export function rateLimited(retryAfterSeconds: number): Response {
  const seconds = Math.max(1, Math.ceil(retryAfterSeconds));
  return json({ ok: false, code: "rate_limited", retryAfterSeconds: seconds }, 429, {
    "Retry-After": String(seconds),
  });
}

export function deliveryFailed(): Response {
  return json({ ok: false, code: "delivery_failed" }, 500);
}

export function badRequest(reason?: BadRequestReason): Response {
  return json(reason ? { ok: false, code: "bad_request", reason } : { ok: false, code: "bad_request" }, 400);
}

export function payloadTooLarge(): Response {
  return json({ ok: false, code: "payload_too_large" }, 413);
}

export function methodNotAllowed(allow: readonly string[] = ["POST"]): Response {
  return json({ ok: false, code: "method_not_allowed" }, 405, { Allow: allow.join(", ") });
}

// ───────────────────────── request helpers ─────────────────────────

export type JsonBodyResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; response: Response };

/**
 * Read and parse a JSON object body defensively:
 *  - 413 when `Content-Length` or the actual UTF-8 length exceeds `maxBytes`
 *  - 400 `invalid_json` when the text is not JSON
 *  - 400 `invalid_body` when the JSON is not a plain object
 */
class BodyTooLargeError extends Error {}

/** Read the body as text, aborting as soon as more than `maxBytes` have arrived. */
async function readTextCapped(request: Request, maxBytes: number): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

export async function readJsonBody(request: Request, maxBytes = MAX_BODY_BYTES): Promise<JsonBodyResult> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, response: payloadTooLarge() };
  }
  // Only JSON bodies are accepted: this also forces a CORS preflight for any
  // cross-site caller, which fails because no CORS headers are ever sent.
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(contentType.trim())) {
    return { ok: false, response: badRequest("unsupported_media_type") };
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    return { ok: false, response: badRequest("cross_site") };
  }
  let text: string;
  try {
    text = await readTextCapped(request, maxBytes);
  } catch (error) {
    if (error instanceof BodyTooLargeError) return { ok: false, response: payloadTooLarge() };
    return { ok: false, response: badRequest("invalid_body") };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, response: badRequest("invalid_json") };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, response: badRequest("invalid_body") };
  }
  return { ok: true, body: parsed as Record<string, unknown> };
}

/**
 * Locale the customer was using: explicit `locale` in the body (sent by the
 * API client) → primary subtag of `Accept-Language` → site default.
 */
export function resolveRequestLocale(body: Record<string, unknown>, request: Request): Locale {
  if (isLocale(body.locale)) return body.locale;
  const header = request.headers.get("accept-language");
  if (header) {
    for (const part of header.split(",")) {
      const tag = part.split(";")[0].trim().toLowerCase();
      const primary = tag.split("-")[0];
      if (isLocale(primary)) return primary;
    }
  }
  return siteConfig.defaultLocale;
}

/** User agent, single line, control characters stripped, capped at 256 characters. */
export function readUserAgent(request: Request): string {
  return sanitizeLine(request.headers.get("user-agent") ?? "", 256);
}
