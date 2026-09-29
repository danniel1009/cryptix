/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import { MARKET_REFRESH_INTERVAL_MS, MARKET_STALE_AFTER_MS, MARKET_UNAVAILABLE_AFTER_MS } from "@/config/market";
import type { MarketProviderName, ServerConfig } from "@/config/server";
import { buildProviderChain } from "@/lib/market/providers";
import type { CompositeResult } from "@/lib/market/providers/composite";
import { createMarketService, REQUIRED_PAIRS, type SnapshotSource } from "@/lib/market/service";
import type { MarketQuote, MarketSymbol } from "@/lib/market/types";
import { pairKey } from "@/lib/market/types";

const T0 = Date.parse("2026-09-29T08:00:00.000Z");

function quote(base: MarketSymbol, quoteSym: MarketSymbol, price: number, source = "binance", updatedAt = new Date(T0).toISOString()): MarketQuote {
  return { base, quote: quoteSym, price, change24hPct: 0.5, updatedAt, source };
}

/** All ten required pairs from a "real" source. */
function fullReal(source = "binance"): MarketQuote[] {
  const prices: Record<string, number> = {
    "BTC/USDT": 100_000, "ETH/BTC": 0.03, "SOL/BTC": 0.00172, "USDT/IDR": 16_485, "ETH/USDT": 3000,
    "SOL/USDT": 172, "BTC/USD": 100_000, "ETH/USD": 3000, "SOL/USD": 172, "USDT/USD": 1,
  };
  return REQUIRED_PAIRS.map((r) => quote(r.base, r.quote, prices[pairKey(r.base, r.quote)], source));
}

/** A scriptable snapshot source: each call takes the next scripted result. */
function scripted(results: Array<CompositeResult | Error | (() => Promise<CompositeResult>)>) {
  let i = 0;
  const fetchAll = vi.fn(async (): Promise<CompositeResult> => {
    const next = results[Math.min(i, results.length - 1)];
    i += 1;
    if (next instanceof Error) throw next;
    if (typeof next === "function") return next();
    return next;
  });
  const source: SnapshotSource & { fetchAll: typeof fetchAll } = { name: "composite", fetchAll };
  return source;
}

function makeClock(start = T0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms), set: (ms: number) => (t = ms) };
}

