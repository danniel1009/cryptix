import "server-only";
import { epochToIso, fetchJson, normalizeBaseUrl, toPositiveNumber } from "@/lib/market/http";
import type { MarketDataProvider, MarketQuote, MarketSymbol, PairRequest } from "@/lib/market/types";

/**
 * IndodaxProvider — Indonesian Rupiah pairs from the Indodax public API.
 *
 * Primary endpoint (ONE call for every pair): GET {baseUrl}/summaries
 * Verified 2026-09-29:
 *   { tickers:   { usdt_idr: { last:"17980", server_time:1790646415, … }, btc_idr:{…}, … },
 *     prices_24h:{ usdtidr: 17870, btcidr: 1501125000, … },   ← price 24 h ago, NO underscore
 *     prices_7d: { … } }
 * Fallback per pair: GET {baseUrl}/ticker/usdtidr
 *   { ticker: { last:"17980", server_time:1790646406, … } }   (no 24 h reference → change null)
 *
 * No API key is needed for public market data.
 */

/** Bases listed on Indodax that we care about (all quoted in IDR). */
const IDR_BASES: ReadonlySet<MarketSymbol> = new Set<MarketSymbol>(["USDT", "BTC", "ETH", "SOL"]);

interface IndodaxTicker {
  last?: unknown;
  server_time?: unknown;
}

interface IndodaxSummaries {
  tickers?: Record<string, IndodaxTicker | undefined>;
  prices_24h?: Record<string, unknown>;
}

interface IndodaxTickerResponse {
  ticker?: IndodaxTicker;
}

export interface IndodaxProviderOptions {
  /** e.g. https://indodax.com/api */
  baseUrl: string;
  timeoutMs?: number;
  fetchJson?: typeof fetchJson;
  now?: () => number;
}

export class IndodaxProvider implements MarketDataProvider {
  readonly name = "indodax";
  private readonly baseUrl: string;
  private readonly timeoutMs: number | undefined;
  private readonly http: typeof fetchJson;
  private readonly now: () => number;

  constructor(options: IndodaxProviderOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.timeoutMs = options.timeoutMs;
    this.http = options.fetchJson ?? fetchJson;
    this.now = options.now ?? Date.now;
  }

  supports(base: MarketSymbol, quote: MarketSymbol): boolean {
    return quote === "IDR" && IDR_BASES.has(base);
  }

  async fetchQuotes(requests: PairRequest[], signal?: AbortSignal): Promise<MarketQuote[]> {
    const wanted = Array.from(
      new Set(requests.filter((r) => this.supports(r.base, r.quote)).map((r) => r.base)),
    );
    if (wanted.length === 0) return [];

    const quotes = new Map<MarketSymbol, MarketQuote>();
    let summariesError: unknown = null;

    try {
      const summaries = await this.http<IndodaxSummaries>(`${this.baseUrl}/summaries`, {
        timeoutMs: this.timeoutMs,
        signal,
      });
      for (const base of wanted) {
        const q = this.parseFromSummaries(summaries, base);
        if (q) quotes.set(base, q);
      }
    } catch (err) {
      summariesError = err;
    }

    // Anything the summaries call could not supply: try the per-pair ticker.
    const missing = wanted.filter((base) => !quotes.has(base));
    if (missing.length > 0) {
      const settled = await Promise.allSettled(
        missing.map(async (base) => {
          const body = await this.http<IndodaxTickerResponse>(
            `${this.baseUrl}/ticker/${this.marketId(base)}`,
            { timeoutMs: this.timeoutMs, signal },
          );
          return this.parseTicker(base, body?.ticker, null);
        }),
      );
      let firstError: unknown = summariesError;
      settled.forEach((result, i) => {
        if (result.status === "fulfilled") {
          if (result.value) quotes.set(missing[i], result.value);
        } else if (firstError === null) {
          firstError = result.reason;
        }
      });
      // Transport-level failure everywhere → reject so the composite records it.
      if (quotes.size === 0 && firstError !== null) throw firstError;
    }

    return wanted.map((base) => quotes.get(base)).filter((q): q is MarketQuote => Boolean(q));
  }

  /** "usdtidr" (ticker endpoint / prices_24h key). */
  private marketId(base: MarketSymbol): string {
    return `${base.toLowerCase()}idr`;
  }

  private parseFromSummaries(summaries: IndodaxSummaries | null | undefined, base: MarketSymbol): MarketQuote | null {
    if (!summaries || typeof summaries !== "object") return null;
    const ticker = summaries.tickers?.[`${base.toLowerCase()}_idr`];
    const price24hAgo = toPositiveNumber(summaries.prices_24h?.[this.marketId(base)]);
    return this.parseTicker(base, ticker, price24hAgo);
  }

  private parseTicker(
    base: MarketSymbol,
    ticker: IndodaxTicker | null | undefined,
    price24hAgo: number | null,
  ): MarketQuote | null {
    if (!ticker || typeof ticker !== "object") return null;
    const last = toPositiveNumber(ticker.last);
    if (last === null) return null;
    const change24hPct = price24hAgo !== null ? (last / price24hAgo - 1) * 100 : null;
    return {
      base,
      quote: "IDR",
      price: last,
      change24hPct: change24hPct !== null && Number.isFinite(change24hPct) ? change24hPct : null,
      updatedAt: epochToIso(ticker.server_time, this.now()),
      source: this.name,
    };
  }
}
