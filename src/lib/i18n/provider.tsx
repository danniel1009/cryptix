"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CurrencyCode } from "@/config/exchange";
import { siteConfig } from "@/config/site";
import { dictionaries, interpolate, type Dictionary } from "@/lib/i18n/dictionaries";
import {
  formatAmount,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatPrice,
  formatRelativeTime,
  formatSpread,
  formatTime,
} from "@/lib/i18n/format";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_STORAGE_KEY,
  type Locale,
} from "@/lib/i18n/types";

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** The full dictionary for the active locale. Access as `t.hero.title`. */
  t: Dictionary;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatAmount: (
    value: number,
    currency: CurrencyCode,
    options?: { compact?: boolean; withSymbol?: boolean },
  ) => string;
  formatPrice: (value: number, currency: CurrencyCode) => string;
  formatPercent: (value: number, decimals?: number) => string;
  formatSpread: (spread: number) => string;
  formatTime: (date: Date | string | number) => string;
  formatDateTime: (date: Date | string | number) => string;
  formatRelativeTime: (date: Date | string | number, now?: number) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function persistLocale(locale: Locale) {
  try {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
  } catch {
    /* ignore */
  }
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}

export function I18nProvider({
  initialLocale,
  children,
}: {
  /** Resolved on the server from the cookie so SSR and hydration agree. */
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // Keep the document language and the SEO title/description in sync with a
  // client-side switch (the server renders them for the cookie locale only).
  useEffect(() => {
    document.documentElement.lang = locale;
    const { seo } = dictionaries[locale];
    document.title = interpolate(seo.title, { brand: siteConfig.name });
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (meta) meta.content = interpolate(seo.description, { brand: siteConfig.name });
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persistLocale(next);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: dictionaries[locale],
      formatNumber: (v, o) => formatNumber(locale, v, o),
      formatAmount: (v, c, o) => formatAmount(locale, v, c, o),
      formatPrice: (v, c) => formatPrice(locale, v, c),
      formatPercent: (v, d) => formatPercent(locale, v, d),
      formatSpread: (s) => formatSpread(locale, s),
      formatTime: (d) => formatTime(locale, d),
      formatDateTime: (d) => formatDateTime(locale, d),
      formatRelativeTime: (d, now) => formatRelativeTime(locale, d, now),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>");
  return ctx;
}
