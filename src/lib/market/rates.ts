import { DEFAULT_EXCHANGE_SPREAD, SUPPORTED_PAIRS } from "@/config/exchange";
import { MARKET_STALE_AFTER_MS, MARKET_UNAVAILABLE_AFTER_MS } from "@/config/market";
import {
  pairKey,
  type IndicativeRate,
  type MarketQuote,
  type MarketSnapshot,
  type MarketStatus,
  type MarketSymbol,
} from "@/lib/market/types";

/**
 * Pure rate engine. No I/O, no config reads beyond the static exchange
 * configuration — safe to import from the client (the rate checker uses
 * `calculateReceive` / `computeStatus`) and fully unit-tested.
 *
 * Rate convention (see docs/ARCHITECTURE.md):
 *   `marketRate` / `ourRate` are units of `to` per 1 `from`, so
 *   `receive = amount * ourRate`.
 *   The spread is applied so the customer always pays market + spread on the
 *   asset they receive: `ourRate = marketRate / (1 + spread)`.
 */

/** Bridge currencies tried, in order, when no direct or inverse quote exists. */
export const BRIDGE_SYMBOLS: readonly MarketSymbol[] = ["USDT", "USD", "BTC"];

/** USDT ≈ USD: allowed as a *mixed* bridge only when no exact route exists. */
const INTERCHANGEABLE_BRIDGES: readonly (readonly [MarketSymbol, MarketSymbol])[] = [
  ["USDT", "USD"],
  ["USD", "USDT"],
];

export interface ResolvedPrice {
  /** 1 base = `price` quote. */
  price: number;
  change24hPct: number | null;
  /** True when the price went through a bridge or an inverse-of-bridge leg. */
  derived: boolean;
  /** Distinct provider names that contributed. */
  sources: string[];
  /** OLDEST contributing timestamp (a derived price is only as fresh as its oldest leg). */
  updatedAt: string;
}

/** One leg of a route: direct, inverse, or the identity (sym/sym = 1). */
interface Leg {
  price: number;
  change24hPct: number | null;
  sources: string[];
  /** null for the identity leg (it has no timestamp of its own). */
  updatedAt: string | null;
}

/* ───────────────────────────── validation helpers ───────────────────────────── */

/** A quote is usable when its price is a finite positive number and it has symbols. */
export function isUsableQuote(q: unknown): q is MarketQuote {
  if (!q || typeof q !== "object") return false;
  const rec = q as Record<string, unknown>;
  return (
    typeof rec.base === "string" &&
    typeof rec.quote === "string" &&
    rec.base !== rec.quote &&
    typeof rec.price === "number" &&
    Number.isFinite(rec.price) &&
    rec.price > 0 &&
    (rec.change24hPct === null ||
      rec.change24hPct === undefined ||
      (typeof rec.change24hPct === "number" && Number.isFinite(rec.change24hPct))) &&
    typeof rec.updatedAt === "string" &&
    typeof rec.source === "string"
  );
}

/** First usable quote wins per pair (the composite already guarantees uniqueness). */
function indexQuotes(quotes: readonly MarketQuote[]): Map<string, MarketQuote> {
  const index = new Map<string, MarketQuote>();
  for (const q of quotes) {
    if (!isUsableQuote(q)) continue;
    const key = pairKey(q.base, q.quote);
    if (!index.has(key)) index.set(key, q);
  }
  return index;
}

/* ─────────────────────────────── change math ─────────────────────────────── */

/** 24h change of the inverse quote: if BTC/USDT rose c %, USDT/BTC changed (1/(1+c/100) - 1)*100 %. */
export function invertChange(change: number | null): number | null {
  if (change === null || !Number.isFinite(change)) return null;
  const factor = 1 + change / 100;
  if (factor <= 0) return null; // impossible in practice (price cannot drop ≥ 100 %)
  return (1 / factor - 1) * 100;
}

/** 24h change of a cross rate base/quote = (base/bridge) ÷ (quote/bridge). */
export function combineChange(changeBase: number | null, changeQuote: number | null): number | null {
  if (changeBase === null || changeQuote === null) return null;
  if (!Number.isFinite(changeBase) || !Number.isFinite(changeQuote)) return null;
  const fq = 1 + changeQuote / 100;
  if (fq <= 0) return null;
  return ((1 + changeBase / 100) / fq - 1) * 100;
}

/** The older of two ISO timestamps; tolerates a missing / invalid side. */
function oldestTimestamp(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta)) return b;
  if (Number.isNaN(tb)) return a;
  return ta <= tb ? a : b;
}

function unionSources(a: readonly string[], b: readonly string[]): string[] {
  return Array.from(new Set([...a, ...b]));
}

