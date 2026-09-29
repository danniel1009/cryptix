/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { SUPPORTED_PAIRS } from "@/config/exchange";
import { MARKET_STALE_AFTER_MS, MARKET_UNAVAILABLE_AFTER_MS } from "@/config/market";
import {
  buildSnapshot,
  calculateReceive,
  calculateSend,
  combineChange,
  computeIndicativeRates,
  computeStatus,
  invertChange,
  resolveMarketPrice,
} from "@/lib/market/rates";
import type { MarketQuote, MarketSymbol } from "@/lib/market/types";

const T0 = "2026-09-29T08:00:00.000Z";
const T1 = "2026-09-29T08:00:30.000Z";

function q(
  base: MarketSymbol,
  quote: MarketSymbol,
  price: number,
  change24hPct: number | null = null,
  source = "test",
  updatedAt = T0,
): MarketQuote {
  return { base, quote, price, change24hPct, updatedAt, source };
}

const SPREAD = 0.05;

function rate(quotes: MarketQuote[], pairId: string, spread = SPREAD) {
  const r = computeIndicativeRates(quotes, spread).find((x) => x.pairId === pairId);
  if (!r) throw new Error(`no rate for ${pairId}`);
  return r;
}

describe("computeIndicativeRates — the four supported pairs (spread 0.05)", () => {
  it("USDT_BTC from BTC/USDT = 100000: display 100000 → our 105000, receive(1000 USDT) = 1000/105000", () => {
    const r = rate([q("BTC", "USDT", 100_000)], "USDT_BTC");
    expect(r.quoteBase).toBe("BTC");
    expect(r.quoteCurrency).toBe("USDT");
    expect(r.marketPriceDisplay).toBe(100_000);
    expect(r.ourPriceDisplay).toBe(105_000);
    expect(r.marketRate).toBeCloseTo(1 / 100_000, 15);
    expect(r.ourRate).toBeCloseTo(1 / 105_000, 15);
    expect(r.derived).toBe(false);
    const receive = calculateReceive(r, 1000);
    expect(receive).toBeCloseTo(1000 / 105_000, 12);
    expect(receive).toBeCloseTo(0.0095238095, 9);
  });

  it("ETH_BTC derived from ETH/USD = 3000 and BTC/USD = 100000 (no direct ETHBTC)", () => {
    const r = rate([q("ETH", "USD", 3000, null, "coingecko", T1), q("BTC", "USD", 100_000, null, "coingecko", T0)], "ETH_BTC");
    expect(r.marketRate).toBeCloseTo(0.03, 15);
    expect(r.marketPriceDisplay).toBeCloseTo(0.03, 15);
    expect(r.derived).toBe(true);
    expect(r.ourRate).toBeCloseTo(0.03 / 1.05, 15);
    expect(r.sources).toEqual(["coingecko"]);
    expect(r.updatedAt).toBe(T0); // OLDEST contributing timestamp
  });

  it("SOL_BTC from SOL/BTC = 0.00172: display 0.00172 → our 0.00172/1.05", () => {
    const r = rate([q("SOL", "BTC", 0.00172)], "SOL_BTC");
    expect(r.quoteBase).toBe("SOL");
    expect(r.quoteCurrency).toBe("BTC");
    expect(r.marketPriceDisplay).toBe(0.00172);
    expect(r.ourPriceDisplay).toBeCloseTo(0.00172 / 1.05, 15);
    expect(r.marketRate).toBe(0.00172);
    expect(r.ourRate).toBeCloseTo(0.00172 / 1.05, 15);
    expect(r.derived).toBe(false);
  });

  it("USDT_IDR from USDT/IDR = 16485: display 16485 → our 15700, receive(100 USDT) = 100*16485/1.05", () => {
    const r = rate([q("USDT", "IDR", 16_485)], "USDT_IDR");
    expect(r.quoteBase).toBe("USDT");
    expect(r.quoteCurrency).toBe("IDR");
    expect(r.marketPriceDisplay).toBe(16_485);
    expect(r.ourPriceDisplay).toBeCloseTo(15_700, 9);
    expect(r.ourRate).toBeCloseTo(16_485 / 1.05, 9);
    expect(calculateReceive(r, 100)).toBeCloseTo((100 * 16_485) / 1.05, 6);
    expect(calculateReceive(r, 100)).toBeCloseTo(1_570_000, 6);
  });

  it("prefers a direct quote over a derived one", () => {
    const quotes = [q("ETH", "BTC", 0.031, null, "binance"), q("ETH", "USD", 3000, null, "coingecko"), q("BTC", "USD", 100_000, null, "coingecko")];
    const r = rate(quotes, "ETH_BTC");
    expect(r.marketRate).toBe(0.031);
    expect(r.derived).toBe(false);
    expect(r.sources).toEqual(["binance"]);
  });

  it("uses the 24h change of the DISPLAY quote", () => {
    expect(rate([q("BTC", "USDT", 100_000, 2.5)], "USDT_BTC").change24hPct).toBeCloseTo(2.5, 12);
    expect(rate([q("USDT", "IDR", 16_485, -0.4)], "USDT_IDR").change24hPct).toBeCloseTo(-0.4, 12);
  });

  it("skips pairs with no price and ignores junk quotes", () => {
    expect(computeIndicativeRates([], SPREAD)).toEqual([]);
    const junk = [
      q("BTC", "USDT", 0),
      q("SOL", "BTC", Number.NaN),
      q("USDT", "IDR", -5),
      { ...q("ETH", "BTC", 0.03), price: "0.03" as unknown as number },
    ];
    expect(computeIndicativeRates(junk, SPREAD)).toEqual([]);
    const ids = computeIndicativeRates([q("USDT", "IDR", 16_485)], SPREAD).map((r) => r.pairId);
    expect(ids).toEqual(["USDT_IDR"]);
  });

  it("spread 0 → ourRate === marketRate and ourPriceDisplay === marketPriceDisplay", () => {
    const quotes = [q("BTC", "USDT", 100_000), q("SOL", "BTC", 0.00172), q("ETH", "BTC", 0.03), q("USDT", "IDR", 16_485)];
    const rates = computeIndicativeRates(quotes, 0);
    expect(rates).toHaveLength(SUPPORTED_PAIRS.length);
    for (const r of rates) {
      expect(r.spread).toBe(0);
      expect(r.ourRate).toBe(r.marketRate);
      expect(r.ourPriceDisplay).toBe(r.marketPriceDisplay);
    }
  });

  it("mutation guard: with spread > 0 the customer ALWAYS receives less than market, for every pair", () => {
    const quotes = [q("BTC", "USDT", 100_000), q("SOL", "BTC", 0.00172), q("ETH", "BTC", 0.03), q("USDT", "IDR", 16_485)];
    const rates = computeIndicativeRates(quotes, SPREAD);
    expect(rates.map((r) => r.pairId).sort()).toEqual(SUPPORTED_PAIRS.map((p) => p.id).sort());
    for (const r of rates) {
      // Swapping the spread direction (market * (1+s)) would make ourRate > marketRate and fail here.
      expect(r.ourRate).toBeLessThan(r.marketRate);
      expect(r.ourRate).toBeCloseTo(r.marketRate / (1 + SPREAD), 15);
      expect(calculateReceive(r, 1)).toBeLessThan(r.marketRate);
      // Display direction: customer pays MORE per unit received / gets LESS per unit sent.
      if (r.quoteBase === r.to) expect(r.ourPriceDisplay).toBeGreaterThan(r.marketPriceDisplay);
      else expect(r.ourPriceDisplay).toBeLessThan(r.marketPriceDisplay);
    }
  });

  it("an invalid spread falls back to the default instead of producing a free rate", () => {
    const r = rate([q("USDT", "IDR", 16_485)], "USDT_IDR", Number.NaN);
    expect(r.spread).toBe(0.05);
    expect(r.ourRate).toBeLessThan(r.marketRate);
  });
});

