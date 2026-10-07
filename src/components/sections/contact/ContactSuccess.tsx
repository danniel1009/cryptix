"use client";

import { CircleCheck } from "lucide-react";
import { useEffect, useRef } from "react";
import { WhatsAppGlyph } from "@/components/layout/WhatsAppFloat";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useWhatsApp } from "@/hooks/useWhatsApp";
import { interpolate } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import { buildGeneralInquiryMessage } from "@/lib/whatsapp";

export interface ContactSuccessProps {
  /** "CX-XXXXXX" returned by `/api/contact`. */
  reference: string;
  /** "Send another message" — resets the form. */
  onReset: () => void;
}

/**
 * Replaces the form after a successful submission. The message was RECEIVED —
 * nothing has been exchanged or executed; the copy says so. Focus moves to the
 * heading so keyboard and screen-reader users land on the confirmation.
 */
export function ContactSuccess({ reference, onReset }: ContactSuccessProps) {
  const { t, locale } = useI18n();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const referenceText = interpolate(t.contact.success.reference, { reference });
  const whatsapp = useWhatsApp();
  const whatsappHref = whatsapp.configured
    ? whatsapp.url(`${buildGeneralInquiryMessage(locale)}\n\n${referenceText}`)
    : null;

  return (
    <Card padding="lg" glow className="flex h-full flex-col">
      <div role="status" aria-live="polite">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-accent/30 bg-accent-soft text-accent"
        >
          <CircleCheck className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="mt-6 text-2xl font-medium tracking-tight text-fg focus:outline-none sm:text-[1.75rem]"
        >
          {t.contact.success.title}
        </h3>
        <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">{t.contact.success.body}</p>
        <p className="mt-5 inline-flex max-w-full items-center rounded-full border border-line bg-surface-2 px-3.5 py-1.5 font-mono text-sm nums text-fg">
          <span className="truncate">{referenceText}</span>
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {whatsappHref ? (
          <Button
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            variant="whatsapp"
            leftIcon={<WhatsAppGlyph />}
            className="w-full sm:w-auto"
          >
            {t.contact.success.chat}
          </Button>
        ) : null}
        <Button variant="ghost" onClick={onReset} className="w-full sm:w-auto">
          {t.contact.success.another}
        </Button>
      </div>
    </Card>
  );
}
