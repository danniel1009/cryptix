import type { CurrencyCode, PairId } from "@/config/exchange";
import type { Locale } from "@/lib/i18n/types";

/**
 * Lead records built by the API routes from VALIDATED + SANITISED input and
 * handed to `deliverLead()`. Everything in here is safe to persist, but the
 * contact fields are personal data: only ever log them through the masking
 * helpers (see `formatLeadSummary`).
 */

export type LeadType = "contact" | "exchange_request";

export interface LeadMeta {
  /** Customer-facing reference, e.g. "CX-7KQ2MZ". */
  reference: string;
  /** ISO-8601 timestamp of when the server accepted the request. */
  receivedAt: string;
  /** Language the customer was using; the team replies in it. */
  locale: Locale;
  /** Pseudonymous IP fingerprint (see `hashClientIp`). Never the raw address. */
  ipHash: string;
  /** User agent, control characters stripped, capped at 256 chars ("" when absent). */
  userAgent: string;
  /** Weak spam signal (e.g. submitted very quickly): delivered, but flagged for the team. */
  suspicious?: boolean;
}

export interface ContactLead extends LeadMeta {
  type: "contact";
  name: string;
  email: string;
  whatsapp: string;
  subject: string;
  message: string;
}

export interface ExchangeRequestLead extends LeadMeta {
  type: "exchange_request";
  fullName: string;
  whatsapp: string;
  email: string;
  pairId: PairId;
  /** Currency the customer sends (denormalised from the pair for readers of the webhook). */
  from: CurrencyCode;
  /** Currency the customer receives. */
  to: CurrencyCode;
  /** Amount in `from`. */
  amount: number;
  /** Indicative amount in `to` shown to the customer when they submitted, if any. */
  estimatedReceive: number | null;
  message: string | null;
  /** The customer accepted that the rate is indicative and the team confirms final terms. */
  consent: true;
}

export type Lead = ContactLead | ExchangeRequestLead;

export type LeadChannel = "webhook" | "email" | "console";

export interface LeadDeliveryResult {
  /**
   * True when at least one external channel (webhook / email) accepted the
   * lead, OR when no external channel is configured at all (console counts,
   * so the site works out of the box in development).
   */
  delivered: boolean;
  /** Channels that succeeded, in the order they were attempted. "console" is always last. */
  channels: LeadChannel[];
  /** One entry per failed channel: "<channel>: <safe reason>". Never contains secrets or user input. */
  errors: string[];
}