describe("calculateReceive / calculateSend", () => {
  const r = rate([q("USDT", "IDR", 16_485)], "USDT_IDR");
  it("returns 0 for invalid amounts", () => {
    expect(calculateReceive(r, 0)).toBe(0);
    expect(calculateReceive(r, -1)).toBe(0);
    expect(calculateReceive(r, Number.NaN)).toBe(0);
    expect(calculateSend(r, 0)).toBe(0);
  });
  it("send is the inverse of receive", () => {
    expect(calculateSend(r, calculateReceive(r, 250))).toBeCloseTo(250, 9);
  });
});

describe("resolveMarketPrice — routes", () => {
  it("direct", () => {
    const r = resolveMarketPrice("BTC", "USDT", [q("BTC", "USDT", 100_000, 1.5, "binance")]);
    expect(r).toMatchObject({ price: 100_000, change24hPct: 1.5, derived: false, sources: ["binance"], updatedAt: T0 });
  });

  it("inverse: price = 1/p and change = (1/(1+c/100) - 1)*100", () => {
    const r = resolveMarketPrice("USDT", "BTC", [q("BTC", "USDT", 100_000, 10)]);
    expect(r).not.toBeNull();
    expect(r!.price).toBeCloseTo(1e-5, 18);
    expect(r!.change24hPct).toBeCloseTo((1 / 1.1 - 1) * 100, 12); // ≈ -9.0909
    expect(r!.derived).toBe(false);
    expect(invertChange(null)).toBeNull();
    expect(invertChange(0)).toBe(0);
  });

  it("cross via bridge: price = P(base/bridge)/P(quote/bridge), change = ((1+cb)/(1+cq) - 1)*100", () => {
    const r = resolveMarketPrice("ETH", "BTC", [q("ETH", "USDT", 3000, 4, "binance", T1), q("BTC", "USDT", 100_000, 2, "binance", T0)]);
    expect(r).not.toBeNull();
    expect(r!.price).toBeCloseTo(0.03, 15);
    expect(r!.change24hPct).toBeCloseTo((1.04 / 1.02 - 1) * 100, 12);
    expect(r!.derived).toBe(true);
    expect(r!.updatedAt).toBe(T0);
    expect(combineChange(4, null)).toBeNull();
  });

  it("bridge order is USDT → USD → BTC", () => {
    const viaUsdt = q("ETH", "USDT", 3000, null, "usdt-src");
    const viaUsd = q("ETH", "USD", 2990, null, "usd-src");
    const btcUsdt = q("BTC", "USDT", 100_000, null, "usdt-src");
    const btcUsd = q("BTC", "USD", 99_000, null, "usd-src");
    const r = resolveMarketPrice("ETH", "BTC", [viaUsd, btcUsd, viaUsdt, btcUsdt]);
    expect(r!.sources).toEqual(["usdt-src"]);
    expect(r!.price).toBeCloseTo(0.03, 15);
    const r2 = resolveMarketPrice("ETH", "BTC", [viaUsd, btcUsd]);
    expect(r2!.sources).toEqual(["usd-src"]);
  });

  it("bridge legs may be inverse (BTC/IDR = BTC/USDT × USDT/IDR)", () => {
    const r = resolveMarketPrice("BTC", "IDR", [q("BTC", "USDT", 100_000, null, "binance"), q("USDT", "IDR", 16_485, null, "indodax")]);
    expect(r!.price).toBeCloseTo(100_000 * 16_485, 6);
    expect(r!.derived).toBe(true);
    expect(r!.sources).toEqual(["binance", "indodax"]);
  });

  it("USDT ≈ USD mixed bridge only when no exact route exists (marked derived)", () => {
    const r = resolveMarketPrice("ETH", "BTC", [q("ETH", "USDT", 3000, null, "binance"), q("BTC", "USD", 100_000, null, "coingecko")]);
    expect(r!.price).toBeCloseTo(0.03, 15);
    expect(r!.derived).toBe(true);
    expect(r!.sources).toEqual(["binance", "coingecko"]);
    // BTC/USD from BTC/USDT alone (identity leg) is also a derived substitution.
    const sub = resolveMarketPrice("BTC", "USD", [q("BTC", "USDT", 100_000)]);
    expect(sub!.price).toBe(100_000);
    expect(sub!.derived).toBe(true);
  });

  it("returns null for base === quote or when no route exists", () => {
    expect(resolveMarketPrice("BTC", "BTC", [q("BTC", "USDT", 1)])).toBeNull();
    expect(resolveMarketPrice("SOL", "IDR", [q("BTC", "USDT", 1)])).toBeNull();
    expect(resolveMarketPrice("SOL", "IDR", [])).toBeNull();
  });
});

