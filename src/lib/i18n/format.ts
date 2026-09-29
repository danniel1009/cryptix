import { CURRENCIES, type CurrencyCode } from "@/config/exchange";
import { INTL_LOCALES, type Locale } from "@/lib/i18n/types";

/**
 * Locale-aware number formatting. Pure functions: safe on server and client.
 * en → 1,000.00   id → 1.000,00
 */

export function formatNumber(
  locale: Locale,
  value: number,
  options: Intl.NumberFormatOptions = {},
): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(INTL_LOCALES[locale], options).format(value);
}

/**
 * Choose sensible decimals for a PRICE (a rate), independent of currency
 * amount conventions: 109,420.20 / 16,485 / 0.02984 / 0.00172 / 0.00001234.
 */
export function priceDecimals(value: number, currency?: CurrencyCode): number {
  const abs = Math.abs(value);
  if (currency === "IDR") return abs >= 100 ? 0 : 2;
  if (abs === 0) return 2;
  if (abs >= 1000) return 2;
  if (abs >= 1) return 4;
  // < 1: keep 4 significant digits, cap at 10 decimals
  const magnitude = Math.floor(Math.log10(abs)); // negative
  return Math.min(10, Math.max(4, -magnitude + 3));
}

/** Format a market/our PRICE expressed in `currency` (e.g. "109,420.20", "Rp16,485", "0.02984"). */
export function formatPrice(locale: Locale, value: number, currency: CurrencyCode): string {
  if (!Number.isFinite(value)) return "—";
  const decimals = priceDecimals(value, currency);
  const num = formatNumber(locale, value, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return withCurrency(num, currency);
}

/** Format an AMOUNT of `currency` using its configured decimals (e.g. "1,000.00 USDT", "0.00952381 BTC", "Rp15,700"). */
export function formatAmount(
  locale: Locale,
  value: number,
  currency: CurrencyCode,
  options: { compact?: boolean; withSymbol?: boolean } = {},
): string {
  if (!Number.isFinite(value)) return "—";
  const meta = CURRENCIES[currency];
  let decimals = meta.amountDecimals;
  // Small crypto amounts: keep enough significant digits to be meaningful.
  if (meta.kind === "crypto" && value !== 0 && Math.abs(value) < 1) {
    decimals = Math.max(decimals, priceDecimals(value));
  }
  const num = formatNumber(locale, value, {
    minimumFractionDigits: options.compact ? 0 : Math.min(decimals, meta.amountDecimals),
    maximumFractionDigits: decimals,
  });
  return options.withSymbol === false ? num : withCurrency(num, currency);
}

export function withCurrency(formatted: string, currency: CurrencyCode): string {
  const meta = CURRENCIES[currency];
  return meta.symbol ? `${meta.symbol}${formatted}` : `${formatted} ${currency}`;
}

/** "+2.41%" / "-0.42%" / "0.00%" */
export function formatPercent(locale: Locale, value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return (
    sign +
    formatNumber(locale, value, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) +
    "%"
  );
}

/** "5%" for 0.05 */
export function formatSpread(locale: Locale, spread: number): string {
  const pct = spread * 100;
  return (
    formatNumber(locale, pct, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }) + "%"
  );
}

export function formatTime(locale: Locale, date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

export function formatDateTime(locale: Locale, date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

/** "just now" / "2 minutes ago" via Intl.RelativeTimeFormat. */
export function formatRelativeTime(locale: Locale, date: Date | string | number, now = Date.now()): string {
  const d = date instanceof Date ? date : new Date(date);
  const diffSec = Math.round((d.getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(INTL_LOCALES[locale], { numeric: "auto" });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(Math.round(diffSec / 10) * 10 || 0, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86400), "day");
}

/**
 * Parse a user-typed amount in either locale convention.
 * Accepts "1,000.50", "1.000,50", "1000.5", "1000,5". Returns NaN when invalid.
 */
export function parseAmountInput(raw: string): number {
  const s = raw.trim().replace(/\s+/g, "");
  if (!s) return NaN;
  if (!/^[\d.,]+$/.test(s)) return NaN;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let normalized: string;
  if (lastComma === -1 && lastDot === -1) normalized = s;
  else if (lastComma > lastDot) {
    // comma is the decimal separator
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = s.replace(/,/g, "");
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}
