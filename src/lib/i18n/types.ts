export const LOCALES = ["en", "id"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Cookie read on the server so SSR renders the visitor's language (no flash). */
export const LOCALE_COOKIE = "cryptix_locale";
/** localStorage mirror of the cookie. */
export const LOCALE_STORAGE_KEY = "cryptix_locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const LOCALE_LABELS: Record<Locale, { short: string; long: string }> = {
  en: { short: "EN", long: "English" },
  id: { short: "ID", long: "Bahasa Indonesia" },
};

/** BCP-47 tags used with Intl.* APIs. */
export const INTL_LOCALES: Record<Locale, string> = {
  en: "en-US",
  id: "id-ID",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
