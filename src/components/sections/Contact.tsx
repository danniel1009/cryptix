"use client";

import { Container } from "@/components/ui/Container";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { useI18n } from "@/lib/i18n/provider";
import { ContactForm } from "./contact/ContactForm";
import { DirectContact } from "./contact/DirectContact";

const HEADING_ID = "contact-heading";

/**
 * Contact our team (`#contact`, nav target). Two columns on lg: the direct
 * channels (WhatsApp / email) on the left, the message form on the right;
 * stacked on mobile with the compact channel card first.
 */
export function Contact() {
  const { t } = useI18n();

  return (
    <Section id="contact" tone="raised" aria-labelledby={HEADING_ID} className="isolate">
      {/* Faint emerald wash behind the form column — the only glow in this section. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_45%_at_72%_20%,rgba(34,229,138,0.07),transparent_70%)]"
      />
      <Container>
        <Reveal>
          <SectionHeading
            id={HEADING_ID}
            eyebrow={t.contact.eyebrow}
            title={t.contact.title}
            description={t.contact.description}
            titleClassName="font-normal tracking-[-0.02em] leading-[1.1] lg:text-[2.75rem]"
          />
        </Reveal>

        <RevealGroup className="mt-12 grid gap-6 sm:mt-16 lg:grid-cols-12 lg:gap-8">
          <RevealItem className="lg:col-span-5">
            <DirectContact />
          </RevealItem>
          <RevealItem className="lg:col-span-7">
            <ContactForm />
          </RevealItem>
        </RevealGroup>
      </Container>
    </Section>
  );
}
