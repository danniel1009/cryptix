"use client";

import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { useI18n } from "@/lib/i18n/provider";
import { SecurityGrid } from "./security/SecurityGrid";
import { SecurityNote } from "./security/SecurityNote";

const HEADING_ID = "security-heading";

/** docs/DESIGN.md section title: sentence case, weight 400, tight tracking. */
const TITLE_CLASSES = "font-normal tracking-[-0.02em] leading-[1.1] lg:text-[2.75rem]";

/**
 * Built with security in mind (`#security`, nav target). A full-bleed ruled
 * grid of the six factual items from `t.security.items`, then a quiet note
 * stating that no funds are held here and every exchange is confirmed by the
 * team. Copy is dictionary-only: no regulatory, licensing or absolute claims.
 */
export function Security() {
  const { t } = useI18n();

  return (
    <Section id="security" tone="bordered" aria-labelledby={HEADING_ID}>
      <Container>
        <Reveal>
          <SectionHeading
            id={HEADING_ID}
            align="center"
            eyebrow={t.security.eyebrow}
            title={t.security.title}
            description={t.security.description}
            titleClassName={TITLE_CLASSES}
          />
        </Reveal>
      </Container>

      <SecurityGrid className="mt-14 sm:mt-16" />

      <Container>
        <SecurityNote className="mt-10 sm:mt-12" />
      </Container>
    </Section>
  );
}
