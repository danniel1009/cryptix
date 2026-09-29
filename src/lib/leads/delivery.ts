import "server-only";
import { createHmac } from "node:crypto";
import { serverConfig } from "@/config/server";
import { siteConfig } from "@/config/site";
import { escapeForLog } from "@/lib/security/sanitize";
import { formatLeadHtml, formatLeadSubject, formatLeadSummary, formatLeadText } from "./format";
import type { Lead, LeadChannel, LeadDeliveryResult } from "./types";

/**
 * Lead delivery. Three channels, all optional and independent:
 *
 *  1. Webhook  — LEAD_WEBHOOK_URL: POST JSON. When LEAD_WEBHOOK_SECRET is set
 *                the header `X-Lead-Signature` carries hex HMAC-SHA256 of the
 *                exact request body so the receiver can verify authenticity.
 *  2. E-mail   — RESEND_API_KEY + RESEND_FROM_EMAIL → serverConfig.leads.contactEmail
 *                via the Resend HTTP API (plain text + simple HTML).
 *  3. Console  — always: one redacted line. In development, when nothing else
 *                is configured, the full text is printed too so the site works
 *                out of the box.
 *
 * `delivered` is true when at least one external channel succeeded, or when
 * NO external channel is configured (console counts). Each external call has
 * its own timeout; failures never throw — they are reported in `errors`.
 */

export const LEAD_DELIVERY_TIMEOUT_MS = 6_000;
export const RESEND_API_URL = "https://api.resend.com/emails";
export const LEAD_SIGNATURE_HEADER = "X-Lead-Signature";

export interface DeliverLeadOptions {
  /** Injected for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Per-channel timeout in ms. */
  timeoutMs?: number;
  /** Injected for tests; defaults to `console`. */
  logger?: Pick<Console, "info" | "warn" | "error">;
}

interface ChannelOutcome {
  channel: LeadChannel;
  ok: boolean;
  /** Safe, short reason (no secrets, no user input). */
  error?: string;
}

/** Shape of the webhook body. Receivers can rely on `event` + `type` for routing. */
export interface LeadWebhookPayload {
  event: "lead.received";
  type: Lead["type"];
  reference: string;
  receivedAt: string;
  locale: Lead["locale"];
  site: string;
  lead: Lead;
  /** The same plain-text rendering used for e-mail, handy for Slack/Telegram bridges. */
  text: string;
}

export function signWebhookBody(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function describeError(error: unknown, timeoutMs: number): string {
  if (error instanceof Error) {
    if (error.name === "AbortError" || error.name === "TimeoutError") return `timeout after ${timeoutMs}ms`;
    return escapeForLog(error.message, 120) || error.name;
  }
  return "unknown error";
}

async function sendWebhook(
  lead: Lead,
  text: string,
  options: Required<Pick<DeliverLeadOptions, "fetchImpl" | "timeoutMs">>,
): Promise<ChannelOutcome> {
  const { webhookUrl, webhookSecret } = serverConfig.leads;
  if (!webhookUrl) return { channel: "webhook", ok: false, error: "not configured" };
  const payload: LeadWebhookPayload = {
    event: "lead.received",
    type: lead.type,
    reference: lead.reference,
    receivedAt: lead.receivedAt,
    locale: lead.locale,
    site: siteConfig.name,
    lead,
    text,
  };
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    Accept: "application/json",
    "User-Agent": `${siteConfig.name} lead-delivery`,
    "X-Lead-Event": payload.event,
    "X-Lead-Reference": lead.reference,
  };
  if (webhookSecret) headers[LEAD_SIGNATURE_HEADER] = signWebhookBody(body, webhookSecret);
  try {
    const response = await fetchWithTimeout(
      options.fetchImpl,
      webhookUrl,
      { method: "POST", headers, body },
      options.timeoutMs,
    );
    if (!response.ok) return { channel: "webhook", ok: false, error: `HTTP ${response.status}` };
    return { channel: "webhook", ok: true };
  } catch (error) {
    return { channel: "webhook", ok: false, error: describeError(error, options.timeoutMs) };
  }
}

