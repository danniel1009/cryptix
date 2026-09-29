import "server-only";
import {
  MarketHttpError,
  epochToIso,
  fetchJson,
  normalizeBaseUrl,
  toFiniteNumber,
  toPositiveNumber,
} from "@/lib/market/http";
import type { MarketDataProvider, MarketQuote, MarketSymbol, PairRequest } from "@/lib/market/types";
import { pairKey } from "@/lib/market/types";

/**
 * ExchangeProvider — a Binance-compatible public spot REST API.
 *
 * Endpoint: GET {baseUrl}/api/v3/ticker/24hr?symbols=["BTCUSDT",…]
 * Verified 2026-09-29 against https://data-api.binance.vision:
 *   [{ symbol:"BTCUSDT", lastPrice:"83068.01", priceChangePercent:"-0.906",
 *      closeTime:1790646400012, … }, …]
 * A batch containing ONE unknown symbol fails entirely with HTTP 400
 * {"code":-1121,"msg":"Invalid symbol."} — hence the per-symbol fallback.
 *
 * Optional API key is sent as `X-MBX-APIKEY` only when configured.
 */

/** Static capability: the symbols that exist on the default (Binance) API. */
const SYMBOLS: ReadonlyMap<string, string> = new Map<string, string>([
  [pairKey("BTC", "USDT"), "BTCUSDT"],
  [pairKey("ETH", "USDT"), "ETHUSDT"],
  [pairKey("SOL", "USDT"), "SOLUSDT"],
  [pairKey("ETH", "BTC"), "ETHBTC"],
  [pairKey("SOL", "BTC"), "SOLBTC"],
  // Verified present on data-api.binance.vision (BTCUSD, ETHUSD, SOLUSD, USDTUSD).
  [pairKey("BTC", "USD"), "BTCUSD"],
  [pairKey("ETH", "USD"), "ETHUSD"],
  [pairKey("SOL", "USD"), "SOLUSD"],
  [pairKey("USDT", "USD"), "USDTUSD"],
]);

const SYMBOL_TO_PAIR: ReadonlyMap<string, PairRequest> = new Map(
  Array.from(SYMBOLS.entries()).map(([key, symbol]) => {
    const [base, quote] = key.split("/") as [MarketSymbol, MarketSymbol];
    return [symbol, { base, quote }];
  }),
);

interface Ticker24h {
  symbol?: unknown;
  lastPrice?: unknown;
  priceChangePercent?: unknown;
  closeTime?: unknown;
}

export interface ExchangeProviderOptions {
  /** e.g. https://data-api.binance.vision */
  baseUrl: string;
  /** Optional, sent as X-MBX-APIKEY. */
  apiKey?: string;
  timeoutMs?: number;
  /** Injectable for tests. */
  fetchJson?: typeof fetchJson;
  /** Injectable clock for tests. */
  now?: () => number;
}

export class ExchangeProvider implements MarketDataProvider {
  readonly name: string;
  private readonly baseUrl: string;
  private readonly headers: Record<string, string> | undefined;
  private readonly timeoutMs: number | undefined;
  private readonly http: typeof fetchJson;
  private readonly now: () => number;

  constructor(options: ExchangeProviderOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    // Name the source after the actual exchange when recognisable, so the UI
    // can say "binance" instead of the generic "exchange".
    this.name = /binance/i.test(this.baseUrl) ? "binance" : "exchange";
    this.headers = options.apiKey ? { "X-MBX-APIKEY": options.apiKey } : undefined;
    this.timeoutMs = options.timeoutMs;
    this.http = options.fetchJson ?? fetchJson;
    this.now = options.now ?? Date.now;
  }

  supports(base: MarketSymbol, quote: MarketSymbol): boolean {
    return SYMBOLS.has(pairKey(base, quote));
  }

  async fetchQuotes(requests: PairRequest[], signal?: AbortSignal): Promise<MarketQuote[]> {
    const symbols = Array.from(
      new Set(
        requests
          .filter((r) => this.supports(r.base, r.quote))
          .map((r) => SYMBOLS.get(pairKey(r.base, r.quote)) as string),
      ),
    );
    if (symbols.length === 0) return [];

    let tickers: unknown;
    try {
      tickers = await this.http<unknown>(this.batchUrl(symbols), {
        headers: this.headers,
        timeoutMs: this.timeoutMs,
        signal,
      });
    } catch (err) {
      // A compatible API that lacks one of the symbols rejects the whole batch
      // (HTTP 400). Retry each symbol on its own and keep what answers.
      if (err instanceof MarketHttpError && err.kind === "http" && err.status === 400) {
        tickers = await this.fetchIndividually(symbols, signal);
      } else {
        throw err;
      }
    }

    return this.parse(tickers);
  }

  private batchUrl(symbols: string[]): string {
    return `${this.baseUrl}/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;
  }

  private async fetchIndividually(symbols: string[], signal?: AbortSignal): Promise<unknown[]> {
    const settled = await Promise.allSettled(
      symbols.map((symbol) =>
        this.http<unknown>(`${this.baseUrl}/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`, {
          headers: this.headers,
          timeoutMs: this.timeoutMs,
          signal,
        }),
      ),
    );
    const results = settled.filter((s): s is PromiseFulfilledResult<unknown> => s.status === "fulfilled");
    if (results.length === 0) {
      const first = settled.find((s): s is PromiseRejectedResult => s.status === "rejected");
      throw first?.reason ?? new Error("Exchange API returned no tickers");
    }
    return results.map((r) => r.value);
  }

  /** Defensive parse: unknown symbols, non-numeric prices and junk rows are skipped. */
  private parse(body: unknown): MarketQuote[] {
    const rows: unknown[] = Array.isArray(body) ? body : body && typeof body === "object" ? [body] : [];
    const quotes: MarketQuote[] = [];
    const now = this.now();
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const t = row as Ticker24h;
      if (typeof t.symbol !== "string") continue;
      const pair = SYMBOL_TO_PAIR.get(t.symbol);
      if (!pair) continue;
      const price = toPositiveNumber(t.lastPrice);
      if (price === null) continue;
      quotes.push({
        base: pair.base,
        quote: pair.quote,
        price,
        change24hPct: toFiniteNumber(t.priceChangePercent),
        updatedAt: epochToIso(t.closeTime, now),
        source: this.name,
      });
    }
    return quotes;
  }
}
