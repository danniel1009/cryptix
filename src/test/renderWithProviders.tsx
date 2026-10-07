import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/types";
import { RuntimeConfigProvider, type RuntimePublicConfig } from "@/providers/RuntimeConfigProvider";

/** A configured site: every WhatsApp CTA links to wa.me/<this number>; the footer shows this e-mail. */
export const TEST_RUNTIME_CONFIG: RuntimePublicConfig = {
  whatsappNumber: "6281234567890",
  contactEmail: "hello@example.com",
};

/** Nothing configured: WhatsApp CTAs fall back to #contact and no mailto link is rendered. */
export const UNCONFIGURED_RUNTIME_CONFIG: RuntimePublicConfig = { whatsappNumber: "", contactEmail: "" };

export interface ProvidersOptions {
  locale?: Locale;
  /** Runtime contact config the tree sees (defaults to the configured fixture). */
  runtime?: RuntimePublicConfig;
}

/** The provider stack a real page has around a component: i18n + runtime contact config. */
export function TestProviders({
  locale = "en",
  runtime = TEST_RUNTIME_CONFIG,
  children,
}: ProvidersOptions & { children: ReactNode }) {
  return (
    <I18nProvider initialLocale={locale}>
      <RuntimeConfigProvider value={runtime}>{children}</RuntimeConfigProvider>
    </I18nProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  { locale, runtime, ...options }: ProvidersOptions & Omit<RenderOptions, "wrapper"> = {},
): RenderResult {
  return render(ui, {
    ...options,
    wrapper: ({ children }) => (
      <TestProviders locale={locale} runtime={runtime}>
        {children}
      </TestProviders>
    ),
  });
}