describe("createMarketService", () => {
  it("caches within the refresh interval, refreshes after it, and honours force", async () => {
    const clock = makeClock();
    const source = scripted([{ quotes: fullReal(), errors: [] }]);
    const svc = createMarketService({ provider: source, spread: 0.05, allowMock: false, now: clock.now, logger: null });

    const a = await svc.getMarketSnapshot();
    const b = await svc.getMarketSnapshot();
    expect(source.fetchAll).toHaveBeenCalledTimes(1);
    expect(b).toBe(a);
    expect(a.status).toBe("live");
    expect(a.rates.map((r) => r.pairId).sort()).toEqual(["ETH_BTC", "SOL_BTC", "USDT_BTC", "USDT_IDR"]);
    expect(a.spread).toBe(0.05);
    expect(a.sources).toEqual(["binance"]);
    expect(a.error).toBeNull();

    clock.advance(MARKET_REFRESH_INTERVAL_MS - 1);
    await svc.getMarketSnapshot();
    expect(source.fetchAll).toHaveBeenCalledTimes(1);

    clock.advance(1);
    await svc.getMarketSnapshot();
    expect(source.fetchAll).toHaveBeenCalledTimes(2);

    await svc.getMarketSnapshot({ force: true });
    expect(source.fetchAll).toHaveBeenCalledTimes(3);
  });

  it("concurrent callers share ONE in-flight refresh", async () => {
    let release: (r: CompositeResult) => void = () => {};
    const source = scripted([() => new Promise<CompositeResult>((resolve) => (release = resolve))]);
    const svc = createMarketService({ provider: source, spread: 0.05, allowMock: false, logger: null });
    expect(svc.getCachedSnapshot()).toBeNull();

    const p1 = svc.getMarketSnapshot();
    const p2 = svc.getMarketSnapshot({ force: true });
    const p3 = svc.getMarketSnapshot();
    expect(svc.isRefreshing()).toBe(true);
    expect(source.fetchAll).toHaveBeenCalledTimes(1);
    release({ quotes: fullReal(), errors: [] });
    const [s1, s2, s3] = await Promise.all([p1, p2, p3]);
    expect(s1).toBe(s2);
    expect(s2).toBe(s3);
    expect(svc.isRefreshing()).toBe(false);
    expect(svc.getCachedSnapshot()).toBe(s1);
  });

  it("retains last-good quotes when providers fail; status decays live → stale → unavailable by age", async () => {
    const clock = makeClock();
    const source = scripted([
      { quotes: fullReal(), errors: [] },
      { quotes: [], errors: [{ provider: "binance", message: "Request timed out after 6000ms: https://data-api.binance.vision/api/v3/ticker/24hr" }] },
    ]);
    const svc = createMarketService({ provider: source, spread: 0.05, allowMock: false, now: clock.now, logger: null });
    const good = await svc.getMarketSnapshot();
    expect(good.status).toBe("live");
    const goodUpdatedAt = good.updatedAt;

    clock.advance(MARKET_REFRESH_INTERVAL_MS);
    const failed = await svc.getMarketSnapshot({ force: true });
    expect(failed.quotes).toEqual(good.quotes); // last-good retained
    expect(failed.rates).toHaveLength(4);
    expect(failed.updatedAt).toBe(goodUpdatedAt); // did NOT advance
    expect(failed.status).toBe("live"); // still within the stale threshold
    expect(failed.error).toMatch(/^binance: Request timed out/);
    expect(failed.error).not.toMatch(/api[_-]?key|token/i);

    clock.set(T0 + MARKET_STALE_AFTER_MS);
    const stale = await svc.getMarketSnapshot({ force: true });
    expect(stale.status).toBe("stale");
    expect(stale.quotes).toEqual(good.quotes);
    expect(svc.getCachedSnapshot()?.status).toBe("stale");

    clock.set(T0 + MARKET_UNAVAILABLE_AFTER_MS);
    expect(svc.getCachedSnapshot()?.status).toBe("unavailable"); // recomputed by age without a fetch
    const gone = await svc.getMarketSnapshot({ force: true });
    expect(gone.status).toBe("unavailable");
    expect(gone.quotes).toEqual(good.quotes); // still retained, UI decides to hide
    expect(gone.updatedAt).toBe(goodUpdatedAt);
  });

  it("partial failure: fresh pairs + retained pairs, status live, error set", async () => {
    const clock = makeClock();
    const source = scripted([
      { quotes: fullReal(), errors: [] },
      { quotes: fullReal().filter((q) => q.quote !== "IDR"), errors: [{ provider: "indodax", message: "HTTP 503 from https://indodax.com/api/summaries" }] },
    ]);
    const svc = createMarketService({ provider: source, spread: 0.05, allowMock: false, now: clock.now, logger: null });
    await svc.getMarketSnapshot();
    clock.advance(MARKET_REFRESH_INTERVAL_MS);
    const snap = await svc.getMarketSnapshot();
    expect(snap.status).toBe("live");
    expect(snap.updatedAt).toBe(new Date(clock.now()).toISOString());
    expect(snap.error).toBe("indodax: HTTP 503 from https://indodax.com/api/summaries");
    expect(snap.rates.find((r) => r.pairId === "USDT_IDR")).toBeDefined();
    expect(snap.rates.find((r) => r.pairId === "USDT_IDR")?.updatedAt).toBe(new Date(T0).toISOString());
  });

  it("reports missing required pairs as an error even when no provider threw", async () => {
    const source = scripted([{ quotes: fullReal().filter((q) => pairKey(q.base, q.quote) !== "USDT/IDR"), errors: [] }]);
    const svc = createMarketService({ provider: source, spread: 0.05, allowMock: false, logger: null });
    const snap = await svc.getMarketSnapshot();
    expect(snap.status).toBe("live");
    expect(snap.error).toBe("missing quotes: USDT/IDR");
    expect(snap.rates.map((r) => r.pairId)).not.toContain("USDT_IDR");
  });

  it("PRODUCTION never uses mock data: mock-sourced quotes are dropped when allowMock is false", async () => {
    const source = scripted([{ quotes: fullReal("mock"), errors: [] }]);
    const svc = createMarketService({ provider: source, spread: 0.05, allowMock: false, logger: null });
    const snap = await svc.getMarketSnapshot();
    expect(snap.quotes).toEqual([]);
    expect(snap.rates).toEqual([]);
    expect(snap.sources).toEqual([]);
    expect(snap.status).toBe("unavailable");
    expect(snap.updatedAt).toBeNull();
    expect(snap.error).toMatch(/^missing quotes: /);
  });

  it("outside production the mock fills ONLY the gaps and the mixed sources are reported honestly", async () => {
    const real = fullReal("binance").filter((q) => q.quote !== "IDR");
    const mock = fullReal("mock");
    const source = scripted([{ quotes: [...real, ...mock], errors: [] }]);
    const svc = createMarketService({ provider: source, spread: 0.05, allowMock: true, logger: null });
    const snap = await svc.getMarketSnapshot();
    expect(snap.sources).toEqual(["binance", "mock"]);
    expect(snap.status).toBe("live");
    expect(snap.error).toBeNull();
    const byKey = new Map(snap.quotes.map((q) => [pairKey(q.base, q.quote), q.source]));
    expect(byKey.get("BTC/USDT")).toBe("binance");
    expect(byKey.get("USDT/IDR")).toBe("mock");
    expect(snap.rates.find((r) => r.pairId === "USDT_IDR")?.sources).toEqual(["mock"]);
  });

  it("prefers a retained REAL quote over a fresh mock quote", async () => {
    const clock = makeClock();
    const source = scripted([
      { quotes: fullReal("binance"), errors: [] },
      { quotes: fullReal("mock"), errors: [{ provider: "binance", message: "Network error: https://data-api.binance.vision/api/v3/ticker/24hr" }] },
    ]);
    const svc = createMarketService({ provider: source, spread: 0.05, allowMock: true, now: clock.now, logger: null });
    await svc.getMarketSnapshot();
    clock.advance(MARKET_REFRESH_INTERVAL_MS);
    const snap = await svc.getMarketSnapshot();
    expect(snap.sources).toEqual(["binance"]);
    expect(snap.error).toMatch(/^binance: Network error/);
  });

  it("never throws: a rejecting source yields an unavailable snapshot with a safe error", async () => {
    const source = scripted([new Error("fetchAll blew up with key=SECRET-123")]);
    const warn = vi.fn();
    const svc = createMarketService({ provider: source, spread: 0.05, allowMock: false, logger: { warn, info: vi.fn() } });
    const snap = await svc.getMarketSnapshot();
    expect(snap.status).toBe("unavailable");
    expect(snap.quotes).toEqual([]);
    expect(snap.error).toContain("composite: fetchAll blew up");
    expect(warn).toHaveBeenCalled();
    // Recovery on the next refresh.
    source.fetchAll.mockResolvedValueOnce({ quotes: fullReal(), errors: [] });
    const ok = await svc.getMarketSnapshot({ force: true });
    expect(ok.status).toBe("live");
    expect(ok.error).toBeNull();
  });

  it("reset() clears the cache and last-good quotes", async () => {
    const source = scripted([{ quotes: fullReal(), errors: [] }, { quotes: [], errors: [] }]);
    const svc = createMarketService({ provider: source, spread: 0.05, allowMock: false, logger: null });
    await svc.getMarketSnapshot();
    svc.reset();
    expect(svc.getCachedSnapshot()).toBeNull();
    const snap = await svc.getMarketSnapshot();
    expect(snap.quotes).toEqual([]);
    expect(snap.status).toBe("unavailable");
  });
});

