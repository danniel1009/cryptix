"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useRef } from "react";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { WhatsAppGlyph } from "@/components/layout/WhatsAppFloat";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Logo } from "@/components/ui/Logo";
import { useFocusTrap } from "@/components/ui/Modal";
import { siteConfig } from "@/config/site";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { useReducedMotionSafe } from "@/hooks/useReducedMotionSafe";
import { useSmoothScrollTo } from "@/hooks/useSmoothScrollTo";
import { useWhatsApp } from "@/hooks/useWhatsApp";
import { useI18n } from "@/lib/i18n/provider";
import { buildGeneralInquiryMessage } from "@/lib/whatsapp";
import { useExchangeRequest } from "@/providers/ExchangeRequestProvider";

export interface MobileMenuProps {
  /** DOM id referenced by the hamburger's aria-controls. */
  id: string;
  open: boolean;
  onClose: () => void;
}

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Full-screen slide-in navigation for < lg. Focus-trapped dialog, Escape
 * closes, body scroll locked, closes itself after navigating.
 */
export function MobileMenu({ id, open, onClose }: MobileMenuProps) {
  const { t, locale } = useI18n();
  const { open: openExchangeRequest } = useExchangeRequest();
  const reduced = useReducedMotionSafe();
  const scrollTo = useSmoothScrollTo();
  const panelRef = useRef<HTMLDivElement>(null);

  useLockBodyScroll(open);
  useFocusTrap(panelRef, open, { onEscape: onClose });

  const whatsapp = useWhatsApp();
  const whatsappHref = whatsapp.configured ? whatsapp.url(buildGeneralInquiryMessage(locale)) : null;

  /** Close first (releases the scroll lock), then scroll on the next frames. */
  const navigate = (sectionId: string) => {
    onClose();
    requestAnimationFrame(() => requestAnimationFrame(() => scrollTo(sectionId)));
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="mobile-menu"
          ref={panelRef}
          id={id}
          role="dialog"
          aria-modal="true"
          aria-label={t.nav.menu}
          tabIndex={-1}
          initial={reduced ? { opacity: 0 } : { x: "100%" }}
          animate={reduced ? { opacity: 1 } : { x: 0 }}
          exit={reduced ? { opacity: 0 } : { x: "100%" }}
          transition={{ duration: reduced ? 0.15 : 0.38, ease: EASE }}
          className="fixed inset-0 z-50 flex flex-col bg-bg pt-safe outline-none lg:hidden"
        >
          <div aria-hidden="true" className="grid-bg pointer-events-none absolute inset-0 opacity-50" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-40 right-0 h-96 w-96 rounded-full bg-accent/10 blur-3xl"
          />

          <div className="relative flex h-16 shrink-0 items-center justify-between border-b border-line px-5 sm:px-8">
            <Logo size={28} withWordmark />
            <IconButton label={t.nav.closeMenu} icon={<X />} onClick={onClose} className="-mr-2" />
          </div>

          <nav aria-label={t.nav.menu} className="relative flex-1 overflow-y-auto px-5 py-6 scrollbar-thin sm:px-8">
            <ul role="list" className="flex flex-col">
              {siteConfig.nav.map((item, index) => (
                <li key={item.id}>
                  <a
                    href={item.href}
                    onClick={(event) => {
                      event.preventDefault();
                      navigate(item.id);
                    }}
                    className="group flex items-baseline gap-4 border-b border-line py-4 text-[1.75rem] font-semibold tracking-tight text-fg transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-none sm:text-3xl"
                  >
                    <span className="nums font-mono text-xs font-medium text-accent">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>{t.nav[item.id]}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="relative shrink-0 border-t border-line bg-bg/80 px-5 pt-5 pb-safe backdrop-blur sm:px-8">
            <div className="flex flex-col gap-3 pb-5">
              <Button
                size="lg"
                fullWidth
                onClick={() => {
                  onClose();
                  openExchangeRequest();
                }}
              >
                {t.nav.requestExchange}
              </Button>
              {whatsappHref ? (
                <Button
                  variant="whatsapp"
                  size="lg"
                  fullWidth
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  leftIcon={<WhatsAppGlyph />}
                >
                  {t.common.chatOnWhatsApp}
                </Button>
              ) : (
                <Button variant="secondary" size="lg" fullWidth onClick={() => navigate("contact")}>
                  {t.nav.contact}
                </Button>
              )}
              <div className="flex items-center justify-between pt-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">{t.nav.language}</span>
                <LanguageSwitcher variant="mobile" />
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
