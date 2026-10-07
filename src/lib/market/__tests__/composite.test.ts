/** @vitest-environment node */
import { MarketHttpError } from "@/lib/market/http";
import { describe, expect, it, vi } from "vitest";
import { CompositeProvider } from "@/lib/market/providers/composite";
import { MockProvider } from "@/lib/market/providers/mock";
import type { MarketDataProvider, MarketQuote, MarketSymbol, PairRequest } from "@/lib/market/types";
import { pairKey } from "@/lib/market/types";

const T0 = "2026-09-29T08:00:00.000Z";

type Behaviour =
  | { kind: "ok"; prices?: Partial<Record<string, number>> }
  | { kind: "throw"; message?: string }
  | { kind: "hang" }
  | { kind: "junk"; value: unknown };

/** Test double: supports a fixed set of pair keys and behaves as configured. */
function fake(name: string, supported: string[], behaviour: Behaviour = { kind: "ok" }) {
  const set = new Set(supported);
  const calls: PairRequest[][] = [];
  const provider: MarketDataProvider & { calls: PairRequest[][] } = {
    name,
    calls,
    supports: (b: MarketSymbol, q: MarketSymbol) => set.has(pairKey(b, q)),
    async fetchQuotes(requests, signal) {
      calls.push(requests);
      if (behaviour.kind === "throw") throw new Error(behaviour.message ?? `${name} exploded`);
      if (behaviour.kind === "hang") {
        return new Promise<MarketQuote[]>((_, reject) => {
          signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
        });
      }
      if (behaviour.kind === "junk") return behaviour.value as MarketQuote[];
      return requests
        .filter((r) => set.has(pairKey(r.base, r.quote)))
        .map((r) => {
          const price = behaviour.prices?.[pairKey(r.base, r.quote)] ?? 1;
          return { base: r.base, quote: r.quote, price, change24hPct: 0, updatedAt: T0, source: name };
        });
    },
  };
  return provider;
}

const req = (base: MarketSymbol, quote: MarketSymbol): PairRequest => ({ base, quote });
const BTC_USDT = req("BTC", "USDT");
const ETH_BTC = req("ETH", "BTC");
const USDT_IDR = req("USDT", "IDR");

