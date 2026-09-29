"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import type { MouseEvent } from "react";
import { WhatsAppGlyph } from "@/components/layout/WhatsAppFloat";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { LiveIndicator, type LiveIndicatorState } from "@/components/ui/LiveIndicator";
import { REVEAL_EASE } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { useReducedMotionSafe } from "@/hooks/useReducedMotionSafe";
import { cn } from "@/lib/utils";
import { useSmoothScrollTo } from "@/hooks/useSmoothScrollTo";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import type { MarketStatus } from "@/lib/market/types";
import { buildGeneralInquiryMessage, buildWhatsAppUrl, isWhatsAppConfigured } from "@/lib/whatsapp";
import { useMarket, type MarketConnection } from "@/providers/MarketProvider";
import { GlowLine } from "./hero/GlowLine";
import { HeroBackground } from "./hero/HeroBackground";
import { ProcessStrip } from "./hero/ProcessStrip";

const HEADING_ID = "hero-title";

interface IndicatorView {
  state: LiveIndicatorState;
  label: string;
}

/**
 * Status pill wording (docs/ARCHITECTURE.md UI rule): `status` decides whether
 * data may be called live; a degraded `connection` with fresh data is still
 * live data but is flagged as reconnecting. Before the first snapshot arrives
 * we say "Loading…" rather than flashing "unavailable".
 */
function deriveIndicator(
  status: MarketStatus,
  connection: MarketConnection,
  hasSnapshot: boolean,
  t: Dictionary,
): IndicatorView {
  if (!hasSnapshot && connection === "connecting") return { state: "unavailable", label: t.common.loading };
  if (status === "unavailable") return { state: "unavailable", label: t.market.unavailable };
  if (status === "stale") return { state: "stale", label: t.market.stale };
  if (connection === "reconnecting" || connection === "polling" || connection === "offline") {
    return { state: "reconnecting", label: t.market.reconnecting };
  }
  return { state: "live", label: t.market.live };
}

/** Entrance is a CSS keyframe animation (globals.css `.hero-in`): it runs before
 *  hydration and without JS, so the h1 is never gated on the client bundle. */
function heroIn(index: number): { className: string; style: { animationDelay: string } } {
  return { className: "hero-in", style: { animationDelay: `${0.05 + index * 0.1}s` } };
}

const H1_CLASSES =
  "text-[2.75rem] font-normal leading-[1.02] tracking-[-0.03em] text-fg text-balance sm:text-6xl lg:text-7xl xl:text-[5.5rem]";

/**
 * Above-the-fold hero (`#top`). Sits directly under the sticky navbar and ends
 * with the glowing edge the Rate Checker panel hangs from — so it has no
 * bottom padding of its own. Entrance is a fade-up stagger on mount (the hero
 * is always in view on load); every transform is disabled under reduced motion.
 */
