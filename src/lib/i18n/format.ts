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
  // Sign from the ROUNDED value so a change that rounds to zero is "0.00%", never "-0.00%".
  const shown = Number(value.toFixed(decimals));
  const rounded = Object.is(shown, -0) || shown === 0 ? 0 : shown;
  const sign = rounded > 0 ? "+" : "";
  return (
    sign +
    formatNumber(locale, rounded, {
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
 * Parse a user-typed amount. Accepts "1,000.50", "1.000,50", "1000.5",
 * "1000,5", "15,700,000", "15.700.000". Returns NaN when invalid.
 *
 * Rules (in order):
 *  - both separators present → the LAST one is the decimal separator;
 *  - one kind of separator, repeated → grouping ("100,000,000");
 *  - one separator, once: with a locale, its DECIMAL separator wins ("1.5" en,
 *    "1,5" id); the locale's GROUP separator counts as grouping only when
 *    exactly three digits follow ("100,000" en → 100000; "1,5" en → 1.5);
 *    without a locale the old heuristic applies (the separator is decimal,
 *    unless exactly three digits follow and the integer part is non-empty).
 */
export function parseAmountInput(raw: string, locale?: Locale): number {
  const s = raw.trim().replace(/\s+/g, "");
  if (!s) return NaN;
  if (!/^[\d.,]+$/.test(s)) return NaN;
  const commas = (s.match(/,/g) ?? []).length;
  const dots = (s.match(/\./g) ?? []).length;
  let decimalSep: "," | "." | null = null;
  if (commas > 0 && dots > 0) {
    decimalSep = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
  } else if (commas + dots === 1) {
    const sep: "," | "." = commas === 1 ? "," : ".";
    const idx = s.indexOf(sep);
    // Grouping only when the integer part is 1–3 digits and not "0" ("100,000" yes; "0.001" no).
    const groupLike = s.length - idx - 1 === 3 && /^[1-9]\d{0,2}$/.test(s.slice(0, idx));
    const localeDecimal: "," | "." | null = locale ? (locale === "id" ? "," : ".") : null;
    if (localeDecimal) decimalSep = sep === localeDecimal ? sep : groupLike ? null : sep;
    else decimalSep = groupLike ? null : sep;
  } // else: one kind of separator repeated → grouping only
  const groupSep = decimalSep === "," ? "." : decimalSep === "." ? "," : null;
  let normalized = s;
  if (decimalSep === null) normalized = s.replace(/[.,]/g, "");
  else {
    if (groupSep) normalized = normalized.split(groupSep).join("");
    normalized = normalized.replace(decimalSep, ".");
  }
  if (!/^\d+(\.\d+)?$/.test(normalized) && !/^\d+\.$/.test(normalized) && !/^\.\d+$/.test(normalized)) return NaN;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}
