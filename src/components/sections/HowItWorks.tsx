"use client";

import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { useI18n } from "@/lib/i18n/provider";
import { ProcessSteps } from "./how-it-works/ProcessSteps";

const HEADING_ID = "how-it-works-heading";

/** docs/DESIGN.md section title: sentence case, weight 400, tight tracking. */
const TITLE_CLASSES = "font-normal tracking-[-0.02em] leading-[1.1] lg:text-[2.75rem]";

/**
 * How it works (`#how-it-works`, nav target). Heading, the four-step process
 * (Check rate → Request exchange → Contact our team → Manual exchange) and the
 * footnote that nothing on the site executes an exchange on its own.
 */
export function HowItWorks() {
  const { t } = useI18n();

  return (
    <Section id="how-it-works" aria-labelledby={HEADING_ID}>
      <Container>
        <Reveal>
          <SectionHeading
            id={HEADING_ID}
            eyebrow={t.howItWorks.eyebrow}
            title={t.howItWorks.title}
            description={t.howItWorks.description}
            titleClassName={TITLE_CLASSES}
          />
        </Reveal>

        <ProcessSteps steps={t.howItWorks.steps} className="mt-14 sm:mt-16 lg:mt-20" />

        <Reveal delay={0.1}>
          <p className="mt-10 max-w-2xl text-xs leading-relaxed text-faint sm:text-[13px] lg:mt-12">
            {t.howItWorks.footnote}
          </p>
        </Reveal>
      </Container>
    </Section>
  );
}
