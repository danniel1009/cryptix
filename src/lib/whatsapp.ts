import { getPairById, pairLabel, type PairId } from "@/config/exchange";
import { siteConfig } from "@/config/site";
import { dictionaries, interpolate } from "@/lib/i18n/dictionaries";
import { formatAmount } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/types";

/**
 * The single WhatsApp utility: URL building + localized pre-filled messages.
 *
 * The number comes from `siteConfig.whatsappNumber` (NEXT_PUBLIC_WHATSAPP_NUMBER,
 * digits only). Nothing is hardcoded: when it is empty the site degrades to
 * the contact form (`buildWhatsAppUrl()` returns "#contact"). Templates come
 * from `t.whatsapp` so both languages stay in the dictionaries.
 *
 * Message layout produced by `buildExchangeInquiryMessage`:
 *
 *   <greeting>
 *
 *   <pairLabel>: USDT → BTC
 *   <amountLabel>: 1,000 USDT
 *   <estimateLabel>: 0.009 BTC          (omitted when no estimate is known)
 *   <referenceLabel>: CX-XXXXXX         (omitted when there is no reference)
 *
 *   <closing>
 */

export const WHATSAPP_BASE_URL = "https://wa.me/";
/** Where WhatsApp CTAs point when no number is configured. */
export const WHATSAPP_FALLBACK_HREF = "#contact";

export interface ExchangeInquiryMessageOptions {
  locale: Locale;
  pairId: PairId;
  /** Amount in the SENT currency, unformatted. */
  amount: number;
  /** Estimated amount in the RECEIVED currency, unformatted. Omitted from the message when null/undefined. */
  estimatedReceive?: number | null;
  /** Request reference (e.g. "CX-7KQ2MZ") after a successful submission. */
  reference?: string | null;
}

export function isWhatsAppConfigured(): boolean {
  return siteConfig.whatsappNumber.length > 0;
}

/**
 * `https://wa.me/<digits>?text=<encoded message>`; without a message just the
 * chat link; "#contact" when WhatsApp is not configured so anchors still work.
 */
export function buildWhatsAppUrl(message?: string): string {
  if (!isWhatsAppConfigured()) return WHATSAPP_FALLBACK_HREF;
  const base = `${WHATSAPP_BASE_URL}${siteConfig.whatsappNumber}`;
  return message && message.length > 0 ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function buildExchangeInquiryMessage(options: ExchangeInquiryMessageOptions): string {
  const { locale, pairId, amount, estimatedReceive, reference } = options;
  const t = dictionaries[locale].whatsapp.exchangeInquiry;
  const pair = getPairById(pairId);
  // `compact` drops trailing zero decimals: 1,000 USDT (not 1,000.00), 0.009 BTC.
  const amountText = pair ? formatAmount(locale, amount, pair.from, { compact: true }) : String(amount);

  const lines: string[] = [
    `${t.pairLabel}: ${pair ? pairLabel(pair) : pairId}`,
    `${t.amountLabel}: ${amountText}`,
  ];
  if (pair && typeof estimatedReceive === "number" && Number.isFinite(estimatedReceive)) {
    lines.push(`${t.estimateLabel}: ${formatAmount(locale, estimatedReceive, pair.to, { compact: true })}`);
  }
  if (reference) lines.push(`${t.referenceLabel}: ${reference}`);

  return `${t.greeting}\n\n${lines.join("\n")}\n\n${t.closing}`;
}

export function buildGeneralInquiryMessage(locale: Locale): string {
  return interpolate(dictionaries[locale].whatsapp.generalInquiry, { brand: siteConfig.name });
}
