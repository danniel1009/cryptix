"use client";

import { Mail } from "lucide-react";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { WhatsAppGlyph } from "@/components/layout/WhatsAppFloat";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";
import { DEFAULT_EXCHANGE_SPREAD } from "@/config/exchange";
import { siteConfig } from "@/config/site";
import { useSmoothScrollTo } from "@/hooks/useSmoothScrollTo";
import { interpolate } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import { buildGeneralInquiryMessage, buildWhatsAppUrl, isWhatsAppConfigured } from "@/lib/whatsapp";
import { useMarket } from "@/providers/MarketProvider";

const COLUMN_TITLE = "font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-faint";
const LINK =
  "inline-flex min-h-11 items-center gap-2.5 text-sm text-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:text-accent sm:min-h-0";

/**
 * Site footer: brand + tagline · navigation · contact · language, then the
 * full indicative-pricing disclaimer and a copyright bar.
 */
export function Footer() {
  const { t, locale, formatSpread } = useI18n();
  const { snapshot } = useMarket();
  const scrollTo = useSmoothScrollTo();

  const spread = formatSpread(snapshot?.spread ?? DEFAULT_EXCHANGE_SPREAD);
  const whatsappHref = isWhatsAppConfigured()
    ? buildWhatsAppUrl(buildGeneralInquiryMessage(locale))
    : null;
  const email = siteConfig.contactEmail;
  const vars = { spread, brand: siteConfig.name, year: siteConfig.copyrightYear };

  return (
    <footer className="relative border-t border-line bg-surface/40">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent"
      />
      <Container>
        <div className="grid gap-12 py-16 sm:py-20 lg:grid-cols-12 lg:gap-8">
          {/* Brand */}
          <div className="lg:col-span-5">
            <Logo size={34} withWordmark />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted">{t.footer.tagline}</p>
            <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-accent/80">
              {interpolate(t.common.ourRateFormula, vars)}
            </p>
          </div>

          {/* Navigation */}
          <nav aria-label={t.footer.navigationTitle} className="lg:col-span-2">
            <h3 className={COLUMN_TITLE}>{t.footer.navigationTitle}</h3>
            <ul role="list" className="mt-5 space-y-3">
              {siteConfig.nav.map((item) => (
                <li key={item.id}>
                  <a
                    href={item.href}
                    onClick={(event) => {
                      event.preventDefault();
                      scrollTo(item.id);
                    }}
                    className={LINK}
                  >
                    {t.nav[item.id]}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact */}
          <div className="lg:col-span-3">
            <h3 className={COLUMN_TITLE}>{t.footer.contactTitle}</h3>
            <ul role="list" className="mt-5 space-y-3">
              {whatsappHref ? (
                <li>
                  <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={LINK}>
                    <WhatsAppGlyph className="h-4 w-4 text-whatsapp" />
                    {t.footer.whatsapp}
                  </a>
                </li>
              ) : null}
              {email ? (
                <li>
                  <a href={`mailto:${email}`} className={LINK}>
                    <Mail aria-hidden="true" className="h-4 w-4 text-accent" />
                    <span className="break-all">{email}</span>
                  </a>
                </li>
              ) : null}
              {!whatsappHref && !email ? (
                <li>
                  <a
                    href="#contact"
                    onClick={(event) => {
                      event.preventDefault();
                      scrollTo("contact");
                    }}
                    className={LINK}
                  >
                    {t.nav.contact}
                  </a>
                </li>
              ) : null}
            </ul>
          </div>

          {/* Language */}
          <div className="lg:col-span-2">
            <h3 className={COLUMN_TITLE}>{t.footer.languageTitle}</h3>
            <div className="mt-5">
              <LanguageSwitcher variant="footer" />
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="border-t border-line py-8">
          <h3 className={COLUMN_TITLE}>{t.footer.disclaimerTitle}</h3>
          <p className="mt-3 max-w-4xl text-xs leading-relaxed text-faint">
            {interpolate(t.disclaimer.full, vars)}
          </p>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col gap-3 border-t border-line pt-6 pb-24 text-xs text-faint sm:flex-row sm:items-center sm:justify-between sm:pb-6 sm:pr-24">
          <p>{interpolate(t.footer.copyright, vars)}</p>
          <p className="sm:text-right">{t.disclaimer.short}</p>
        </div>
      </Container>
    </footer>
  );
}
