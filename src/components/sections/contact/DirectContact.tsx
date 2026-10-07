"use client";

import { ArrowUpRight, Clock, Mail, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { WhatsAppGlyph } from "@/components/layout/WhatsAppFloat";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useContactEmail, useWhatsApp } from "@/hooks/useWhatsApp";
import { useI18n } from "@/lib/i18n/provider";
import { buildGeneralInquiryMessage } from "@/lib/whatsapp";

/** 48px circular icon well (docs/DESIGN.md → "Icon wells"). */
function IconWell({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 text-fg [&>svg]:h-5 [&>svg]:w-5"
    >
      {children}
    </span>
  );
}

/**
 * "Prefer to talk directly?" — the human channels next to the form. WhatsApp
 * and email are the RUNTIME values (`<RuntimeConfigProvider>`, env read per
 * request); an unconfigured channel is replaced by a note (WhatsApp) or
 * omitted (email) rather than rendering a dead link.
 */
export function DirectContact() {
  const { t, locale } = useI18n();
  const { configured: whatsappConfigured, url: whatsappUrl } = useWhatsApp();
  const email = useContactEmail();

  return (
    <Card padding="lg" className="flex h-full flex-col">
      <h3 className="text-xl font-medium tracking-tight text-fg">{t.contact.directTitle}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{t.contact.directBody}</p>

      <ul role="list" className="mt-7 divide-y divide-line border-y border-line">
        <li className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <IconWell>
              <WhatsAppGlyph />
            </IconWell>
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg">{t.contact.whatsappLabel}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                {whatsappConfigured ? t.contact.whatsappHint : t.whatsapp.notConfigured}
              </p>
            </div>
          </div>
          {whatsappConfigured ? (
            <Button
              href={whatsappUrl(buildGeneralInquiryMessage(locale))}
              target="_blank"
              rel="noopener noreferrer"
              variant="whatsapp"
              size="sm"
              rightIcon={<ArrowUpRight />}
              className="h-11 w-full sm:h-9 sm:w-auto"
            >
              {t.contact.whatsappLabel}
            </Button>
          ) : null}
        </li>

        {email ? (
          <li className="flex items-center gap-4 py-5">
            <IconWell>
              <Mail strokeWidth={1.75} />
            </IconWell>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">{t.contact.emailLabel}</p>
              <a
                href={`mailto:${email}`}
                className="mt-0.5 inline-flex min-h-11 max-w-full items-center truncate font-mono text-sm text-muted sm:min-h-0 transition-colors duration-200 hover:text-fg focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
              >
                {email}
              </a>
              <p className="mt-0.5 text-xs leading-relaxed text-faint">{t.contact.emailHint}</p>
            </div>
          </li>
        ) : null}
      </ul>

      <div className="mt-auto space-y-3 pt-7">
        <p className="flex items-start gap-2.5 text-sm leading-relaxed text-muted">
          <Clock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} />
          <span>{t.contact.responseTime}</span>
        </p>
        <p className="flex items-start gap-2.5 text-xs leading-relaxed text-faint">
          <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span>{t.contact.privacyNote}</span>
        </p>
      </div>
    </Card>
  );
}
