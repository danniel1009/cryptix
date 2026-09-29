import "server-only";
import { DEFAULT_EXCHANGE_SPREAD } from "@/config/exchange";

/**
 * Server-only configuration. NEVER import this from a client component.
 * All secrets are read from environment variables; nothing is hardcoded.
 */

export type MarketProviderName =
  | "exchange"
  | "coingecko"
  | "indodax"
  | "tronscan"
  | "mock";

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

function parseSpread(raw: string | undefined): number {
  if (!raw) return DEFAULT_EXCHANGE_SPREAD;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n >= 1) {
    console.warn(`[config] Invalid EXCHANGE_SPREAD="${raw}", using ${DEFAULT_EXCHANGE_SPREAD}`);
    return DEFAULT_EXCHANGE_SPREAD;
  }
  return n;
}

function parseProviderList(raw: string | undefined): MarketProviderName[] {
  const allowed: MarketProviderName[] = ["exchange", "coingecko", "indodax", "tronscan", "mock"];
  if (!raw) return ["exchange", "indodax", "coingecko", "tronscan"];
  const list = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is MarketProviderName => (allowed as string[]).includes(s));
  return list.length > 0 ? list : ["exchange", "indodax", "coingecko", "tronscan"];
}

export const serverConfig = {
  isProduction: process.env.NODE_ENV === "production",

  exchange: {
    /** EXCHANGE_SPREAD=0.05 → our rate = market price + 5 %. */
    spread: parseSpread(env("EXCHANGE_SPREAD")),
  },

  market: {
    /**
     * Ordered provider chain, e.g. MARKET_PROVIDERS="exchange,indodax,coingecko".
     * The first provider that supports a pair and answers wins; the rest are fallbacks.
     * "mock" is only honoured outside production unless ALLOW_MOCK_MARKET_DATA=true.
     */
    providers: parseProviderList(env("MARKET_PROVIDERS")),
    allowMock: env("ALLOW_MOCK_MARKET_DATA") === "true" || process.env.NODE_ENV !== "production",
    /** Generic exchange market API (Binance-compatible public REST). */
    exchangeApiUrl: env("MARKET_EXCHANGE_API_URL") ?? "https://data-api.binance.vision",
    /** Optional key for the exchange / generic market-data provider. */
    marketDataApiKey: env("MARKET_DATA_API_KEY"),
    coingeckoApiUrl: env("COINGECKO_API_URL") ?? "https://api.coingecko.com/api/v3",
    coingeckoApiKey: env("COINGECKO_API_KEY"),
    indodaxApiUrl: env("INDODAX_API_URL") ?? "https://indodax.com/api",
    tronscanApiUrl: env("TRONSCAN_API_URL") ?? "https://apilist.tronscanapi.com/api",
    tronscanApiKey: env("TRONSCAN_API_KEY"),
  },

  leads: {
    /** Where contact / exchange requests are delivered. */
    contactEmail: env("CONTACT_EMAIL") ?? env("NEXT_PUBLIC_CONTACT_EMAIL"),
    /** Optional JSON webhook (Slack/Telegram bridge/Zapier/CRM). */
    webhookUrl: env("LEAD_WEBHOOK_URL"),
    webhookSecret: env("LEAD_WEBHOOK_SECRET"),
    /** Optional transactional email via Resend HTTP API. */
    resendApiKey: env("RESEND_API_KEY"),
    resendFrom: env("RESEND_FROM_EMAIL"),
  },

  security: {
    /** Max submissions per IP per window for the form endpoints. */
    formRateLimitMax: Number(env("FORM_RATE_LIMIT_MAX") ?? 5),
    formRateLimitWindowMs: Number(env("FORM_RATE_LIMIT_WINDOW_MS") ?? 10 * 60_000),
    /** Minimum milliseconds between form render and submit (bot heuristic). */
    formMinFillTimeMs: Number(env("FORM_MIN_FILL_TIME_MS") ?? 2_500),
  },
} as const;

export type ServerConfig = typeof serverConfig;
