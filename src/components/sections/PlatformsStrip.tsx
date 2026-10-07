"use client";

import { SETTLEMENT_PLATFORMS } from "@/config/platforms";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { interpolate } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";

/**
 * "Settled through established platforms" — a compact, factual logo strip.
 * Logos render monochrome (white silhouette) and take their brand colours on
 * hover; the note below makes the non-affiliation explicit.
 */
export function PlatformsStrip() {
  const { t } = useI18n();
  return (
    <section id="platforms" aria-labelledby="platforms-title" className="w-full border-t border-line bg-surface/30 py-14 sm:py-16">
      <Container>
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <h2 id="platforms-title" className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
              {t.platforms.title}
            </h2>
            <p className="mt-3 text-sm text-muted sm:text-base">{t.platforms.description}</p>
          </div>

          <ul role="list" className="mx-auto mt-10 flex max-w-4xl flex-wrap items-center justify-center gap-x-10 gap-y-8 sm:gap-x-16">
            {SETTLEMENT_PLATFORMS.map((p) => (
              <li key={p.id} className="flex flex-col items-center gap-2">
                <a
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  aria-label={interpolate(t.platforms.visit, { name: p.name })}
                  className="group flex h-12 items-center rounded-lg px-2 outline-none transition focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- small static brand assets; no optimisation needed */}
                  <img
                    src={p.logo}
                    alt={p.name}
                    width={p.width}
                    height={p.height}
                    loading="lazy"
                    decoding="async"
                    className="h-7 w-auto max-w-[180px] opacity-75 transition duration-300 [filter:brightness(0)_invert(1)] group-hover:opacity-100 group-hover:[filter:none] sm:h-8"
                  />
                </a>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">{t.platforms.roles[p.role]}</span>
              </li>
            ))}
          </ul>

          <p className="mx-auto mt-10 max-w-3xl text-center text-xs leading-relaxed text-faint">{t.platforms.note}</p>
        </Reveal>
      </Container>
    </section>
  );
}
