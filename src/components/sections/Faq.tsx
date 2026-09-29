"use client";

import { useMemo } from "react";
import { Accordion, type AccordionItem } from "@/components/ui/Accordion";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { DEFAULT_EXCHANGE_SPREAD } from "@/config/exchange";
import { interpolate } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import { useMarket } from "@/providers/MarketProvider";
import { FaqCta } from "./faq/FaqCta";
import { FaqJsonLd } from "./faq/FaqJsonLd";
import { FaqMoreHelp } from "./faq/FaqMoreHelp";

export const FAQ_SECTION_ID = "faq";
const HEADING_ID = "faq-heading";

/**
 * Frequently asked questions (`#faq`).
 *
 * Two columns on lg: a sticky left column with the heading and a short CTA
 * cluster (Request exchange → modal, Chat on WhatsApp), and the accordion on
 * the right with the 8 dictionary items. Stacks on mobile.
 *
 * `{spread}` in questions and answers is interpolated from the live snapshot's
 * spread (falling back to `DEFAULT_EXCHANGE_SPREAD`) so the copy always states
 * the configured figure. The spread is configuration, not a price, so it stays
 * valid regardless of the market status.
 *
 * The same interpolated items feed the FAQPage JSON-LD rendered in-section.
 */
export function Faq() {
  const { t, locale, formatSpread } = useI18n();
  const { snapshot } = useMarket();

  const spread = formatSpread(snapshot?.spread ?? DEFAULT_EXCHANGE_SPREAD);

  // Stable ids (index-based) so the open panel survives a locale switch.
  const items = useMemo(
    () =>
      t.faq.items.map((item, index) => ({
        id: `faq-${index}`,
        index: String(index + 1).padStart(2, "0"),
        question: interpolate(item.question, { spread }),
        answer: interpolate(item.answer, { spread }),
      })),
    [t, spread],
  );

  const accordionItems: AccordionItem[] = items.map((item) => ({
    id: item.id,
    title: (
      <span className="flex items-baseline gap-4">
        <span aria-hidden="true" className="font-mono text-xs tabular-nums text-faint">
          {item.index}
        </span>
        <span>{item.question}</span>
      </span>
    ),
    content: <p className="max-w-prose">{item.answer}</p>,
  }));

  return (
    <Section id={FAQ_SECTION_ID} aria-labelledby={HEADING_ID}>
      <FaqJsonLd items={items} locale={locale} />

      <Container>
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16 xl:gap-24">
          {/* Sticky heading + CTA cluster */}
          <div className="lg:col-span-5 lg:sticky lg:top-28 lg:self-start">
            <Reveal>
              <SectionHeading
                id={HEADING_ID}
                eyebrow={t.faq.eyebrow}
                title={t.faq.title}
                description={t.faq.description}
                titleClassName="font-normal tracking-[-0.02em] leading-[1.1] lg:text-[2.75rem]"
              />
              <FaqCta className="mt-8 sm:mt-10" />
            </Reveal>
          </div>

          {/* Questions */}
          <div className="lg:col-span-7">
            <Reveal delay={0.1}>
              <Accordion items={accordionItems} defaultOpen={[accordionItems[0].id]} />
              <FaqMoreHelp className="mt-8" />
            </Reveal>
          </div>
        </div>
      </Container>
    </Section>
  );
}
