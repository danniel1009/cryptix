"use client";

import { Card } from "@/components/ui/Card";
import { Reveal } from "@/components/ui/Reveal";
import { Eyebrow } from "@/components/ui/SectionHeading";
import { DEFAULT_EXCHANGE_SPREAD } from "@/config/exchange";
import { interpolate } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import { useMarket } from "@/providers/MarketProvider";

/**
 * Centred statement: "Our rate — MARKET PRICE + 5%" plus the confirmation
 * note. The spread comes from the live snapshot and falls back to the static
 * default, so the copy is right even before the first fetch.
 */
export function RateStatement({ className }: { className?: string }) {
  const { t, formatSpread } = useI18n();
  const { snapshot } = useMarket();
  const spread = formatSpread(snapshot?.spread ?? DEFAULT_EXCHANGE_SPREAD);

  return (
    <Reveal className={className}>
      <Card glow interactive padding="lg" className="mx-auto max-w-3xl text-center">
        <div className="flex justify-center">
          <Eyebrow as="span">{t.pairs.ourRate}</Eyebrow>
        </div>
        <p className="nums mt-6 font-mono text-2xl font-normal tracking-[-0.02em] text-fg sm:text-3xl lg:text-4xl">
          {interpolate(t.pairs.ourRateFormula, { spread })}
        </p>
        <p className="mx-auto mt-6 max-w-xl text-base text-muted sm:text-lg">{t.pairs.note}</p>
        <p className="mt-2 text-sm text-faint">{t.pairs.perPairNote}</p>
        <p className="mt-3 text-sm text-faint">{t.pairs.reverseNote}</p>
      </Card>
    </Reveal>
  );
}
