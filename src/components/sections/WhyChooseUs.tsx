"use client";

import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { useI18n } from "@/lib/i18n/provider";
import { FeatureGrid } from "./why-choose-us/FeatureGrid";
import { Statement } from "./why-choose-us/Statement";

const HEADING_ID = "why-heading";

/** docs/DESIGN.md section title: sentence case, weight 400, tight tracking. */
const TITLE_CLASSES = "font-normal tracking-[-0.02em] leading-[1.1] lg:text-[2.75rem]";

/**
 * Why choose us (`#why`, raised tone). The big centred statement first, then
 * the section heading and a full-bleed ruled grid of the four value
 * propositions from `t.whyChooseUs.items`.
 */
export function WhyChooseUs() {
  const { t } = useI18n();

  return (
    <Section id="why" tone="raised" aria-labelledby={HEADING_ID}>
      <Container>
        <Statement>{t.whyChooseUs.statement}</Statement>

        <Reveal className="mt-20 sm:mt-28 lg:mt-32">
          <SectionHeading
            id={HEADING_ID}
            eyebrow={t.whyChooseUs.eyebrow}
            title={t.whyChooseUs.title}
            description={t.whyChooseUs.description}
            titleClassName={TITLE_CLASSES}
          />
        </Reveal>
      </Container>

      <FeatureGrid items={t.whyChooseUs.items} className="mt-12 sm:mt-14 lg:mt-16" />
    </Section>
  );
}
