import "server-only";
import { epochToIso, fetchJson, normalizeBaseUrl, toFiniteNumber, toPositiveNumber } from "@/lib/market/http";
import type { MarketDataProvider, MarketQuote, MarketSymbol, PairRequest } from "@/lib/market/types";

/**
 * CoinGeckoProvider — fallback for X/USD, X/BTC and X/IDR.
 *
 * Endpoint: GET {baseUrl}/simple/price?ids=bitcoin,…&vs_currencies=usd,btc,idr
 *           &include_24hr_change=true&include_last_updated_at=true
 * Verified 2026-09-29:
 *   { bitcoin: { usd:82923, usd_24h_change:-1.08, btc:0.9997, idr:1492622760,
 *                idr_24h_change:-0.78, last_updated_at:1790646340 }, tether:{…}, … }
 * `usdt` is NOT a supported vs_currency (checked /simple/supported_vs_currencies),
 * so X/USDT pairs are honestly reported as unsupported.
 *
 * Optional key header: `x-cg-demo-api-key` (public API) or `x-cg-pro-api-key`
 * when the configured host contains "pro-api". Sent only when configured.
 */

const COIN_IDS: Partial<Record<MarketSymbol, string>> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  USDT: "tether",
};

const VS_CURRENCIES: Partial<Record<MarketSymbol, string>> = {
  USD: "usd",
  BTC: "btc",
  IDR: "idr",
};

type SimplePriceResponse = Record<string, Record<string, unknown> | undefined>;

export interface CoinGeckoProviderOptions {
  /** e.g. https://api.coingecko.com/api/v3 or https://pro-api.coingecko.com/api/v3 */
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
  fetchJson?: typeof fetchJson;
  now?: () => number;
}

export class CoinGeckoProvider implements MarketDataProvider {
  readonly name = "coingecko";
  private readonly baseUrl: string;
  private readonly headers: Record<string, string> | undefined;
  private readonly timeoutMs: number | undefined;
  private readonly http: typeof fetchJson;
  private readonly now: () => number;

  constructor(options: CoinGeckoProviderOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    if (options.apiKey) {
      const headerName = /pro-api/i.test(this.baseUrl) ? "x-cg-pro-api-key" : "x-cg-demo-api-key";
      this.headers = { [headerName]: options.apiKey };
    }
    this.timeoutMs = options.timeoutMs;
    this.http = options.fetchJson ?? fetchJson;
    this.now = options.now ?? Date.now;
  }

  supports(base: MarketSymbol, quote: MarketSymbol): boolean {
    return base !== quote && Boolean(COIN_IDS[base]) && Boolean(VS_CURRENCIES[quote]);
  }

  async fetchQuotes(requests: PairRequest[], signal?: AbortSignal): Promise<MarketQuote[]> {
    const wanted = requests.filter((r) => this.supports(r.base, r.quote));
    if (wanted.length === 0) return [];

    const ids = Array.from(new Set(wanted.map((r) => COIN_IDS[r.base] as string)));
    const vs = Array.from(new Set(wanted.map((r) => VS_CURRENCIES[r.quote] as string)));
    const url =
      `${this.baseUrl}/simple/price?ids=${encodeURIComponent(ids.join(","))}` +
      `&vs_currencies=${encodeURIComponent(vs.join(","))}` +
      `&include_24hr_change=true&include_last_updated_at=true`;

    const body = await this.http<SimplePriceResponse>(url, {
      headers: this.headers,
      timeoutMs: this.timeoutMs,
      signal,
    });
    if (!body || typeof body !== "object") return [];

    const now = this.now();
    const quotes: MarketQuote[] = [];
    const seen = new Set<string>();
    for (const r of wanted) {
      const key = `${r.base}/${r.quote}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const coin = body[COIN_IDS[r.base] as string];
      if (!coin || typeof coin !== "object") continue;
      const vsKey = VS_CURRENCIES[r.quote] as string;
      const price = toPositiveNumber(coin[vsKey]);
      if (price === null) continue;
      quotes.push({
        base: r.base,
        quote: r.quote,
        price,
        change24hPct: toFiniteNumber(coin[`${vsKey}_24h_change`]),
        updatedAt: epochToIso(coin.last_updated_at, now),
        source: this.name,
      });
    }
    return quotes;
  }
}
