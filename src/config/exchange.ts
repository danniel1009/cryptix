/**
 * Exchange configuration: currencies, the ONLY supported exchange pairs, the
 * spread applied on top of the market price, and amount limits.
 *
 * The spread value itself is resolved server-side (see `src/config/server.ts`,
 * env `EXCHANGE_SPREAD`) and transmitted to the client inside the market
 * snapshot. `DEFAULT_EXCHANGE_SPREAD` is only the fallback used when no
 * snapshot is available yet (e.g. for static copy such as "Market price + 5%").
 */

export const CURRENCY_CODES = ["USDT", "BTC", "SOL", "ETH", "IDR"] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export interface CurrencyMeta {
  code: CurrencyCode;
  /** Full name, language independent (proper noun). */
  name: string;
  kind: "crypto" | "fiat";
  /** Decimals used when displaying an AMOUNT of this currency. */
  amountDecimals: number;
  /** Maximum decimals the user may type into an amount input. */
  inputDecimals: number;
  /** Prefix symbol for fiat (e.g. "Rp"). Crypto uses the code as suffix. */
  symbol?: string;
  /** Brand colour used for coin marks / accents. */
  color: string;
  /** Network hint shown in the UI (informational only). */
  network?: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  USDT: {
    code: "USDT",
    name: "Tether USD",
    kind: "crypto",
    amountDecimals: 2,
    inputDecimals: 2,
    color: "#26A17B",
    network: "TRC20 / ERC20",
  },
  BTC: {
    code: "BTC",
    name: "Bitcoin",
    kind: "crypto",
    amountDecimals: 8,
    inputDecimals: 8,
    color: "#F7931A",
  },
  SOL: {
    code: "SOL",
    name: "Solana",
    kind: "crypto",
    amountDecimals: 4,
    inputDecimals: 6,
    color: "#9945FF",
  },
  ETH: {
    code: "ETH",
    name: "Ethereum",
    kind: "crypto",
    amountDecimals: 6,
    inputDecimals: 8,
    color: "#627EEA",
  },
  IDR: {
    code: "IDR",
    name: "Indonesian Rupiah",
    kind: "fiat",
    amountDecimals: 0,
    inputDecimals: 0,
    symbol: "Rp",
    color: "#C8102E",
  },
};

export const PAIR_IDS = [
  // Featured, customer-facing pairs (listed first everywhere, used as defaults).
  "USDT_BTC",
  "SOL_BTC",
  "ETH_BTC",
  "USDT_IDR",
  // Reverse directions: allowed (they make the converter's swap button meaningful),
  // but not promoted in the "Supported exchange pairs" section.
  "BTC_USDT",
  "BTC_SOL",
  "BTC_ETH",
  "IDR_USDT",
] as const;
export type PairId = (typeof PAIR_IDS)[number];

export interface ExchangePair {
  id: PairId;
  /** Currency the customer SENDS. */
  from: CurrencyCode;
  /** Currency the customer RECEIVES. */
  to: CurrencyCode;
  /**
   * The currency used as the "1 unit" side when a rate is displayed, following
   * market convention: "1 BTC = 105,000 USDT", "1 ETH = 0.0298 BTC",
   * "1 SOL = 0.0017 BTC", "1 USDT = Rp16,485" — the same for both directions.
   */
  quoteBase: CurrencyCode;
  /** Featured = one of the four customer-facing pairs shown in marketing sections. */
  featured: boolean;
}

/**
 * The ONLY exchange pairs offered. Nothing else is selectable anywhere.
 * Featured pairs come first; the reverse directions follow.
 */
export const SUPPORTED_PAIRS: readonly ExchangePair[] = [
  { id: "USDT_BTC", from: "USDT", to: "BTC", quoteBase: "BTC", featured: true },
  { id: "SOL_BTC", from: "SOL", to: "BTC", quoteBase: "SOL", featured: true },
  { id: "ETH_BTC", from: "ETH", to: "BTC", quoteBase: "ETH", featured: true },
  { id: "USDT_IDR", from: "USDT", to: "IDR", quoteBase: "USDT", featured: true },
  { id: "BTC_USDT", from: "BTC", to: "USDT", quoteBase: "BTC", featured: false },
  { id: "BTC_SOL", from: "BTC", to: "SOL", quoteBase: "SOL", featured: false },
  { id: "BTC_ETH", from: "BTC", to: "ETH", quoteBase: "ETH", featured: false },
  { id: "IDR_USDT", from: "IDR", to: "USDT", quoteBase: "USDT", featured: false },
] as const;

/** The four customer-facing pairs promoted in marketing sections. */
export const FEATURED_PAIRS: readonly ExchangePair[] = SUPPORTED_PAIRS.filter((p) => p.featured);

export const DEFAULT_PAIR_ID: PairId = "USDT_BTC";

/** Fallback only. The effective spread comes from the market snapshot. */
export const DEFAULT_EXCHANGE_SPREAD = 0.05;

/** Amount limits per SENT currency (informational; the team confirms final terms). */
export const AMOUNT_LIMITS: Record<CurrencyCode, { min: number; max: number }> = {
  USDT: { min: 10, max: 10_000_000 },
  BTC: { min: 0.0001, max: 1_000 },
  SOL: { min: 0.1, max: 1_000_000 },
  ETH: { min: 0.001, max: 100_000 },
  IDR: { min: 100_000, max: 100_000_000_000 },
};

/** Market rows shown in the LIVE MARKET section, in display order. */
export const MARKET_DISPLAY_PAIRS: readonly { base: CurrencyCode; quote: CurrencyCode }[] = [
  { base: "BTC", quote: "USDT" },
  { base: "ETH", quote: "BTC" },
  { base: "SOL", quote: "BTC" },
  { base: "USDT", quote: "IDR" },
] as const;

export function getPairById(id: string | null | undefined): ExchangePair | undefined {
  return SUPPORTED_PAIRS.find((p) => p.id === id);
}

export function isPairId(value: unknown): value is PairId {
  return typeof value === "string" && (PAIR_IDS as readonly string[]).includes(value);
}

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && (CURRENCY_CODES as readonly string[]).includes(value);
}

export function findPair(from: CurrencyCode, to: CurrencyCode): ExchangePair | undefined {
  return SUPPORTED_PAIRS.find((p) => p.from === from && p.to === to);
}

/** Currencies that can be SENT (appear in the "From" selector), featured pairs first. */
export function getSendableCurrencies(): CurrencyCode[] {
  return Array.from(new Set(SUPPORTED_PAIRS.map((p) => p.from)));
}

/** Currencies that can be RECEIVED for a given sent currency, featured pairs first. */
export function getReceivableCurrencies(from: CurrencyCode): CurrencyCode[] {
  return SUPPORTED_PAIRS.filter((p) => p.from === from).map((p) => p.to);
}

/** The opposite direction of a pair, if offered (used by the converter's swap button). */
export function findReversePair(pair: ExchangePair): ExchangePair | undefined {
  return findPair(pair.to, pair.from);
}

/** Human label such as "USDT → BTC". */
export function pairLabel(pair: ExchangePair): string {
  return `${pair.from} → ${pair.to}`;
}
