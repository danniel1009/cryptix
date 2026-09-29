import "server-only";
import type { MarketProviderName, ServerConfig } from "@/config/server";
import type { MarketDataProvider } from "@/lib/market/types";
import { CoinGeckoProvider } from "@/lib/market/providers/coingecko";
import { CompositeProvider, type CompositeProviderOptions } from "@/lib/market/providers/composite";
import { ExchangeProvider } from "@/lib/market/providers/exchange";
import { IndodaxProvider } from "@/lib/market/providers/indodax";
import { MockProvider } from "@/lib/market/providers/mock";
import { TronScanProvider } from "@/lib/market/providers/tronscan";

/**
 * Wires the provider chain from server configuration.
 *
 *   MARKET_PROVIDERS="exchange,indodax,coingecko,tronscan"   (order = priority)
 *
 * - Unknown names are ignored by the config parser; duplicates are dropped here.
 * - "mock" is honoured ONLY when `market.allowMock` is true (non-production, or
 *   ALLOW_MOCK_MARKET_DATA=true). When allowed it is always appended LAST so it
 *   can only fill pairs no real provider could supply.
 * - "tronscan" is instantiated even without a key; it then supports nothing.
 */

/** Structural subset of `serverConfig` this module needs (so tests can pass a literal). */
export type ProviderChainConfig = Pick<ServerConfig, "market">;

export function createProvider(name: MarketProviderName, market: ServerConfig["market"]): MarketDataProvider | null {
  switch (name) {
    case "exchange":
      return new ExchangeProvider({ baseUrl: market.exchangeApiUrl, apiKey: market.marketDataApiKey });
    case "indodax":
      return new IndodaxProvider({ baseUrl: market.indodaxApiUrl });
    case "coingecko":
      return new CoinGeckoProvider({ baseUrl: market.coingeckoApiUrl, apiKey: market.coingeckoApiKey });
    case "tronscan":
      return new TronScanProvider({ baseUrl: market.tronscanApiUrl, apiKey: market.tronscanApiKey });
    case "mock":
      return market.allowMock ? new MockProvider() : null;
    default:
      return null;
  }
}

export function buildProviderChain(
  config: ProviderChainConfig,
  options: CompositeProviderOptions = {},
): CompositeProvider {
  const { market } = config;
  const chain: MarketDataProvider[] = [];
  const seen = new Set<MarketProviderName>();

  for (const name of market.providers) {
    if (seen.has(name) || name === "mock") continue;
    seen.add(name);
    const provider = createProvider(name, market);
    if (provider) chain.push(provider);
  }

  if (market.allowMock) chain.push(new MockProvider());

  return new CompositeProvider(chain, options);
}
