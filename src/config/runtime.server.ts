import "server-only";
import { normalizeWhatsAppNumber } from "@/config/site";
import type { RuntimePublicConfig } from "@/providers/RuntimeConfigProvider";

/**
 * RUNTIME public contact details — read from `process.env` on EVERY call, so
 * an operator changes them by editing `.env.production` and restarting the
 * service; no rebuild, no deploy.
 *
 *   WHATSAPP_NUMBER      (preferred) → NEXT_PUBLIC_WHATSAPP_NUMBER (build-time fallback)
 *   PUBLIC_CONTACT_EMAIL (preferred) → NEXT_PUBLIC_CONTACT_EMAIL  (build-time fallback)
 *
 * Deliberately no module-level cache: the lookups are dynamic
 * (`process.env[name]`) so Next cannot inline them at build time either.
 * `siteConfig.whatsappNumber` / `siteConfig.contactEmail` remain the inlined
 * fallbacks for pure callers that run without a request (tests, scripts).
 */

/** First non-blank value among `names`, trimmed; "" when none is set. */
function readEnv(names: readonly string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim().length > 0) return value.trim();
  }
  return "";
}

export function getRuntimePublicConfig(): RuntimePublicConfig {
  return {
    // Non-digits are stripped, so "+62 823-1760-0972" and "6282317600972" are the same number.
    whatsappNumber: normalizeWhatsAppNumber(readEnv(["WHATSAPP_NUMBER", "NEXT_PUBLIC_WHATSAPP_NUMBER"])),
    contactEmail: readEnv(["PUBLIC_CONTACT_EMAIL", "NEXT_PUBLIC_CONTACT_EMAIL"]),
  };
}
