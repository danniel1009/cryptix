import { describe, expect, it } from "vitest";
import {
  formatAmount,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatPrice,
  formatRelativeTime,
  formatSpread,
  formatTime,
  parseAmountInput,
  priceDecimals,
  withCurrency,
} from "@/lib/i18n/format";

/**
 * Locale conventions under test:
 *   en → 1,000.00 (comma thousands, dot decimal)
 *   id → 1.000,00 (dot thousands, comma decimal)
 */

describe("formatNumber", () => {
  it("uses the locale's grouping and decimal separators", () => {
    expect(formatNumber("en", 1234567.891, { maximumFractionDigits: 2 })).toBe("1,234,567.89");
    expect(formatNumber("id", 1234567.891, { maximumFractionDigits: 2 })).toBe("1.234.567,89");
  });

  it("returns an em dash for non-finite input", () => {
    expect(formatNumber("en", Number.NaN)).toBe("—");
    expect(formatNumber("id", Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("formatAmount", () => {
  it("formats a USDT amount with 2 decimals in both locales", () => {
    expect(formatAmount("en", 1000, "USDT")).toBe("1,000.00 USDT");
    expect(formatAmount("id", 1000, "USDT")).toBe("1.000,00 USDT");
  });

  it("formats IDR as a prefixed symbol with no decimals", () => {
    expect(formatAmount("en", 15700, "IDR")).toBe("Rp15,700");
    expect(formatAmount("id", 15700, "IDR")).toBe("Rp15.700");
  });

  it("keeps enough significant digits for small crypto amounts", () => {
    expect(formatAmount("en", 0.00952381, "BTC")).toBe("0.00952381 BTC");
    expect(formatAmount("id", 0.00952381, "BTC")).toBe("0,00952381 BTC");
  });

  it("supports compact (no forced decimals) and symbol-less output", () => {
    expect(formatAmount("en", 1000, "USDT", { compact: true })).toBe("1,000 USDT");
    expect(formatAmount("id", 1000, "USDT", { compact: true })).toBe("1.000 USDT");
    expect(formatAmount("en", 1000, "USDT", { withSymbol: false })).toBe("1,000.00");
  });

  it("returns an em dash for non-finite input", () => {
    expect(formatAmount("en", Number.NaN, "USDT")).toBe("—");
  });
});

describe("formatPrice", () => {
  it("formats an IDR price with the Rp prefix and locale grouping", () => {
    expect(formatPrice("id", 16485, "IDR")).toBe("Rp16.485");
    expect(formatPrice("en", 16485, "IDR")).toBe("Rp16,485");
  });

  it("formats a large USDT price with 2 decimals", () => {
    expect(formatPrice("en", 109420.2, "USDT")).toBe("109,420.20 USDT");
    expect(formatPrice("id", 109420.2, "USDT")).toBe("109.420,20 USDT");
  });

  it("keeps 4 significant digits for sub-unit crypto prices", () => {
    expect(formatPrice("en", 0.02984, "BTC")).toBe("0.02984 BTC");
    expect(formatPrice("id", 0.02984, "BTC")).toBe("0,02984 BTC");
  });

  it("returns an em dash for non-finite input", () => {
    expect(formatPrice("en", Number.NaN, "BTC")).toBe("—");
  });
});

describe("priceDecimals", () => {
  it("chooses decimals by magnitude and currency", () => {
    expect(priceDecimals(109420.2)).toBe(2);
    expect(priceDecimals(2.5)).toBe(4);
    expect(priceDecimals(0.02984)).toBe(5);
    expect(priceDecimals(0.00001234)).toBe(8);
    expect(priceDecimals(16485, "IDR")).toBe(0);
    expect(priceDecimals(0.5, "IDR")).toBe(2);
    expect(priceDecimals(0)).toBe(2);
  });
});

describe("withCurrency", () => {
  it("prefixes fiat symbols and suffixes crypto codes", () => {
    expect(withCurrency("16,485", "IDR")).toBe("Rp16,485");
    expect(withCurrency("1,000.00", "USDT")).toBe("1,000.00 USDT");
  });
});

describe("formatPercent", () => {
  it("adds an explicit plus sign for positive values", () => {
    expect(formatPercent("en", 2.41)).toBe("+2.41%");
    expect(formatPercent("id", 2.41)).toBe("+2,41%");
  });

  it("keeps the minus sign for negative values and no sign for zero", () => {
    expect(formatPercent("en", -0.42)).toBe("-0.42%");
    expect(formatPercent("en", 0)).toBe("0.00%");
  });

  it("honours the decimals argument and non-finite input", () => {
    expect(formatPercent("en", 2.4567, 1)).toBe("+2.5%");
    expect(formatPercent("en", Number.NaN)).toBe("—");
  });
});

describe("formatSpread", () => {
  it("renders a fraction as a whole percent when possible", () => {
    expect(formatSpread("en", 0.05)).toBe("5%");
    expect(formatSpread("id", 0.05)).toBe("5%");
  });

  it("keeps fractional percents with the locale decimal separator", () => {
    expect(formatSpread("en", 0.025)).toBe("2.5%");
    expect(formatSpread("id", 0.025)).toBe("2,5%");
  });
});

describe("formatTime / formatDateTime", () => {
  const date = new Date("2026-09-29T08:05:09Z");

  it("renders a 24-hour time with seconds", () => {
    // Timezone-independent assertion: shape only.
    expect(formatTime("en", date)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(formatTime("id", date.toISOString())).toMatch(/^\d{2}[.:]\d{2}[.:]\d{2}$/);
  });

  it("renders a medium date with a short time", () => {
    expect(formatDateTime("en", date)).toContain("2026");
    expect(formatDateTime("id", date.getTime())).toContain("2026");
  });

  it("returns an em dash for invalid dates", () => {
    expect(formatTime("en", "not-a-date")).toBe("—");
    expect(formatDateTime("id", Number.NaN)).toBe("—");
  });
});

describe("formatRelativeTime", () => {
  const now = Date.UTC(2026, 8, 29, 12, 0, 0);

  it("localises minutes ago", () => {
    expect(formatRelativeTime("en", now - 2 * 60_000, now)).toBe("2 minutes ago");
    expect(formatRelativeTime("id", now - 2 * 60_000, now)).toBe("2 menit yang lalu");
  });

  it("scales to hours and days", () => {
    expect(formatRelativeTime("en", now - 3 * 3_600_000, now)).toBe("3 hours ago");
    expect(formatRelativeTime("en", now - 2 * 86_400_000, now)).toBe("2 days ago");
  });

  it("uses natural wording for the immediate past", () => {
    expect(formatRelativeTime("en", now, now)).toBe("now");
  });
});

describe("parseAmountInput", () => {
  it("accepts the Indonesian convention (dot thousands, comma decimal)", () => {
    expect(parseAmountInput("1.000,50")).toBe(1000.5);
    expect(parseAmountInput("1.234.567,89")).toBe(1234567.89);
    expect(parseAmountInput("1000,5")).toBe(1000.5);
  });

  it("accepts the English convention (comma thousands, dot decimal)", () => {
    expect(parseAmountInput("1,000.50")).toBe(1000.5);
    expect(parseAmountInput("1,234,567.89")).toBe(1234567.89);
    expect(parseAmountInput("1000.5")).toBe(1000.5);
  });

  it("accepts plain integers and ignores surrounding whitespace", () => {
    expect(parseAmountInput("1000")).toBe(1000);
    expect(parseAmountInput("  250 ")).toBe(250);
    expect(parseAmountInput("1 000,5")).toBe(1000.5);
  });

  it("returns NaN for empty or non-numeric input", () => {
    expect(parseAmountInput("")).toBeNaN();
    expect(parseAmountInput("   ")).toBeNaN();
    expect(parseAmountInput("abc")).toBeNaN();
    expect(parseAmountInput("10 USDT")).toBeNaN();
    expect(parseAmountInput("-5")).toBeNaN();
    expect(parseAmountInput("1e3")).toBeNaN();
  });
});
