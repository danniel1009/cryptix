import "server-only";
import { MarketHttpError, fetchJson, normalizeBaseUrl, safeUrl, toFiniteNumber, toPositiveNumber } from "@/lib/market/http";
import type { MarketDataProvider, MarketQuote, MarketSymbol, PairRequest } from "@/lib/market/types";

/**
 * TronScanProvider — USDT (TRC20) token market info → USDT/USD ONLY.
 *
 * Endpoint: GET {baseUrl}/token_trc20?contract=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t&showAll=1
 * Documented shape (docs.tronscan.org):
 *   { total:1, trc20_tokens:[{ symbol:"USDT", contract_address:"TR7…",
 *       market_info:{ priceInUsd:0.9997, priceInTrx:…, gain:"-0.0002", … } }] }
 * The unauthenticated endpoint is IP rate-limited (3 rps, then suspended) and
 * answers { Error:"request rate exceeded…" } with HTTP 200 — handled as an error.
 *
 * The provider is only ENABLED when an API key is configured (header
 * `TRON-PRO-API-KEY`). Without a key `supports()` is false and `fetchQuotes()`
 * resolves to [] — it never throws.
 */

export const USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

interface TronScanTokenResponse {
  Error?: unknown;
  trc20_tokens?: unknown;
}

interface TronScanToken {
  symbol?: unknown;
  contract_address?: unknown;
  market_info?: { priceInUsd?: unknown; gain?: unknown } | null;
}

export interface TronScanProviderOptions {
  /** e.g. https://apilist.tronscanapi.com/api */
  baseUrl: string;
  /** Required for the provider to be enabled. */
  apiKey?: string;
  timeoutMs?: number;
  fetchJson?: typeof fetchJson;
  now?: () => number;
}

export class TronScanProvider implements MarketDataProvider {
  readonly name = "tronscan";
  readonly enabled: boolean;
  private readonly baseUrl: string;
  private readonly headers: Record<string, string> | undefined;
  private readonly timeoutMs: number | undefined;
  private readonly http: typeof fetchJson;
  private readonly now: () => number;

  constructor(options: TronScanProviderOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.enabled = Boolean(options.apiKey);
    this.headers = options.apiKey ? { "TRON-PRO-API-KEY": options.apiKey } : undefined;
    this.timeoutMs = options.timeoutMs;
    this.http = options.fetchJson ?? fetchJson;
    this.now = options.now ?? Date.now;
  }

  supports(base: MarketSymbol, quote: MarketSymbol): boolean {
    return this.enabled && base === "USDT" && quote === "USD";
  }

  async fetchQuotes(requests: PairRequest[], signal?: AbortSignal): Promise<MarketQuote[]> {
    if (!this.enabled) return [];
    if (!requests.some((r) => this.supports(r.base, r.quote))) return [];

    const url = `${this.baseUrl}/token_trc20?contract=${USDT_TRC20_CONTRACT}&showAll=1`;
    const body = await this.http<TronScanTokenResponse>(url, {
      headers: this.headers,
      timeoutMs: this.timeoutMs,
      signal,
    });

    if (body && typeof body === "object" && typeof body.Error === "string") {
      // Rate-limit / upstream error delivered with HTTP 200. Message is safe (no key).
      throw new MarketHttpError("http", `TronScan error (${body.Error.slice(0, 120)})`, { url: safeUrl(url) });
    }

    const tokens: unknown[] = Array.isArray(body?.trc20_tokens) ? body.trc20_tokens : [];
    const token = tokens.find((t): t is TronScanToken => {
      if (!t || typeof t !== "object") return false;
      const rec = t as TronScanToken;
      return rec.contract_address === USDT_TRC20_CONTRACT || rec.symbol === "USDT";
    });
    const info = token?.market_info;
    const price = toPositiveNumber(info?.priceInUsd);
    if (price === null) return [];

    // `gain` is documented as a 24 h change RATIO (e.g. "-0.0002" = -0.02 %).
    // Guard against a percent-looking value: anything beyond ±100 % is junk.
    const gain = toFiniteNumber(info?.gain);
    const change24hPct = gain !== null && Math.abs(gain) <= 1 ? gain * 100 : null;

    return [
      {
        base: "USDT",
        quote: "USD",
        price,
        change24hPct,
        updatedAt: new Date(this.now()).toISOString(),
        source: this.name,
      },
    ];
  }
}