export function Hero() {
  const { t, locale } = useI18n();
  const { status, connection, snapshot } = useMarket();
  const scrollTo = useSmoothScrollTo();
  const reduced = useReducedMotionSafe();

  const indicator = deriveIndicator(status, connection, snapshot !== null, t);
  const whatsappConfigured = isWhatsAppConfigured();
  const whatsappHref = whatsappConfigured ? buildWhatsAppUrl(buildGeneralInquiryMessage(locale)) : "#contact";

  const scrollToSection = (event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>, id: string) => {
    event.preventDefault();
    // Falls back to the native hash jump when the target is not on the page.
    if (!scrollTo(id)) window.location.hash = `#${id}`;
  };

  return (
    <Section
      id="top"
      aria-labelledby={HEADING_ID}
      className="flex flex-col pt-12 pb-0 sm:pt-16 sm:pb-0 lg:min-h-[88svh] lg:pt-20 lg:pb-0"
    >
      <HeroBackground />

      <Container className="relative z-10 flex flex-1 flex-col items-center justify-center text-center">
        <div className="flex w-full max-w-5xl flex-col items-center">
          {/* Eyebrow pill with market status */}
          <div className="hero-in mb-7 sm:mb-9" style={heroIn(0).style}>
            <span className="glass inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full px-3 py-1.5 sm:gap-3 sm:pl-3 sm:pr-3.5">
              <LiveIndicator state={indicator.state} label={indicator.label} />
              <span aria-hidden="true" className="hidden h-3 w-px bg-line-strong sm:block" />
              <span className="font-mono text-[10px] uppercase leading-none tracking-[0.1em] text-muted sm:text-[11px] sm:tracking-[0.16em]">
                {t.hero.eyebrow}
              </span>
            </span>
          </div>

          <h1 id={HEADING_ID} className={cn(H1_CLASSES, "hero-in")} style={heroIn(1).style}>
            {t.hero.titleLine1}
            <br />
            <span className="[text-shadow:0_0_48px_rgba(34,229,138,0.22)]">{t.hero.titleLine2}</span>
          </h1>

          <p className="hero-in mt-6 max-w-2xl text-base text-muted sm:mt-7 sm:text-lg" style={heroIn(2).style}>
            {t.hero.subtitle}
          </p>

          {/* Supporting points */}
          <ul
            role="list"
            className="hero-in mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 font-mono text-xs uppercase tracking-[0.2em] text-faint sm:mt-6"
            style={heroIn(3).style}
          >
            {t.hero.supporting.map((point, index) => (
              <li key={point} className="flex items-center gap-3">
                {index > 0 ? (
                  <span aria-hidden="true" className="hidden text-faint/70 sm:inline">
                    •
                  </span>
                ) : null}
                <span>{point}</span>
              </li>
            ))}
          </ul>

          {/* CTAs */}
          <div
            className="hero-in mt-9 flex w-full flex-col items-stretch gap-3 sm:mt-10 sm:w-auto sm:flex-row sm:items-center sm:justify-center"
            style={heroIn(4).style}
          >
            <Button
              size="lg"
              href="#exchange"
              onClick={(event) => scrollToSection(event, "exchange")}
              rightIcon={<ArrowUpRight strokeWidth={2.25} />}
              className="w-full sm:w-auto"
            >
              {t.hero.ctaPrimary}
            </Button>
            {whatsappConfigured ? (
              <Button
                variant="secondary"
                size="lg"
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                leftIcon={<WhatsAppGlyph />}
                className="w-full sm:w-auto"
              >
                {t.hero.ctaSecondary}
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="lg"
                href="#contact"
                onClick={(event) => scrollToSection(event, "contact")}
                leftIcon={<WhatsAppGlyph />}
                className="w-full sm:w-auto"
              >
                {t.hero.ctaSecondary}
              </Button>
            )}
          </div>

          <p className="hero-in mt-6 max-w-xl text-xs leading-relaxed text-faint sm:text-[13px]" style={heroIn(5).style}>
            {t.hero.trustNote}
          </p>
        </div>

        {/* Process strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.7, ease: REVEAL_EASE }}
          className="mt-14 w-full sm:mt-16 lg:mt-20"
        >
          <ProcessStrip steps={t.hero.processSteps} />
        </motion.div>

        {/* Scroll hint — desktop only */}
        <motion.button
          type="button"
          onClick={(event) => scrollToSection(event, "exchange")}
          animate={reduced ? undefined : { y: [0, 6, 0] }}
          transition={reduced ? undefined : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          className="mt-10 hidden items-center gap-2 rounded-full px-3 py-2 text-faint transition-colors duration-200 hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg lg:inline-flex"
        >
          <span className="font-mono text-[10px] uppercase leading-none tracking-[0.2em]">{t.hero.scrollHint}</span>
          <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
        </motion.button>
      </Container>

      <GlowLine className="mt-12 sm:mt-14 lg:mt-10" />
    </Section>
  );
}