async function sendEmail(
  lead: Lead,
  rendered: { subject: string; text: string; html: string },
  options: Required<Pick<DeliverLeadOptions, "fetchImpl" | "timeoutMs">>,
): Promise<ChannelOutcome> {
  const { resendApiKey, resendFrom, contactEmail } = serverConfig.leads;
  if (!resendApiKey) return { channel: "email", ok: false, error: "not configured" };
  if (!resendFrom || !contactEmail) {
    return { channel: "email", ok: false, error: "RESEND_FROM_EMAIL or CONTACT_EMAIL missing" };
  }
  const body = JSON.stringify({
    from: resendFrom,
    to: [contactEmail],
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    reply_to: lead.email,
    headers: { "X-Lead-Reference": lead.reference },
  });
  try {
    const response = await fetchWithTimeout(
      options.fetchImpl,
      RESEND_API_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json; charset=utf-8",
          Accept: "application/json",
        },
        body,
      },
      options.timeoutMs,
    );
    if (!response.ok) return { channel: "email", ok: false, error: `HTTP ${response.status}` };
    return { channel: "email", ok: true };
  } catch (error) {
    return { channel: "email", ok: false, error: describeError(error, options.timeoutMs) };
  }
}

export async function deliverLead(lead: Lead, options: DeliverLeadOptions = {}): Promise<LeadDeliveryResult> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? LEAD_DELIVERY_TIMEOUT_MS;
  const logger = options.logger ?? console;
  const { webhookUrl, resendApiKey } = serverConfig.leads;
  const webhookConfigured = Boolean(webhookUrl);
  const emailConfigured = Boolean(resendApiKey);
  const externalConfigured = webhookConfigured || emailConfigured;

  const text = formatLeadText(lead);
  const rendered = { subject: formatLeadSubject(lead), text, html: formatLeadHtml(lead) };

  const attempts: Promise<ChannelOutcome>[] = [];
  if (webhookConfigured) attempts.push(sendWebhook(lead, text, { fetchImpl, timeoutMs }));
  if (emailConfigured) attempts.push(sendEmail(lead, rendered, { fetchImpl, timeoutMs }));
  const outcomes = await Promise.all(attempts);

  const channels: LeadChannel[] = outcomes.filter((o) => o.ok).map((o) => o.channel);
  const errors = outcomes.filter((o) => !o.ok).map((o) => `${o.channel}: ${o.error ?? "failed"}`);
  // Console-only "delivery" is acceptable in development, never in production:
  // the visitor would get a reference for a lead nobody receives.
  const delivered = channels.length > 0 || (!externalConfigured && !serverConfig.isProduction);

  // Console channel — always, always redacted.
  channels.push("console");
  if (!externalConfigured && serverConfig.isProduction) {
    logger.error(
      "[lead] NO DELIVERY CHANNEL CONFIGURED IN PRODUCTION — set LEAD_WEBHOOK_URL and/or RESEND_API_KEY + RESEND_FROM_EMAIL + CONTACT_EMAIL. The request is rejected so the visitor is not told it was received.",
    );
  } else if (!externalConfigured) {
    logger.warn(
      "[lead] No delivery channel configured (set LEAD_WEBHOOK_URL and/or RESEND_API_KEY + RESEND_FROM_EMAIL + CONTACT_EMAIL). The lead is logged to the console only.",
    );
  }
  const summary = `${formatLeadSummary(lead)} channels=${channels.join(",")}${errors.length ? ` errors="${errors.join("; ")}"` : ""}`;
  if (delivered) logger.info(`[lead] delivered ${summary}`);
  else logger.error(`[lead] delivery_failed ${summary}`);
  // Development convenience: show the whole lead when nothing else receives it.
  if (!externalConfigured && !serverConfig.isProduction) {
    logger.info(`[lead] ${lead.reference} full text (development only):\n${text}`);
  }

  return { delivered, channels, errors };
}