describe("computeStatus", () => {
  const now = Date.parse(T0);
  it("null / invalid → unavailable", () => {
    expect(computeStatus(null, now)).toBe("unavailable");
    expect(computeStatus(undefined, now)).toBe("unavailable");
    expect(computeStatus("not-a-date", now)).toBe("unavailable");
  });
  it("fresh → live, older than stale threshold → stale, older than unavailable threshold → unavailable", () => {
    expect(computeStatus(new Date(now - 1000).toISOString(), now)).toBe("live");
    expect(computeStatus(now - MARKET_STALE_AFTER_MS + 1, now)).toBe("live");
    expect(computeStatus(now - MARKET_STALE_AFTER_MS, now)).toBe("stale");
    expect(computeStatus(now - MARKET_UNAVAILABLE_AFTER_MS + 1, now)).toBe("stale");
    expect(computeStatus(now - MARKET_UNAVAILABLE_AFTER_MS, now)).toBe("unavailable");
  });
});

describe("buildSnapshot", () => {
  it("computes rates, distinct sources and status by age", () => {
    const quotes = [q("BTC", "USDT", 100_000, null, "binance"), q("USDT", "IDR", 16_485, null, "indodax"), q("ETH", "USDT", 3000, null, "binance")];
    const snap = buildSnapshot({ quotes, spread: 0.05, updatedAt: T0, generatedAt: T1 });
    expect(snap.status).toBe("live");
    expect(snap.sources).toEqual(["binance", "indodax"]);
    expect(snap.rates.map((r) => r.pairId).sort()).toEqual(["ETH_BTC", "USDT_BTC", "USDT_IDR"]);
    expect(snap.error).toBeNull();
    expect(snap.spread).toBe(0.05);
    const stale = buildSnapshot({ quotes, spread: 0.05, updatedAt: T0, generatedAt: new Date(Date.parse(T0) + MARKET_STALE_AFTER_MS).toISOString() });
    expect(stale.status).toBe("stale");
    const never = buildSnapshot({ quotes: [], spread: 0.05, updatedAt: null, error: "boom" });
    expect(never.status).toBe("unavailable");
    expect(never.rates).toEqual([]);
    expect(never.error).toBe("boom");
  });
});
