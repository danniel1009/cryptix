"use client";

import { useCallback } from "react";
import { Container } from "@/components/ui/Container";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { FEATURED_PAIRS, type PairId } from "@/config/exchange";
import { useSmoothScrollTo } from "@/hooks/useSmoothScrollTo";
import { useI18n } from "@/lib/i18n/provider";
import { useMarket } from "@/providers/MarketProvider";
import { PairCard } from "./supported-pairs/PairCard";
import { PairsMarketNote } from "./supported-pairs/PairsMarketNote";
import { RateStatement } from "./supported-pairs/RateStatement";
import { dispatchSelectPair } from "./supported-pairs/selectPairEvent";

const HEADING_ID = "pairs-heading";

/** docs/DESIGN.md section title: sentence case, weight 400, tight tracking. */
const TITLE_CLASSES = "font-normal tracking-[-0.02em] leading-[1.1] lg:text-[2.75rem]";

/**
 * Supported exchange pairs (`#pairs`). Renders exactly `FEATURED_PAIRS` (the four customer-facing pairs; the reverse directions exist in the converter)
 * (the only four pairs offered) with their live indicative line, a "Check
 * rate" button that hands the pair to the RateChecker, and the centred
 * "Market price + spread" statement.
 */
export function SupportedPairs() {
  const { t } = useI18n();
  const { getRate, status } = useMarket();
  const scrollTo = useSmoothScrollTo();

  const onCheckRate = useCallback(
    (pairId: PairId) => {
      dispatchSelectPair(pairId);
      scrollTo("exchange");
    },
    [scrollTo],
  );

  return (
    <Section id="pairs" aria-labelledby={HEADING_ID}>
      <Container>
        <Reveal>
          <SectionHeading
            id={HEADING_ID}
            align="center"
            eyebrow={t.pairs.eyebrow}
            title={t.pairs.title}
            description={t.pairs.description}
            titleClassName={TITLE_CLASSES}
          />
        </Reveal>

        <PairsMarketNote className="mt-6 flex justify-center" />

        <RevealGroup
          as="ul"
          role="list"
          className="mt-12 grid grid-cols-1 gap-4 sm:mt-14 sm:grid-cols-2 lg:gap-5 xl:grid-cols-4"
        >
          {FEATURED_PAIRS.map((pair) => (
            <RevealItem key={pair.id} as="li" className="flex">
              <PairCard pair={pair} rate={getRate(pair.id)} status={status} onCheckRate={onCheckRate} />
            </RevealItem>
          ))}
        </RevealGroup>

        <RateStatement className="mt-14 sm:mt-16" />
      </Container>
    </Section>
  );
}
