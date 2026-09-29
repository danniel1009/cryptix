import { serverConfig } from "@/config/server";
import {
  deliveryFailed,
  methodNotAllowed,
  ok,
  rateLimited,
  readJsonBody,
  readUserAgent,
  resolveRequestLocale,
  validationError,
} from "@/lib/api/respond";
import { deliverLead } from "@/lib/leads/delivery";
import { generateReference } from "@/lib/leads/reference";
import type { ContactLead } from "@/lib/leads/types";
import { getClientIp, hashClientIp } from "@/lib/security/client-ip";
import { createRateLimiter, type RateLimiter } from "@/lib/security/rate-limit";
import { escapeForLog } from "@/lib/security/sanitize";
import { collectTextFields, isLikelySpam } from "@/lib/security/spam";
import { validateContact } from "@/lib/validation/schemas";

/**
 * POST /api/contact — contact message.
 *
 * Pipeline: parse JSON (≤ 32 KB) → rate-limit by IP → spam heuristics
 * (silently accepted, never delivered) → validate + sanitise (the zod
 * transforms trim, strip control characters, collapse whitespace and
 * normalise the phone) → build lead → deliver → 200 { ok, reference }.
 *
 * Only POST is served; every other method gets 405 with an Allow header.
 * Logs never contain raw user input (see escapeForLog / formatLeadSummary).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LOG_PREFIX = "[api/contact]";
/** Free-text fields inspected by the spam heuristics (raw body, before validation). */
const TEXT_FIELDS = ["name", "email", "subject", "message"] as const;

/** Per-instance limiter (see rate-limit.ts for the distributed-store note). */
const limiter: RateLimiter = createRateLimiter({
  max: serverConfig.security.formRateLimitMax,
  windowMs: serverConfig.security.formRateLimitWindowMs,
});

export async function POST(request: Request): Promise<Response> {
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const ip = getClientIp(request);
  const ipHash = hashClientIp(ip);

  const limit = await limiter.check(ip);
  if (!limit.allowed) {
    console.warn(`${LOG_PREFIX} rate_limited ip=${ipHash} retryAfter=${limit.retryAfterSeconds}s`);
    return rateLimited(limit.retryAfterSeconds);
  }

  const reference = generateReference();

  const spam = isLikelySpam({
    hp: body.hp,
    ts: body.ts,
    now: Date.now(),
    text: collectTextFields(body, TEXT_FIELDS),
    minFillTimeMs: serverConfig.security.formMinFillTimeMs,
  });
  // "too_fast" alone is a weak signal (browser autofill): deliver the lead but flag
  // it for the team. Every other signal is dropped silently.
  const suspicious = spam.spam && spam.reason === "too_fast";
  if (spam.spam && !suspicious) {
    // Respond exactly like a success so bots learn nothing; nothing is delivered.
    console.warn(`${LOG_PREFIX} spam_detected reason=${spam.reason} ref=${reference} ip=${ipHash}`);
    return ok({ reference });
  }

  const validation = validateContact(body);
  if (!validation.success) return validationError(validation.errors);
  const data = validation.data;

  const lead: ContactLead = {
    type: "contact",
    reference,
    receivedAt: new Date().toISOString(),
    locale: resolveRequestLocale(body, request),
    ipHash,
    userAgent: readUserAgent(request),
    name: data.name,
    email: data.email,
    whatsapp: data.whatsapp,
    subject: data.subject,
    message: data.message,
    suspicious: suspicious || undefined,
  };

  const delivery = await deliverLead(lead);
  if (!delivery.delivered) {
    console.error(
      `${LOG_PREFIX} delivery_failed ref=${reference} ip=${ipHash} errors="${escapeForLog(delivery.errors.join("; "), 300)}"`,
    );
    return deliveryFailed();
  }
  return ok({ reference });
}

export function GET(): Response {
  return methodNotAllowed(["POST"]);
}
export function PUT(): Response {
  return methodNotAllowed(["POST"]);
}
export function PATCH(): Response {
  return methodNotAllowed(["POST"]);
}
export function DELETE(): Response {
  return methodNotAllowed(["POST"]);
}