/* ─────────────────────────────── route search ─────────────────────────────── */

/** Direct quote base/quote, or the inverse of quote/base. Null when neither exists. */
function directOrInverseLeg(
  index: Map<string, MarketQuote>,
  base: MarketSymbol,
  quote: MarketSymbol,
): Leg | null {
  const direct = index.get(pairKey(base, quote));
  if (direct) {
    return {
      price: direct.price,
      change24hPct: direct.change24hPct ?? null,
      sources: [direct.source],
      updatedAt: direct.updatedAt,
    };
  }
  const inverse = index.get(pairKey(quote, base));
  if (inverse) {
    return {
      price: 1 / inverse.price,
      change24hPct: invertChange(inverse.change24hPct ?? null),
      sources: [inverse.source],
      updatedAt: inverse.updatedAt,
    };
  }
  return null;
}

/** Leg for sym/bridge; the identity leg (price 1) when sym === bridge. */
function bridgeLeg(index: Map<string, MarketQuote>, sym: MarketSymbol, bridge: MarketSymbol): Leg | null {
  if (sym === bridge) return { price: 1, change24hPct: 0, sources: [], updatedAt: null };
  return directOrInverseLeg(index, sym, bridge);
}

/**
 * base/quote = (base/bridgeForBase) ÷ (quote/bridgeForQuote).
 * The two bridges are equal for exact routes and USDT/USD for mixed routes.
 */
function viaBridges(
  index: Map<string, MarketQuote>,
  base: MarketSymbol,
  quote: MarketSymbol,
  bridgeForBase: MarketSymbol,
  bridgeForQuote: MarketSymbol,
): ResolvedPrice | null {
  const legBase = bridgeLeg(index, base, bridgeForBase);
  if (!legBase) return null;
  const legQuote = bridgeLeg(index, quote, bridgeForQuote);
  if (!legQuote) return null;
  // Two identity legs would mean base === quote, which is rejected earlier.
  if (legBase.updatedAt === null && legQuote.updatedAt === null) return null;
  const price = legBase.price / legQuote.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const updatedAt = oldestTimestamp(legBase.updatedAt, legQuote.updatedAt);
  if (!updatedAt) return null;
  return {
    price,
    change24hPct: combineChange(legBase.change24hPct, legQuote.change24hPct),
    derived: true,
    sources: unionSources(legBase.sources, legQuote.sources),
    updatedAt,
  };
}

/**
 * Resolve the market price of 1 `base` in `quote` from the available quotes.
 *
 * 1. direct quote base/quote
 * 2. inverse quote quote/base (price = 1/p, change inverted)
 * 3. cross via a bridge, in order USDT → USD → BTC (each leg direct or inverse)
 * 4. cross via a *mixed* USDT/USD bridge (USDT ≈ USD), only when 1–3 fail
 *
 * Returns null when no route exists.
 */
export function resolveMarketPrice(
  base: MarketSymbol,
  quote: MarketSymbol,
  quotes: readonly MarketQuote[],
): ResolvedPrice | null {
  if (base === quote) return null;
  const index = indexQuotes(quotes);

  const exact = directOrInverseLeg(index, base, quote);
  if (exact) {
    return {
      price: exact.price,
      change24hPct: exact.change24hPct,
      derived: false,
      sources: exact.sources,
      updatedAt: exact.updatedAt ?? new Date(0).toISOString(),
    };
  }

  for (const bridge of BRIDGE_SYMBOLS) {
    // base/bridge with bridge === base (or quote) is just the direct/inverse route again.
    if (bridge === base || bridge === quote) continue;
    const derived = viaBridges(index, base, quote, bridge, bridge);
    if (derived) return derived;
  }

  for (const [bridgeForBase, bridgeForQuote] of INTERCHANGEABLE_BRIDGES) {
    const derived = viaBridges(index, base, quote, bridgeForBase, bridgeForQuote);
    if (derived) return derived;
  }

  return null;
}

/* ───────────────────────────── indicative rates ───────────────────────────── */

/** Spread must be a finite fraction in [0, 1); anything else falls back to the default. */
export function normalizeSpread(spread: number): number {
  return Number.isFinite(spread) && spread >= 0 && spread < 1 ? spread : DEFAULT_EXCHANGE_SPREAD;
}

/**
 * Indicative rates for every SUPPORTED_PAIRS entry that has a price.
 *
 * The price is resolved in the pair's *display* direction (`quoteBase` →
 * `quoteCurrency`), which is the direction real markets quote (BTC/USDT,
 * SOL/BTC, USDT/IDR). `marketRate` (`to` per 1 `from`) is then either that
 * price or its reciprocal. Doing it this way keeps the displayed market price
 * bit-identical to the provider's number (1/(1/100000) ≠ 100000 in floats).
 */
