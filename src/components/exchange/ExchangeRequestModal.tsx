"use client";

import { MessageCircle } from "lucide-react";
import { useId, useRef, useState, type MouseEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useSmoothScrollTo } from "@/hooks/useSmoothScrollTo";
import { useWhatsApp } from "@/hooks/useWhatsApp";
import { useI18n } from "@/lib/i18n/provider";
import { buildExchangeInquiryMessage, buildGeneralInquiryMessage } from "@/lib/whatsapp";
import { useExchangeRequest, type ExchangeRequestPrefill } from "@/providers/ExchangeRequestProvider";
import { ExchangeRequestForm } from "./ExchangeRequestForm";
import { ExchangeRequestSuccess } from "./ExchangeRequestSuccess";
import { useExchangeRequestForm } from "./useExchangeRequestForm";

/**
 * The Request exchange modal. Rendered ONCE in page.tsx; opened from the
 * navbar, hero / FAQ CTAs and the rate checker via `useExchangeRequest().open()`.
 *
 * It never executes anything: it sends a REQUEST to the team, who confirm
 * the final rate over WhatsApp / e-mail.
 *
 * One fresh dialog instance per opening: the key increments on each
 * closed → open transition (derived-state pattern, no effect), so the form
 * re-initialises from the current prefill and a finished success screen can
 * never leak into the next opening. Closing keeps the key, so the exit
 * animation still plays on the same instance.
 */
export function ExchangeRequestModal() {
  const { isOpen, prefill, close } = useExchangeRequest();
  const [session, setSession] = useState({ open: false, count: 0 });
  if (session.open !== isOpen) {
    setSession({ open: isOpen, count: isOpen ? session.count + 1 : session.count });
  }
  return <ExchangeRequestDialog key={session.count} open={isOpen} prefill={prefill} onClose={close} />;
}

interface ExchangeRequestDialogProps {
  open: boolean;
  prefill: ExchangeRequestPrefill | null;
  onClose: () => void;
}

function ExchangeRequestDialog({ open, prefill, onClose }: ExchangeRequestDialogProps) {
  const { t, locale } = useI18n();
  const formRef = useRef<HTMLFormElement | null>(null);
  const form = useExchangeRequestForm({ prefill, formRef });
  const formId = useId();
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  // Autofocusing a text field on a phone pops the keyboard over the sheet; desktop only.
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const scrollTo = useSmoothScrollTo();
  const { success, submitting, values, amount, estimate } = form;

  const { configured: whatsappConfigured, url: whatsappUrl } = useWhatsApp();

  /** Success: the same request, now with its reference ("#contact" when unconfigured). */
  const successWhatsappHref = success
    ? whatsappUrl(
        buildExchangeInquiryMessage({
          locale,
          pairId: success.pairId,
          amount: success.amount,
          estimatedReceive: success.estimatedReceive,
          reference: success.reference,
        }),
      )
    : "#contact";

  /**
   * Form: the CURRENT pair / amount / estimate, so the chat starts with what the
   * visitor is looking at. Without a usable amount the message is the general
   * inquiry (an "Amount: —" line would only confuse the team).
   */
  const hasAmount = Number.isFinite(amount) && amount > 0;
  const formWhatsappHref = whatsappConfigured
    ? whatsappUrl(
        hasAmount
          ? buildExchangeInquiryMessage({ locale, pairId: values.pairId, amount, estimatedReceive: estimate })
          : buildGeneralInquiryMessage(locale),
      )
    : "#contact";

  /** Without a configured number the success CTA falls back to the contact section. */
  const onChatClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (whatsappConfigured) return;
    event.preventDefault();
    onClose();
    scrollTo("contact");
  };

  const footer = success ? (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
      <Button type="button" variant="ghost" onClick={onClose} className="w-full sm:w-auto">
        {t.exchangeRequest.success.close}
      </Button>
      <Button
        href={successWhatsappHref}
        target={whatsappConfigured ? "_blank" : undefined}
        rel={whatsappConfigured ? "noopener noreferrer" : undefined}
        onClick={onChatClick}
        leftIcon={<MessageCircle />}
        className="w-full sm:w-auto"
      >
        {t.exchangeRequest.success.chat}
      </Button>
    </div>
  ) : (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Button type="button" variant="ghost" onClick={onClose} disabled={submitting} className="w-full sm:w-auto">
        {t.exchangeRequest.cancel}
      </Button>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        {whatsappConfigured ? (
          <Button
            variant="whatsapp"
            href={formWhatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            leftIcon={<MessageCircle />}
            className="w-full sm:w-auto"
          >
            {t.exchangeRequest.chatWhatsApp}
          </Button>
        ) : null}
        <Button type="submit" form={formId} loading={submitting} className="w-full sm:w-auto">
          {submitting ? t.form.submitting : t.exchangeRequest.submit}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.exchangeRequest.title}
      description={success ? undefined : t.exchangeRequest.subtitle}
      closeLabel={t.common.close}
      size="lg"
      footer={footer}
      initialFocusRef={isDesktop ? firstFieldRef : undefined}
      dismissible={!submitting}
    >
      {success ? (
        <ExchangeRequestSuccess success={success} onNewRequest={form.startAnother} />
      ) : (
        <ExchangeRequestForm id={formId} form={form} formRef={formRef} firstFieldRef={firstFieldRef} />
      )}
    </Modal>
  );
}
