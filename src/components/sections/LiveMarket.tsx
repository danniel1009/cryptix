"use client";

import { useMemo } from "react";
import { MarketCards } from "@/components/sections/live-market/MarketCards";
import { MarketStatusBanner } from "@/components/sections/live-market/MarketStatusBanner";
import { MarketStatusCluster } from "@/components/sections/live-market/MarketStatusCluster";
import { MarketTable } from "@/components/sections/live-market/MarketTable";
import { buildMarketRows, deriveMarketView } from "@/components/sections/live-market/rows";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { interpolate } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/provider";
import { useMarket } from "@/providers/MarketProvider";

const HEADING_ID = "market-heading";

/**
 * LIVE MARKET (`#market`) — the reference's "Assets" table, redesigned as a
 * live market reference board: MARKET_DISPLAY_PAIRS resolved through the
 * market feed, a headline status cluster, notices for degraded states, a
 * table on lg+ and stacked cards below. Reference only: our exchange rate
 * lives in the rate checker, and nothing here implies execution.
 */
export function LiveMarket() {
  const { t } = useI18n();
  const { snapshot, connection, status, lastUpdatedAt, refresh, getQuote } = useMarket();

  const view = deriveMarketView(snapshot !== null, status, connection);
  const rows = useMemo(() => buildMarketRows(getQuote), [getQuote]);
  const sources = snapshot?.sources ?? [];
  const isMock = sources.includes("mock");

  return (
    <Section id="market" tone="bordered" aria-labelledby={HEADING_ID}>
      <Container>
        <Reveal>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
            <SectionHeading
              id={HEADING_ID}
              eyebrow={t.market.eyebrow}
              title={t.market.title}
              description={t.market.description}
              titleClassName="font-normal tracking-[-0.02em] leading-[1.1] lg:text-[2.75rem]"
            />
            <MarketStatusCluster
              view={view}
              connection={connection}
              lastUpdatedAt={lastUpdatedAt}
              onRefresh={refresh}
              className="shrink-0 lg:justify-end lg:pb-1.5"
            />
          </div>
        </Reveal>

        <Reveal delay={0.08} className="mt-10 flex flex-col gap-4 sm:mt-12">
          <MarketStatusBanner view={view} connection={connection} isMock={isMock} onRetry={refresh} />

          <MarketTable rows={rows} view={view} className="hidden lg:block" />
          <MarketCards rows={rows} view={view} className="lg:hidden" />

          <div className="flex flex-col gap-2 px-1 text-xs text-faint sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            {sources.length > 0 ? (
              <p className="font-mono">{interpolate(t.market.sourceNote, { sources: sources.join(", ") })}</p>
            ) : (
              <span />
            )}
            <p className="sm:text-right">{t.disclaimer.short}</p>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