export function computeIndicativeRates(quotes: readonly MarketQuote[], spread: number): IndicativeRate[] {
  const s = normalizeSpread(spread);
  const rates: IndicativeRate[] = [];

  for (const pair of SUPPORTED_PAIRS) {
    const quoteCurrency = pair.quoteBase === pair.from ? pair.to : pair.from;
    const resolved = resolveMarketPrice(pair.quoteBase, quoteCurrency, quotes);
    if (!resolved) continue;

    const displayPrice = resolved.price;
    let marketRate: number;
    let ourRate: number;
    let ourPriceDisplay: number;

    if (pair.quoteBase === pair.from) {
      // Display "1 from = X to" — the rate IS the display price.
      marketRate = displayPrice;
      ourRate = marketRate / (1 + s);
      ourPriceDisplay = ourRate;
    } else {
      // Display "1 to = X from" (e.g. 1 BTC = 100,000 USDT). The customer
      // receives `to`, so our price of 1 `to` is market + spread.
      marketRate = 1 / displayPrice;
      ourPriceDisplay = displayPrice * (1 + s);
      ourRate = 1 / ourPriceDisplay;
    }

    if (!Number.isFinite(marketRate) || !Number.isFinite(ourRate) || ourRate <= 0) continue;

    rates.push({
      pairId: pair.id,
      from: pair.from,
      to: pair.to,
      marketRate,
      ourRate,
      spread: s,
      quoteBase: pair.quoteBase,
      quoteCurrency,
      marketPriceDisplay: displayPrice,
      ourPriceDisplay,
      change24hPct: resolved.change24hPct,
      derived: resolved.derived,
      sources: resolved.sources,
      updatedAt: resolved.updatedAt,
    });
  }

  return rates;
}

/** Amount of `to` the customer receives for `amount` of `from` (0 for invalid input). */
export function calculateReceive(rate: Pick<IndicativeRate, "ourRate">, amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const receive = amount * rate.ourRate;
  return Number.isFinite(receive) && receive > 0 ? receive : 0;
}

/** Inverse of `calculateReceive`: amount of `from` needed to receive `receiveAmount` of `to`. */
export function calculateSend(rate: Pick<IndicativeRate, "ourRate">, receiveAmount: number): number {
  if (!Number.isFinite(receiveAmount) || receiveAmount <= 0 || rate.ourRate <= 0) return 0;
  const send = receiveAmount / rate.ourRate;
  return Number.isFinite(send) && send > 0 ? send : 0;
}

/* ──────────────────────────────── snapshots ──────────────────────────────── */

function toEpochMs(value: string | number | Date | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const ms = value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Status by age of the last successful update:
 *   < MARKET_STALE_AFTER_MS → live · < MARKET_UNAVAILABLE_AFTER_MS → stale · else unavailable.
 * A missing / invalid timestamp is unavailable.
 */
export function computeStatus(
  updatedAt: string | number | Date | null | undefined,
  now: number = Date.now(),
): MarketStatus {
  const ts = toEpochMs(updatedAt);
  if (ts === null) return "unavailable";
  const age = now - ts;
  if (age >= MARKET_UNAVAILABLE_AFTER_MS) return "unavailable";
  if (age >= MARKET_STALE_AFTER_MS) return "stale";
  return "live";
}

/** Distinct `source` names, in first-seen order. */
export function distinctSources(quotes: readonly MarketQuote[]): string[] {
  return Array.from(new Set(quotes.map((q) => q.source)));
}

export interface BuildSnapshotInput {
  quotes: readonly MarketQuote[];
  spread: number;
  /** Last successful provider answer; null if never. */
  updatedAt: string | null;
  /** Defaults to now. */
  generatedAt?: string;
  error?: string | null;
  /** Defaults to `computeStatus(updatedAt, generatedAt)`. */
  status?: MarketStatus;
}

/** Assemble a complete snapshot (rates + sources + status) from raw quotes. */
export function buildSnapshot(input: BuildSnapshotInput): MarketSnapshot {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const quotes = input.quotes.filter(isUsableQuote);
  const spread = normalizeSpread(input.spread);
  const generatedMs = toEpochMs(generatedAt) ?? Date.now();
  return {
    status: input.status ?? computeStatus(input.updatedAt, generatedMs),
    generatedAt,
    updatedAt: input.updatedAt,
    spread,
    quotes,
    rates: computeIndicativeRates(quotes, spread),
    sources: distinctSources(quotes),
    error: input.error ?? null,
  };
}