describe("buildProviderChain", () => {
  function market(overrides: Partial<ServerConfig["market"]> = {}): { market: ServerConfig["market"] } {
    return {
      market: {
        providers: ["exchange", "indodax", "coingecko", "tronscan"] as MarketProviderName[],
        allowMock: false,
        exchangeApiUrl: "https://data-api.binance.vision",
        marketDataApiKey: undefined,
        coingeckoApiUrl: "https://api.coingecko.com/api/v3",
        coingeckoApiKey: undefined,
        indodaxApiUrl: "https://indodax.com/api",
        tronscanApiUrl: "https://apilist.tronscanapi.com/api",
        tronscanApiKey: undefined,
        ...overrides,
      },
    };
  }

  it("respects MARKET_PROVIDERS order and never adds mock in production", () => {
    const chain = buildProviderChain(market({ providers: ["coingecko", "exchange", "mock", "indodax"] }));
    expect(chain.chain).toEqual(["coingecko", "binance", "indodax"]);
    expect(chain.supports("USDT", "IDR")).toBe(true);
    expect(chain.supports("USDT", "USD")).toBe(true); // coingecko tether/usd + binance USDTUSD
  });

  it("appends mock LAST (once) only when allowMock is true", () => {
    expect(buildProviderChain(market({ allowMock: true, providers: ["mock", "exchange", "mock"] })).chain).toEqual(["binance", "mock"]);
    expect(buildProviderChain(market({ allowMock: true, providers: [] })).chain).toEqual(["mock"]);
  });

  it("tronscan is disabled without a key and enabled with one; duplicates are dropped", () => {
    const off = buildProviderChain(market({ providers: ["tronscan", "tronscan"] }));
    expect(off.chain).toEqual(["tronscan"]);
    expect(off.supports("USDT", "USD")).toBe(false);
    const on = buildProviderChain(market({ providers: ["tronscan"], tronscanApiKey: "k" }));
    expect(on.supports("USDT", "USD")).toBe(true);
    expect(on.supports("BTC", "USD")).toBe(false);
  });

  it("names the generic exchange provider after its host", () => {
    expect(buildProviderChain(market({ providers: ["exchange"], exchangeApiUrl: "https://api.example-exchange.com" })).chain).toEqual(["exchange"]);
  });
});