describe("CompositeProvider", () => {
  it("supports() is the union of the chain", () => {
    const c = new CompositeProvider([fake("a", ["BTC/USDT"]), fake("b", ["USDT/IDR"])]);
    expect(c.supports("BTC", "USDT")).toBe(true);
    expect(c.supports("USDT", "IDR")).toBe(true);
    expect(c.supports("SOL", "IDR")).toBe(false);
    expect(c.chain).toEqual(["a", "b"]);
  });

  it("asks each provider only for the pairs it is the FIRST supporter of, in parallel", async () => {
    const a = fake("a", ["BTC/USDT", "ETH/BTC"]);
    const b = fake("b", ["BTC/USDT", "ETH/BTC", "USDT/IDR"]);
    const c = new CompositeProvider([a, b]);
    const { quotes, errors } = await c.fetchAll([BTC_USDT, ETH_BTC, USDT_IDR]);
    expect(errors).toEqual([]);
    expect(a.calls).toEqual([[BTC_USDT, ETH_BTC]]);
    expect(b.calls).toEqual([[USDT_IDR]]);
    expect(quotes.map((q) => `${pairKey(q.base, q.quote)}@${q.source}`)).toEqual(["BTC/USDT@a", "ETH/BTC@a", "USDT/IDR@b"]);
  });

  it("falls back per pair when the primary provider throws, and records the error", async () => {
    const a = fake("a", ["BTC/USDT", "ETH/BTC"], { kind: "throw", message: "HTTP 503 from https://a.example/api" });
    const b = fake("b", ["BTC/USDT", "ETH/BTC", "USDT/IDR"]);
    const c = new CompositeProvider([a, b]);
    const { quotes, errors } = await c.fetchAll([BTC_USDT, ETH_BTC, USDT_IDR]);
    expect(errors).toEqual([{ provider: "a", message: "HTTP 503 from https://a.example/api" }]);
    expect(b.calls).toEqual([[USDT_IDR], [BTC_USDT, ETH_BTC]]);
    expect(quotes.every((q) => q.source === "b")).toBe(true);
    expect(quotes).toHaveLength(3);
  });

  it("fills pairs a provider silently OMITTED from the next provider in the chain", async () => {
    const a = fake("a", ["BTC/USDT", "ETH/BTC"]);
    // `a` claims ETH/BTC but only ever returns BTC/USDT.
    a.fetchQuotes = async (requests) => requests.filter((r) => r.base === "BTC").map((r) => ({ ...r, price: 5, change24hPct: null, updatedAt: T0, source: "a" }));
    const b = fake("b", ["ETH/BTC"], { kind: "ok", prices: { "ETH/BTC": 0.03 } });
    const c = new CompositeProvider([a, b]);
    const { quotes, errors } = await c.fetchAll([BTC_USDT, ETH_BTC]);
    expect(errors).toEqual([]);
    expect(quotes).toEqual([
      expect.objectContaining({ base: "BTC", quote: "USDT", price: 5, source: "a" }),
      expect.objectContaining({ base: "ETH", quote: "BTC", price: 0.03, source: "b" }),
    ]);
  });

  it("isolates errors: never rejects, even when every provider fails", async () => {
    const c = new CompositeProvider([fake("a", ["BTC/USDT"], { kind: "throw" }), fake("b", ["BTC/USDT"], { kind: "junk", value: { nope: true } })]);
    const { quotes, errors } = await c.fetchAll([BTC_USDT]);
    expect(quotes).toEqual([]);
    expect(errors.map((e) => e.provider)).toEqual(["a", "b"]);
    expect(errors[1].message).toMatch(/non-array/);
    await expect(c.fetchQuotes([BTC_USDT])).resolves.toEqual([]);
  });

  it("drops junk quotes and quotes for pairs that were not requested", async () => {
    const junk = fake("a", ["BTC/USDT"], {
      kind: "junk",
      value: [
        { base: "BTC", quote: "USDT", price: 0, change24hPct: null, updatedAt: T0, source: "a" }, // price 0
        { base: "BTC", quote: "USDT", price: "1" as unknown as number, change24hPct: null, updatedAt: T0, source: "a" }, // string
        { base: "SOL", quote: "USDT", price: 100, change24hPct: null, updatedAt: T0, source: "a" }, // not requested
        null,
        { base: "BTC", quote: "USDT", price: 100_000, change24hPct: 1, updatedAt: T0, source: "" }, // valid, empty source → provider name
      ],
    });
    const { quotes, errors } = await c(junk).fetchAll([BTC_USDT]);
    expect(errors).toEqual([]);
    expect(quotes).toEqual([{ base: "BTC", quote: "USDT", price: 100_000, change24hPct: 1, updatedAt: T0, source: "a" }]);
    function c(p: MarketDataProvider) {
      return new CompositeProvider([p]);
    }
  });

  it("cuts off a hanging provider at the per-provider deadline and moves on", async () => {
    const hang = fake("hang", ["BTC/USDT"], { kind: "hang" });
    const b = fake("b", ["BTC/USDT"]);
    const c = new CompositeProvider([hang, b], { providerDeadlineMs: 25 });
    const started = Date.now();
    const { quotes, errors } = await c.fetchAll([BTC_USDT]);
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(errors).toEqual([{ provider: "hang", message: "Provider deadline of 25ms exceeded" }]);
    expect(quotes[0]?.source).toBe("b");
  });

  it("propagates an outer abort signal to providers", async () => {
    const hang = fake("hang", ["BTC/USDT"], { kind: "hang" });
    const c = new CompositeProvider([hang], { providerDeadlineMs: 5_000 });
    const controller = new AbortController();
    const pending = c.fetchAll([BTC_USDT], controller.signal);
    controller.abort();
    const { quotes, errors } = await pending;
    expect(quotes).toEqual([]);
    expect(errors[0]?.message).toBe("aborted");

    // A signal that is ALREADY aborted never reaches the provider at all.
    const untouched = fake("untouched", ["BTC/USDT"], { kind: "hang" });
    const pre = new AbortController();
    pre.abort();
    const result = await new CompositeProvider([untouched]).fetchAll([BTC_USDT], pre.signal);
    expect(untouched.calls).toEqual([]);
    expect(result.errors).toEqual([{ provider: "untouched", message: "Request aborted" }]);
  });

  it("invokes onError for every recorded error, and a throwing hook cannot break the chain", async () => {
    const onError = vi.fn(() => {
      throw new Error("logger broke");
    });
    const c = new CompositeProvider([fake("a", ["BTC/USDT"], { kind: "throw" }), fake("b", ["BTC/USDT"])], { onError });
    const { quotes } = await c.fetchAll([BTC_USDT]);
    expect(onError).toHaveBeenCalledWith({ provider: "a", message: "a exploded" });
    expect(quotes[0]?.source).toBe("b");
  });

  it("dedupes requests, ignores base === quote, and returns quotes in request order", async () => {
    const a = fake("a", ["BTC/USDT", "USDT/IDR"]);
    const c = new CompositeProvider([a]);
    const { quotes } = await c.fetchAll([USDT_IDR, BTC_USDT, USDT_IDR, req("BTC", "BTC")]);
    expect(a.calls).toEqual([[USDT_IDR, BTC_USDT]]);
    expect(quotes.map((q) => pairKey(q.base, q.quote))).toEqual(["USDT/IDR", "BTC/USDT"]);
  });

  it("a mock provider appended LAST only fills the gaps, and sources stay honest", async () => {
    const real = fake("binance", ["BTC/USDT"], { kind: "ok", prices: { "BTC/USDT": 83_000 } });
    const c = new CompositeProvider([real, new MockProvider({ seed: 1 })]);
    const { quotes, errors } = await c.fetchAll([BTC_USDT, ETH_BTC, USDT_IDR]);
    expect(errors).toEqual([]);
    expect(quotes.map((q) => `${pairKey(q.base, q.quote)}@${q.source}`)).toEqual(["BTC/USDT@binance", "ETH/BTC@mock", "USDT/IDR@mock"]);
    expect(quotes[0].price).toBe(83_000);
  });
});

