import { serverConfig } from "@/config/server";
import { getPairById } from "@/config/exchange";
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
import type { ExchangeRequestLead } from "@/lib/leads/types";
import { getClientIp, hashClientIp } from "@/lib/security/client-ip";
import { createRateLimiter, type RateLimiter } from "@/lib/security/rate-limit";
import { escapeForLog } from "@/lib/security/sanitize";
import { collectTextFields, isLikelySpam } from "@/lib/security/spam";
import { validateExchangeRequest } from "@/lib/validation/schemas";

/**
 * POST /api/exchange-request — exchange request (a lead, NOT an order).
 *
 * Same pipeline as /api/contact: parse JSON (≤ 32 KB) → rate-limit by IP →
 * spam heuristics (silently accepted, never delivered) → validate + sanitise
 * (zod transforms; amount limits per the pair's sent currency) → build lead
 * → deliver → 200 { ok, reference }. Nothing is executed automatically: the
 * team confirms the final rate over WhatsApp / e-mail.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LOG_PREFIX = "[api/exchange-request]";
const TEXT_FIELDS = ["fullName", "email", "message"] as const;

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
  if (spam.spam) {
    console.warn(`${LOG_PREFIX} spam_detected reason=${spam.reason} ref=${reference} ip=${ipHash}`);
    return ok({ reference });
  }

  const validation = validateExchangeRequest(body);
  if (!validation.success) return validationError(validation.errors);
  const data = validation.data;

  // pairId is a validated PairId, so the pair always exists; the guard keeps TS honest.
  const pair = getPairById(data.pairId);
  if (!pair) return validationError({ pairId: "invalid_pair" });

  const lead: ExchangeRequestLead = {
    type: "exchange_request",
    reference,
    receivedAt: new Date().toISOString(),
    locale: resolveRequestLocale(body, request),
    ipHash,
    userAgent: readUserAgent(request),
    fullName: data.fullName,
    whatsapp: data.whatsapp,
    email: data.email,
    pairId: pair.id,
    from: pair.from,
    to: pair.to,
    amount: data.amount,
    estimatedReceive: data.estimatedReceive,
    message: data.message,
    consent: data.consent,
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
