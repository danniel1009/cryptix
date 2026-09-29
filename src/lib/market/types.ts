import type { CurrencyCode, PairId } from "@/config/exchange";

/**
 * Market data domain types shared by providers, the rate engine, API routes
 * and the client.
 */

/** Currencies a provider may quote. USD exists only as a bridge for cross rates. */
export type MarketSymbol = CurrencyCode | "USD";

export interface PairRequest {
  base: MarketSymbol;
  quote: MarketSymbol;
}

/** One market price: 1 `base` = `price` `quote`. */
export interface MarketQuote {
  base: MarketSymbol;
  quote: MarketSymbol;
  price: number;
  /** 24h change in percent (e.g. 2.41 for +2.41 %), null when the provider has none. */
  change24hPct: number | null;
  /** ISO timestamp of when this price was observed. */
  updatedAt: string;
  /** Provider name, e.g. "binance", "indodax", "coingecko", "tronscan", "mock". */
  source: string;
}

export type MarketStatus = "live" | "stale" | "unavailable";

/**
 * Indicative exchange rate for one supported pair.
 * Convention: `marketRate` and `ourRate` are units of `to` per 1 `from`, so
 * `receive = amount * ourRate`. The *Display fields express the same rates in
 * the pair's conventional quoting direction (see ExchangePair.quoteBase).
 */
export interface IndicativeRate {
  pairId: PairId;
  from: CurrencyCode;
  to: CurrencyCode;
  /** `to` per 1 `from` at market. */
  marketRate: number;
  /** `to` per 1 `from` after applying the spread (what the customer receives). */
  ourRate: number;
  /** Spread applied, e.g. 0.05. */
  spread: number;
  /** The "1 unit" currency used for display. */
  quoteBase: CurrencyCode;
  /** The other currency of the display quote. */
  quoteCurrency: CurrencyCode;
  /** Market price of 1 quoteBase in quoteCurrency. */
  marketPriceDisplay: number;
  /** Our price of 1 quoteBase in quoteCurrency (spread applied in the customer's disfavour). */
  ourPriceDisplay: number;
  /** 24h change of the display quote in percent, if known. */
  change24hPct: number | null;
  /** True when the rate was derived through a bridge (e.g. ETH/USD ÷ BTC/USD). */
  derived: boolean;
  /** Providers that contributed. */
  sources: string[];
  updatedAt: string;
}

export interface MarketSnapshot {
  status: MarketStatus;
  /** When this snapshot object was produced. */
  generatedAt: string;
  /** Last time any provider answered successfully; null if never. */
  updatedAt: string | null;
  /** Effective exchange spread (from server config). */
  spread: number;
  quotes: MarketQuote[];
  rates: IndicativeRate[];
  /** Distinct provider names that contributed to `quotes`. */
  sources: string[];
  /** Human-readable last error (never contains secrets), null when healthy. */
  error: string | null;
}

/**
 * Provider abstraction. Implementations must be side-effect free apart from
 * network calls and must NEVER throw for unsupported pairs — they simply omit
 * them from the result so the next provider in the chain can try.
 */
export interface MarketDataProvider {
  readonly name: string;
  /** Whether this provider can quote the pair at all (static capability). */
  supports(base: MarketSymbol, quote: MarketSymbol): boolean;
  /**
   * Fetch quotes for the requested pairs. May return a subset (missing = try
   * next provider). Should reject only on transport-level failure.
   */
  fetchQuotes(requests: PairRequest[], signal?: AbortSignal): Promise<MarketQuote[]>;
}

export function pairKey(base: MarketSymbol, quote: MarketSymbol): string {
  return `${base}/${quote}`;
}
