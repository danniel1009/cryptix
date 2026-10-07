"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useReducedMotionSafe } from "@/hooks/useReducedMotionSafe";
import { useSmoothScrollTo } from "@/hooks/useSmoothScrollTo";
import { useWhatsApp } from "@/hooks/useWhatsApp";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { buildGeneralInquiryMessage } from "@/lib/whatsapp";

/**
 * Original chat glyph (speech bubble + handset). Deliberately NOT the
 * trademarked WhatsApp logo. Inherits `currentColor`.
 */
export function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={cn("h-6 w-6", className)}>
      <path
        d="M12 3.5c-4.7 0-8.5 3.4-8.5 7.6 0 1.7.6 3.3 1.7 4.6L4 20.5l4.9-1.3c1 .3 2 .5 3.1.5 4.7 0 8.5-3.4 8.5-7.6S16.7 3.5 12 3.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 8.6c.3-.3.8-.3 1 .1l.9 1.4c.2.4.1.8-.2 1.1l-.5.5c.6 1.2 1.6 2.2 2.8 2.8l.5-.5c.3-.3.7-.4 1.1-.2l1.4.9c.4.2.5.7.1 1l-.6.6c-.6.6-1.5.8-2.3.5-2.2-.8-4-2.6-4.8-4.8-.3-.8-.1-1.7.5-2.3l.1-.1z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Floating WhatsApp entry point: fixed bottom-right above the safe area,
 * z-40 (under the z-50 modal/menu). Gentle bob (3s loop; off under reduced
 * motion). On hover/focus a label chip expands to the left on ≥sm screens.
 * Falls back to the #contact section when WhatsApp is not configured.
 */
export function WhatsAppFloat() {
  const { t, locale } = useI18n();
  const reduced = useReducedMotionSafe();
  const scrollTo = useSmoothScrollTo();
  const [expanded, setExpanded] = useState(false);

  const { configured, url } = useWhatsApp();
  const href = configured ? url(buildGeneralInquiryMessage(locale)) : "#contact";

  return (
    <div className="fixed bottom-safe right-safe z-40 flex items-center gap-3">
      <AnimatePresence>
        {expanded ? (
          <motion.div
            key="chip"
            aria-hidden="true"
            initial={{ opacity: 0, x: 10, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.96 }}
            transition={{ duration: reduced ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="glass pointer-events-none hidden flex-col rounded-2xl px-4 py-2.5 shadow-float sm:flex"
          >
            <span className="text-sm font-semibold leading-tight text-fg">{t.whatsapp.floating.title}</span>
            <span className="text-xs text-muted">{t.whatsapp.floating.subtitle}</span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.a
        href={href}
        target={configured ? "_blank" : undefined}
        rel={configured ? "noopener noreferrer" : undefined}
        aria-label={t.whatsapp.floating.ariaLabel}
        onClick={
          configured
            ? undefined
            : (event) => {
                event.preventDefault();
                scrollTo("contact");
              }
        }
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        onFocus={() => setExpanded(true)}
        onBlur={() => setExpanded(false)}
        animate={reduced ? undefined : { y: [0, -5, 0] }}
        transition={reduced ? undefined : { duration: 3, repeat: Infinity, ease: "easeInOut" }}
        whileTap={reduced ? undefined : { scale: 0.94 }}
        className={cn(
          "group relative flex h-14 w-14 items-center justify-center rounded-full bg-whatsapp text-[#04140B]",
          "shadow-[0_12px_32px_-10px_rgba(37,211,102,0.7),0_0_0_1px_rgba(37,211,102,0.35)]",
          "transition-[box-shadow,background-color] duration-200 hover:bg-[#3AE27A]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-whatsapp/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        )}
      >
        <span aria-hidden="true" className="absolute inset-0 animate-halo-slow rounded-full bg-whatsapp/35" />
        <WhatsAppGlyph className="relative h-7 w-7" />
      </motion.a>
    </div>
  );
}
