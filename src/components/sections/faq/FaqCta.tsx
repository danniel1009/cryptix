"use client";

import { ArrowUpRight } from "lucide-react";
import type { MouseEvent } from "react";
import { WhatsAppGlyph } from "@/components/layout/WhatsAppFloat";
import { Button } from "@/components/ui/Button";
import { useSmoothScrollTo } from "@/hooks/useSmoothScrollTo";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import {
  buildGeneralInquiryMessage,
  buildWhatsAppUrl,
  isWhatsAppConfigured,
  WHATSAPP_FALLBACK_HREF,
} from "@/lib/whatsapp";
import { useExchangeRequest } from "@/providers/ExchangeRequestProvider";

export interface FaqCtaProps {
  className?: string;
}

/**
 * The short CTA cluster in the FAQ's sticky column: the primary
 * "Request exchange" (opens the exchange request modal, no prefill) and a
 * secondary "Chat on WhatsApp" link pre-filled with the localised general
 * inquiry. Without a configured WhatsApp number the secondary falls back to
 * the #contact section, like every other WhatsApp entry point on the site.
 *
 * Buttons are `md` (44px) so they stay tappable on mobile, and full-width
 * below `sm` so the pair stacks cleanly.
 */
export function FaqCta({ className }: FaqCtaProps) {
  const { t, locale } = useI18n();
  const { open } = useExchangeRequest();
  const scrollTo = useSmoothScrollTo();

  const configured = isWhatsAppConfigured();
  const whatsappHref = configured
    ? buildWhatsAppUrl(buildGeneralInquiryMessage(locale))
    : WHATSAPP_FALLBACK_HREF;

  const onFallbackClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Smooth-scroll when the contact section is on the page; otherwise let the
    // native anchor jump happen so the link never becomes a dead click.
    if (scrollTo("contact")) event.preventDefault();
  };

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:flex-wrap", className)}>
      <Button
        onClick={() => open()}
        rightIcon={<ArrowUpRight strokeWidth={2.25} />}
        className="w-full sm:w-auto"
      >
        {t.common.requestExchange}
      </Button>
      <Button
        variant="secondary"
        href={whatsappHref}
        target={configured ? "_blank" : undefined}
        rel={configured ? "noopener noreferrer" : undefined}
        onClick={configured ? undefined : onFallbackClick}
        leftIcon={<WhatsAppGlyph />}
        className="w-full sm:w-auto"
      >
        {t.common.chatOnWhatsApp}
      </Button>
    </div>
  );
}
