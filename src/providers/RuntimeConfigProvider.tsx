"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

/**
 * Public contact details that are read by the SERVER on every request (from
 * `WHATSAPP_NUMBER` / `PUBLIC_CONTACT_EMAIL`, see `@/config/runtime.server`)
 * and handed to the client tree through this provider. Changing them is an
 * env edit + service restart — never a rebuild.
 */
export interface RuntimePublicConfig {
  /** WhatsApp number, international format, digits only. Empty = not configured. */
  whatsappNumber: string;
  /** Public e-mail shown in the footer / contact section. Empty = not shown. */
  contactEmail: string;
}

/**
 * The value seen outside a provider (tests, stories, isolated renders):
 * nothing is configured, so every WhatsApp CTA falls back to `#contact` and
 * the mailto link is omitted. Deliberately silent — no warning is logged.
 */
export const EMPTY_RUNTIME_CONFIG: RuntimePublicConfig = Object.freeze({
  whatsappNumber: "",
  contactEmail: "",
});

const RuntimeConfigContext = createContext<RuntimePublicConfig>(EMPTY_RUNTIME_CONFIG);

export interface RuntimeConfigProviderProps {
  value: RuntimePublicConfig;
  children: ReactNode;
}

export function RuntimeConfigProvider({ value, children }: RuntimeConfigProviderProps) {
  const { whatsappNumber, contactEmail } = value;
  // Memoised on the two strings so a fresh object literal per render never re-renders every consumer.
  const memo = useMemo<RuntimePublicConfig>(() => ({ whatsappNumber, contactEmail }), [whatsappNumber, contactEmail]);
  return <RuntimeConfigContext.Provider value={memo}>{children}</RuntimeConfigContext.Provider>;
}

/** `{ whatsappNumber, contactEmail }` from the nearest provider; both `""` without one. */
export function useRuntimeConfig(): RuntimePublicConfig {
  return useContext(RuntimeConfigContext);
}
