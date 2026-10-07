"use client";

import { useCallback, useMemo } from "react";
import { buildWhatsAppUrl, isWhatsAppConfigured, WHATSAPP_FALLBACK_HREF } from "@/lib/whatsapp";
import { useRuntimeConfig } from "@/providers/RuntimeConfigProvider";

export interface WhatsAppLink {
  /** Digits only; "" when not configured. */
  number: string;
  configured: boolean;
  /**
   * `https://wa.me/<number>?text=<encoded message>` (just the chat link without
   * a message), or `"#contact"` when no number is configured so anchors still work.
   */
  url: (message?: string) => string;
}

/**
 * The ONLY way a client component should build a WhatsApp link: the number is
 * the runtime value from `<RuntimeConfigProvider>` (env read per request),
 * never the build-time `siteConfig.whatsappNumber`.
 */
export function useWhatsApp(): WhatsAppLink {
  const { whatsappNumber } = useRuntimeConfig();
  const configured = isWhatsAppConfigured(whatsappNumber);
  const url = useCallback(
    (message?: string) => (configured ? buildWhatsAppUrl(message, whatsappNumber) : WHATSAPP_FALLBACK_HREF),
    [configured, whatsappNumber],
  );
  return useMemo(() => ({ number: whatsappNumber, configured, url }), [whatsappNumber, configured, url]);
}

/** Public contact e-mail from the runtime config; "" when not configured (render no mailto link). */
export function useContactEmail(): string {
  return useRuntimeConfig().contactEmail;
}
