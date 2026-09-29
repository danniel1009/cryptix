"use client";

import { ArrowUpRight } from "lucide-react";
import { WhatsAppGlyph } from "@/components/layout/WhatsAppFloat";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { motion, useReducedMotion } from "framer-motion";
import { REVEAL_EASE } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { interpolate } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import { useExchangeRequest } from "@/providers/ExchangeRequestProvider";
import { ConverterPanels } from "./rate-checker/ConverterPanels";
import { RateDetails } from "./rate-checker/RateDetails";
import { useRateChecker } from "./rate-checker/useRateChecker";

const HEADING_ID = "exchange-title";

/**
 * `#exchange` — the exchange rate converter card (docs/CONVERTER.md). Sits
 * directly under the hero's glow line, hence the reduced top padding. One
 * centred 680px card: "From" panel → swap button → "To" panel → rate lines →
 * one full-width "Request exchange" CTA with a WhatsApp text link under it.
 * The full disclaimer and the connection notes are tiny lines under the card.
 */
export function RateChecker() {
  const { t, formatSpread } = useI18n();
  const { open } = useExchangeRequest();
  const rc = useRateChecker();
  const reduced = useReducedMotion() ?? false;

  const connectionNote =
    rc.connectionNote === "polling" ? t.market.pollingNote : rc.connectionNote === "offline" ? t.market.offlineNote : null;

  return (
    <Section id="exchange" aria-labelledby={HEADING_ID} className="pt-8 sm:pt-12 lg:pt-16">
      <Container>
        <motion.div initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: REVEAL_EASE }}>
          <SectionHeading
            id={HEADING_ID}
            align="center"
            eyebrow={t.rateChecker.eyebrow}
            title={t.rateChecker.title}
            description={t.rateChecker.description}
            titleClassName="font-normal leading-[1.1] tracking-[-0.02em] lg:text-[2.75rem]"
          />
        </motion.div>

        {/* The converter is the page's most important element: animate on mount (not on
            scroll-into-view) so it can never stay hidden if an observer never fires. */}
        <motion.div
          className="mt-10 sm:mt-14"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: REVEAL_EASE }}
        >
          <Card padding="none" className="glow-accent mx-auto w-full max-w-[680px] rounded-3xl border-line bg-surface/90 p-5 sm:p-7 lg:p-8">
            <ConverterPanels rc={rc} />
            <RateDetails rc={rc} />

            <div className="mt-6 flex flex-col items-center gap-2">
              <Button size="xl" fullWidth rightIcon={<ArrowUpRight strokeWidth={2.25} />} onClick={() => open(rc.getPrefill())}>
                {t.rateChecker.requestExchange}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                href={rc.whatsappHref}
                {...(rc.whatsappConfigured ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                leftIcon={<WhatsAppGlyph />}
              >
                {t.rateChecker.chatOnWhatsApp}
              </Button>
            </div>
          </Card>

          <div className="mx-auto mt-6 max-w-[680px] space-y-2 text-center">
            {connectionNote ? <p className="text-[11px] leading-relaxed text-warning">{connectionNote}</p> : null}
            <p className="text-xs leading-relaxed text-faint">
              {interpolate(t.disclaimer.full, { spread: formatSpread(rc.spread) })}
            </p>
          </div>
        </motion.div>
      </Container>
    </Section>
  );
}
