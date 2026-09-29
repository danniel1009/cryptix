/**
 * Central site / brand configuration.
 *
 * Everything brand-specific lives here so the brand can be swapped later by
 * changing one file (or the NEXT_PUBLIC_* environment variables).
 *
 * NEXT_PUBLIC_* values are inlined at build time and are safe for the client.
 * Secrets (API keys, SMTP, webhooks) live in `src/config/server.ts` only.
 */
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/types";

export type NavSectionId =
  | "exchange"
  | "market"
  | "how-it-works"
  | "security"
  | "faq"
  | "contact";

export interface NavItem {
  /** i18n key inside `t.nav` and the DOM id of the target section. */
  id: NavSectionId;
  href: `#${NavSectionId}`;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: "exchange", href: "#exchange" },
  { id: "market", href: "#market" },
  { id: "how-it-works", href: "#how-it-works" },
  { id: "security", href: "#security" },
  { id: "faq", href: "#faq" },
  { id: "contact", href: "#contact" },
] as const;

function readPublicEnv(name: string, fallback = ""): string {
  // process.env.NEXT_PUBLIC_* must be referenced statically for Next to inline it.
  const map: Record<string, string | undefined> = {
    NEXT_PUBLIC_BRAND_NAME: process.env.NEXT_PUBLIC_BRAND_NAME,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_WHATSAPP_NUMBER: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
    NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
    NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
  };
  const value = map[name];
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

/** Digits only, e.g. "6281234567890". Used for https://wa.me/<number>. */
export function normalizeWhatsAppNumber(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

export const siteConfig = {
  /** Brand name shown everywhere (logo, titles, footer, WhatsApp messages). */
  name: readPublicEnv("NEXT_PUBLIC_BRAND_NAME", "Cryptix"),
  /** Canonical URL used for Open Graph / metadataBase. */
  url: readPublicEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000"),
  /** WhatsApp number in international format, digits only. Empty = not configured. */
  whatsappNumber: normalizeWhatsAppNumber(
    readPublicEnv("NEXT_PUBLIC_WHATSAPP_NUMBER", ""),
  ),
  /** Public contact email shown in the footer / contact section. */
  contactEmail: readPublicEnv("NEXT_PUBLIC_CONTACT_EMAIL", ""),
  /** Language used when the visitor has no stored preference. */
  defaultLocale: ((): Locale => {
    const v = readPublicEnv("NEXT_PUBLIC_DEFAULT_LOCALE", DEFAULT_LOCALE);
    return v === "id" ? "id" : "en";
  })(),
  copyrightYear: 2026,
  nav: NAV_ITEMS,
} as const;

export type SiteConfig = typeof siteConfig;