describe("MockProvider", () => {
  it("is deterministic for a given seed and walks gently", async () => {
    const a = new MockProvider({ seed: 42, now: () => 0 });
    const b = new MockProvider({ seed: 42, now: () => 0 });
    const reqs = [BTC_USDT, USDT_IDR];
    const [a1, b1] = await Promise.all([a.fetchQuotes(reqs), b.fetchQuotes(reqs)]);
    expect(a1).toEqual(b1);
    const a2 = await a.fetchQuotes(reqs);
    for (let i = 0; i < a1.length; i++) {
      const move = Math.abs(a2[i].price / a1[i].price - 1);
      expect(move).toBeLessThan(0.01);
      expect(a2[i].source).toBe("mock");
    }
    expect(a.supports("BTC", "USDT")).toBe(true);
    expect(a.supports("IDR", "BTC")).toBe(false);
  });
});

describe("CompositeProvider — transient retries", () => {
  const q = (base: MarketSymbol, quote: MarketSymbol, price: number): MarketQuote => ({
    base, quote, price, change24hPct: null, updatedAt: "2026-10-07T07:00:00.000Z", source: "flaky",
  });
  function flaky(failures: number, error: unknown): MarketDataProvider & { calls: number } {
    const p = {
      name: "flaky",
      calls: 0,
      supports: () => true,
      async fetchQuotes() {
        p.calls += 1;
        if (p.calls <= failures) throw error;
        return [q("USDT", "IDR", 16485)];
      },
    };
    return p;
  }
  it("retries one transient network failure and then succeeds without recording an error", async () => {
    const provider = flaky(1, new MarketHttpError("network", "Network error: https://indodax.com/api/summaries", { url: "https://indodax.com/api/summaries" }));
    const c = new CompositeProvider([provider], { sleep: async () => {}, retryDelayMs: 0 });
    const { quotes, errors } = await c.fetchAll([{ base: "USDT", quote: "IDR" }]);
    expect(provider.calls).toBe(2);
    expect(quotes.map((x) => x.price)).toEqual([16485]);
    expect(errors).toEqual([]);
  });
  it("gives up after the configured retries and records the error", async () => {
    const provider = flaky(5, Object.assign(new Error("fetch failed"), { cause: { code: "ETIMEDOUT" } }));
    const c = new CompositeProvider([provider], { sleep: async () => {}, retryDelayMs: 0, transientRetries: 2 });
    const { quotes, errors } = await c.fetchAll([{ base: "USDT", quote: "IDR" }]);
    expect(provider.calls).toBe(3);
    expect(quotes).toEqual([]);
    expect(errors).toHaveLength(1);
  });
  it("never retries HTTP errors", async () => {
    const provider = flaky(1, new MarketHttpError("http", "HTTP 429", { url: "https://indodax.com/api/summaries", status: 429 }));
    const c = new CompositeProvider([provider], { sleep: async () => {}, retryDelayMs: 0 });
    const { errors } = await c.fetchAll([{ base: "USDT", quote: "IDR" }]);
    expect(provider.calls).toBe(1);
    expect(errors).toHaveLength(1);
  });
});
