import "server-only";
import { cookies } from "next/headers";
import { siteConfig } from "@/config/site";
import { isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n/types";
import { dictionaries, type Dictionary } from "@/lib/i18n/dictionaries";

/** Locale for the current request: cookie → configured default. */
export async function getServerLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : siteConfig.defaultLocale;
}

export async function getServerDictionary(): Promise<{ locale: Locale; t: Dictionary }> {
  const locale = await getServerLocale();
  return { locale, t: dictionaries[locale] };
}
