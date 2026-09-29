/**
 * `t.market` — the LIVE MARKET table/cards (section `#market`): status
 * badges (tiny mono labels, uppercase), column headers, and the unavailable
 * / stale / polling / offline notices. Placeholders: `{time}` formatted or
 * relative time, `{sources}` comma-joined provider names.
 *
 * Consumed by: LiveMarket section, LiveIndicator, MarketProvider-driven
 * status banners.
 */
export const market = {
  eyebrow: "Market",
  title: "Live market",
  description:
    "Latest available market prices from our data providers. Reference only — our exchange rate is shown in the rate checker.",
  live: "LIVE",
  reconnecting: "RECONNECTING",
  unavailable: "UNAVAILABLE",
  stale: "STALE",
  columns: {
    pair: "Pair",
    price: "Price",
    change24h: "24h change",
    updated: "Updated",
    status: "Status",
  },
  lastUpdated: "Last updated: {time}",
  updatedAgo: "Last updated {time}",
  unavailableTitle: "Market data temporarily unavailable",
  unavailableBody:
    "We could not reach our market data providers. Prices will reappear automatically as soon as the feed recovers.",
  staleBody: "Prices may be outdated. Displayed values are not being refreshed in real time.",
  sourceNote: "Data source: {sources}",
  refresh: "Refresh",
  pollingNote: "Live stream unavailable — refreshing periodically.",
  offlineNote: "You appear to be offline.",
  devMock: "Development mock data",
};
