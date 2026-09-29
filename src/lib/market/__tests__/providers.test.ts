/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketHttpError, describeError, epochToIso, fetchJson, safeUrl, toPositiveNumber } from "@/lib/market/http";
import { CoinGeckoProvider } from "@/lib/market/providers/coingecko";
import { ExchangeProvider } from "@/lib/market/providers/exchange";
import { IndodaxProvider } from "@/lib/market/providers/indodax";
import { TronScanProvider } from "@/lib/market/providers/tronscan";
import type { PairRequest } from "@/lib/market/types";

const NOW = Date.parse("2026-09-29T08:00:00.000Z");

type Call = { url: string; headers?: Record<string, string> };

/** Records calls and answers from a table keyed by URL substring. */
function fakeHttp(routes: Array<[match: string, answer: unknown | (() => never)]>) {
  const calls: Call[] = [];
  const http = (async (url: string, options?: { headers?: Record<string, string> }) => {
    calls.push({ url, headers: options?.headers });
    const route = routes.find(([m]) => url.includes(m));
    if (!route) throw new MarketHttpError("http", `HTTP 404 from ${safeUrl(url)}`, { url: safeUrl(url), status: 404 });
    const [, answer] = route;
    if (typeof answer === "function") return (answer as () => never)();
    return answer;
  }) as unknown as typeof fetchJson;
  return { http, calls };
}

const r = (base: PairRequest["base"], quote: PairRequest["quote"]): PairRequest => ({ base, quote });

/* Recorded 2026-09-29 from https://data-api.binance.vision (trimmed). */
const BINANCE_BATCH = [
  { symbol: "ETHBTC", priceChange: "0.00033000", priceChangePercent: "1.038", lastPrice: "0.03213000", closeTime: 1790646399809 },
  { symbol: "BTCUSDT", priceChange: "-759.89000000", priceChangePercent: "-0.906", lastPrice: "83068.01000000", closeTime: 1790646400012 },
  { symbol: "SOLBTC", priceChangePercent: "-2.265", lastPrice: "0.00141070", closeTime: 1790646445536 },
  { symbol: "DOGEUSDT", priceChangePercent: "1", lastPrice: "0.1", closeTime: 1790646445536 }, // not in our map → ignored
  { symbol: "ETHUSDT", priceChangePercent: "0.091", lastPrice: "not-a-number", closeTime: 1790646445536 }, // junk price → ignored
];

describe("ExchangeProvider (Binance-compatible)", () => {
  it("parses the recorded batch response and ignores unknown symbols / junk prices", async () => {
    const { http, calls } = fakeHttp([["symbols=", BINANCE_BATCH]]);
    const p = new ExchangeProvider({ baseUrl: "https://data-api.binance.vision/", fetchJson: http, now: () => NOW });
    expect(p.name).toBe("binance");
    const quotes = await p.fetchQuotes([r("BTC", "USDT"), r("ETH", "BTC"), r("SOL", "BTC"), r("ETH", "USDT"), r("USDT", "IDR")]);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      "https://data-api.binance.vision/api/v3/ticker/24hr?symbols=" + encodeURIComponent(JSON.stringify(["BTCUSDT", "ETHBTC", "SOLBTC", "ETHUSDT"])),
    );
    expect(calls[0].headers).toBeUndefined(); // no key → no header
    expect(quotes).toEqual([
      { base: "ETH", quote: "BTC", price: 0.03213, change24hPct: 1.038, updatedAt: new Date(1790646399809).toISOString(), source: "binance" },
      { base: "BTC", quote: "USDT", price: 83068.01, change24hPct: -0.906, updatedAt: new Date(1790646400012).toISOString(), source: "binance" },
      { base: "SOL", quote: "BTC", price: 0.0014107, change24hPct: -2.265, updatedAt: new Date(1790646445536).toISOString(), source: "binance" },
    ]);
  });

  it("supports() is static: USDT/IDR is not a Binance market, base===quote never", () => {
    const p = new ExchangeProvider({ baseUrl: "https://data-api.binance.vision" });
    expect(p.supports("BTC", "USDT")).toBe(true);
    expect(p.supports("USDT", "USD")).toBe(true);
    expect(p.supports("USDT", "IDR")).toBe(false);
    expect(p.supports("BTC", "BTC")).toBe(false);
    expect(new ExchangeProvider({ baseUrl: "https://api.other-exchange.com" }).name).toBe("exchange");
  });

  it("sends X-MBX-APIKEY only when configured and returns [] without supported pairs", async () => {
    const { http, calls } = fakeHttp([["symbols=", BINANCE_BATCH]]);
    const p = new ExchangeProvider({ baseUrl: "https://data-api.binance.vision", apiKey: "k-123", fetchJson: http });
    await p.fetchQuotes([r("BTC", "USDT")]);
    expect(calls[0].headers).toEqual({ "X-MBX-APIKEY": "k-123" });
    expect(await p.fetchQuotes([r("USDT", "IDR")])).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it("falls back to per-symbol requests when the batch is rejected with HTTP 400 (invalid symbol)", async () => {
    const { http, calls } = fakeHttp([
      ["symbols=", () => { throw new MarketHttpError("http", "HTTP 400 from https://x/api/v3/ticker/24hr (Invalid symbol.)", { url: "https://x/api/v3/ticker/24hr", status: 400 }); }],
      ["symbol=BTCUSDT", BINANCE_BATCH[1]],
      ["symbol=BTCUSD", () => { throw new MarketHttpError("http", "HTTP 400", { url: "https://x", status: 400 }); }],
    ]);
    const p = new ExchangeProvider({ baseUrl: "https://x", fetchJson: http, now: () => NOW });
    const quotes = await p.fetchQuotes([r("BTC", "USDT"), r("BTC", "USD")]);
    expect(calls.map((c) => c.url)).toEqual(["https://x/api/v3/ticker/24hr?symbols=%5B%22BTCUSDT%22%2C%22BTCUSD%22%5D", "https://x/api/v3/ticker/24hr?symbol=BTCUSDT", "https://x/api/v3/ticker/24hr?symbol=BTCUSD"]);
    expect(quotes.map((q) => `${q.base}/${q.quote}`)).toEqual(["BTC/USDT"]);
  });

  it("propagates non-400 transport errors", async () => {
    const { http } = fakeHttp([["symbols=", () => { throw new MarketHttpError("timeout", "Request timed out after 6000ms: https://x/api/v3/ticker/24hr", { url: "https://x" }); }]]);
    const p = new ExchangeProvider({ baseUrl: "https://x", fetchJson: http });
    await expect(p.fetchQuotes([r("BTC", "USDT")])).rejects.toThrow(/timed out/);
  });
});

/* Recorded 2026-09-29 from https://indodax.com/api (trimmed). */
const INDODAX_SUMMARIES = {
  tickers: {
    btc_idr: { buy: "1492099000", high: "1514866000", last: "1492100000", low: "1483018000", name: "Bitcoin", sell: "1492100000", server_time: 1790646406, vol_btc: "19.14", vol_idr: "28599783839" },
    usdt_idr: { buy: "17987", high: "18000", last: "17980", low: "17865", name: "Tether USDt", sell: "17988", server_time: 1790646415, vol_idr: "128918934016", vol_usdt: "7186089.24" },
    eth_idr: { last: "48000000", server_time: 1790646415 },
  },
  prices_24h: { btcidr: 1501125000, usdtidr: 17870, ethidr: 47702000, solidr: 2163000 },
  prices_7d: { usdtidr: 17680 },
};
const INDODAX_TICKER_SOL = { ticker: { buy: "2104835", high: "2172718", last: "2106942", low: "2098001", sell: "2111703", server_time: 1790646406 } };

describe("IndodaxProvider", () => {
  it("parses /summaries (tickers.<base>_idr + prices_24h.<base>idr) and falls back to /ticker for missing pairs", async () => {
    const { http, calls } = fakeHttp([["/summaries", INDODAX_SUMMARIES], ["/ticker/solidr", INDODAX_TICKER_SOL]]);
    const p = new IndodaxProvider({ baseUrl: "https://indodax.com/api/", fetchJson: http, now: () => NOW });
    const quotes = await p.fetchQuotes([r("USDT", "IDR"), r("BTC", "IDR"), r("SOL", "IDR"), r("BTC", "USDT")]);
    expect(calls.map((c) => c.url)).toEqual(["https://indodax.com/api/summaries", "https://indodax.com/api/ticker/solidr"]);
    expect(quotes).toHaveLength(3);
    const usdt = quotes.find((q) => q.base === "USDT")!;
    expect(usdt.price).toBe(17980);
    expect(usdt.change24hPct).toBeCloseTo((17980 / 17870 - 1) * 100, 10);
    expect(usdt.updatedAt).toBe(new Date(1790646415 * 1000).toISOString());
    expect(usdt.source).toBe("indodax");
    expect(quotes.find((q) => q.base === "BTC")!.price).toBe(1_492_100_000);
    const sol = quotes.find((q) => q.base === "SOL")!;
    expect(sol.price).toBe(2_106_942);
    expect(sol.change24hPct).toBeNull(); // ticker endpoint has no 24 h reference
  });

  it("uses per-pair tickers when /summaries fails, and rejects only when everything fails", async () => {
    const boom = () => { throw new MarketHttpError("http", "HTTP 502 from https://indodax.com/api/summaries", { url: "https://indodax.com/api/summaries", status: 502 }); };
    const { http } = fakeHttp([["/summaries", boom], ["/ticker/usdtidr", { ticker: { last: "17980", server_time: 1790646406 } }]]);
    const p = new IndodaxProvider({ baseUrl: "https://indodax.com/api", fetchJson: http, now: () => NOW });
    const quotes = await p.fetchQuotes([r("USDT", "IDR"), r("ETH", "IDR")]);
    expect(quotes.map((q) => q.base)).toEqual(["USDT"]);

    const { http: allFail } = fakeHttp([["/summaries", boom]]);
    const p2 = new IndodaxProvider({ baseUrl: "https://indodax.com/api", fetchJson: allFail });
    await expect(p2.fetchQuotes([r("USDT", "IDR")])).rejects.toThrow(/HTTP 502/);
  });

  it("supports only <crypto>/IDR", () => {
    const p = new IndodaxProvider({ baseUrl: "https://indodax.com/api" });
    expect(p.supports("USDT", "IDR")).toBe(true);
    expect(p.supports("SOL", "IDR")).toBe(true);
    expect(p.supports("IDR", "USDT")).toBe(false);
    expect(p.supports("BTC", "USDT")).toBe(false);
  });
});

/* Recorded 2026-09-29 from https://api.coingecko.com/api/v3/simple/price. */
const COINGECKO = {
  bitcoin: { usd: 82923, usd_24h_change: -1.0817604242287466, btc: 0.99975824, btc_24h_change: 0.05218344138544058, idr: 1492622760, idr_24h_change: -0.7789902740740867, last_updated_at: 1790646340 },
  ethereum: { usd: 2662.41, usd_24h_change: -0.12300243174180997, btc: 0.03209947, btc_24h_change: 1.0219321040344402, idr: 47923992, idr_24h_change: 0.18270229653104042, last_updated_at: 1790646340 },
  solana: { usd: 116.85, usd_24h_change: -3.451611693267825, btc: 0.00140884, btc_24h_change: -2.3448344889333885, idr: 2103368, idr_24h_change: -3.1560952126856066, last_updated_at: 1790646340 },
  tether: { usd: 0.999704, usd_24h_change: -0.010286308943122366, btc: 1.205e-5, btc_24h_change: 1.1359403419834873, idr: 17994.87, idr_24h_change: 0.2957634222085755, last_updated_at: 1790646340 },
};

describe("CoinGeckoProvider", () => {
  it("parses the recorded /simple/price response", async () => {
    const { http, calls } = fakeHttp([["/simple/price", COINGECKO]]);
    const p = new CoinGeckoProvider({ baseUrl: "https://api.coingecko.com/api/v3", fetchJson: http, now: () => NOW });
    const quotes = await p.fetchQuotes([r("BTC", "USD"), r("ETH", "BTC"), r("USDT", "IDR"), r("USDT", "USD"), r("BTC", "USDT"), r("BTC", "BTC")]);
    expect(calls[0].url).toBe("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin%2Cethereum%2Ctether&vs_currencies=usd%2Cbtc%2Cidr&include_24hr_change=true&include_last_updated_at=true");
    expect(calls[0].headers).toBeUndefined();
    expect(quotes).toEqual([
      { base: "BTC", quote: "USD", price: 82923, change24hPct: -1.0817604242287466, updatedAt: new Date(1790646340 * 1000).toISOString(), source: "coingecko" },
      { base: "ETH", quote: "BTC", price: 0.03209947, change24hPct: 1.0219321040344402, updatedAt: new Date(1790646340 * 1000).toISOString(), source: "coingecko" },
      { base: "USDT", quote: "IDR", price: 17994.87, change24hPct: 0.2957634222085755, updatedAt: new Date(1790646340 * 1000).toISOString(), source: "coingecko" },
      { base: "USDT", quote: "USD", price: 0.999704, change24hPct: -0.010286308943122366, updatedAt: new Date(1790646340 * 1000).toISOString(), source: "coingecko" },
    ]);
  });

  it("does not claim X/USDT (not a vs_currency) and picks the demo vs pro key header by host", async () => {
    const demo = new CoinGeckoProvider({ baseUrl: "https://api.coingecko.com/api/v3", apiKey: "demo-key" });
    expect(demo.supports("BTC", "USDT")).toBe(false);
    expect(demo.supports("BTC", "USD")).toBe(true);
    expect(demo.supports("SOL", "IDR")).toBe(true);
    expect(demo.supports("IDR", "BTC")).toBe(false);

    const { http, calls } = fakeHttp([["/simple/price", COINGECKO]]);
    await new CoinGeckoProvider({ baseUrl: "https://api.coingecko.com/api/v3", apiKey: "demo-key", fetchJson: http }).fetchQuotes([r("BTC", "USD")]);
    await new CoinGeckoProvider({ baseUrl: "https://pro-api.coingecko.com/api/v3", apiKey: "pro-key", fetchJson: http }).fetchQuotes([r("BTC", "USD")]);
    expect(calls[0].headers).toEqual({ "x-cg-demo-api-key": "demo-key" });
    expect(calls[1].headers).toEqual({ "x-cg-pro-api-key": "pro-key" });
  });
});

/* Documented shape (docs.tronscan.org); the live endpoint was IP-throttled during development. */
const TRONSCAN_OK = {
  total: 1,
  trc20_tokens: [
    {
      symbol: "USDT",
      contract_address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      market_info: { fPrecision: 2, fShortName: "USDT", gain: "-0.0002", pairId: 1, priceInTrx: 6.21, priceInUsd: 0.9997, sPrecision: 6 },
    },
  ],
};
/* Recorded 2026-09-29 (unauthenticated, throttled). */
const TRONSCAN_THROTTLED = { Error: "request rate exceeded the allowed_rps(3), and the query server is suspended for 19 s. …" };

describe("TronScanProvider", () => {
  it("is disabled without a key: supports() false, fetchQuotes() [] and no HTTP call", async () => {
    const { http, calls } = fakeHttp([["token_trc20", TRONSCAN_OK]]);
    const p = new TronScanProvider({ baseUrl: "https://apilist.tronscanapi.com/api", fetchJson: http });
    expect(p.enabled).toBe(false);
    expect(p.supports("USDT", "USD")).toBe(false);
    expect(await p.fetchQuotes([r("USDT", "USD")])).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("with a key: sends TRON-PRO-API-KEY and parses market_info.priceInUsd (+ gain ratio → %)", async () => {
    const { http, calls } = fakeHttp([["token_trc20", TRONSCAN_OK]]);
    const p = new TronScanProvider({ baseUrl: "https://apilist.tronscanapi.com/api", apiKey: "tron-key", fetchJson: http, now: () => NOW });
    expect(p.supports("USDT", "USD")).toBe(true);
    expect(p.supports("BTC", "USD")).toBe(false);
    const quotes = await p.fetchQuotes([r("USDT", "USD"), r("BTC", "USDT")]);
    expect(calls[0].url).toBe("https://apilist.tronscanapi.com/api/token_trc20?contract=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t&showAll=1");
    expect(calls[0].headers).toEqual({ "TRON-PRO-API-KEY": "tron-key" });
    expect(quotes).toEqual([{ base: "USDT", quote: "USD", price: 0.9997, change24hPct: expect.closeTo(-0.02, 10), updatedAt: new Date(NOW).toISOString(), source: "tronscan" }]);
    expect(await p.fetchQuotes([r("BTC", "USDT")])).toEqual([]);
  });

  it("treats an { Error } body as a failure whose message never contains the key", async () => {
    const { http } = fakeHttp([["token_trc20", TRONSCAN_THROTTLED]]);
    const p = new TronScanProvider({ baseUrl: "https://apilist.tronscanapi.com/api", apiKey: "tron-secret", fetchJson: http });
    const err = await p.fetchQuotes([r("USDT", "USD")]).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MarketHttpError);
    expect(describeError(err)).toMatch(/^TronScan error \(request rate exceeded/);
    expect(describeError(err)).not.toContain("tron-secret");
  });
});

describe("fetchJson / http helpers", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("times out via AbortController and reports a message without the query string", async () => {
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise((_, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })));
    const err = await fetchJson("https://api.example.com/v1/price?api_key=SECRET-XYZ", { timeoutMs: 10 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MarketHttpError);
    expect((err as MarketHttpError).kind).toBe("timeout");
    expect((err as MarketHttpError).message).toBe("Request timed out after 10ms: https://api.example.com/v1/price");
    expect((err as MarketHttpError).message).not.toContain("SECRET");
  });

  it("turns a non-2xx into an http error with a short hint from known message fields", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: -1121, msg: "Invalid symbol." }), { status: 400 })));
    const err = (await fetchJson("https://x/api/v3/ticker/24hr?symbols=%5B%22FOO%22%5D").catch((e: unknown) => e)) as MarketHttpError;
    expect(err.kind).toBe("http");
    expect(err.status).toBe(400);
    expect(err.message).toBe("HTTP 400 from https://x/api/v3/ticker/24hr (Invalid symbol.)");

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(TRONSCAN_THROTTLED), { status: 429 })));
    const throttled = (await fetchJson("https://t/api/token_trc20").catch((e: unknown) => e)) as MarketHttpError;
    expect(throttled.message).toMatch(/^HTTP 429 from https:\/\/t\/api\/token_trc20 \(request rate exceeded/);
  });

  it("classifies invalid JSON, network failures and an already-aborted signal; passes headers", async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => new Response("<html>", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const parse = (await fetchJson("https://x/p", { headers: { "X-K": "v" } }).catch((e: unknown) => e)) as MarketHttpError;
    expect(parse.kind).toBe("parse");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: { accept: "application/json", "X-K": "v" }, cache: "no-store" });

    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    expect(((await fetchJson("https://x/p").catch((e: unknown) => e)) as MarketHttpError).kind).toBe("network");

    const ac = new AbortController();
    ac.abort();
    expect(((await fetchJson("https://x/p", { signal: ac.signal }).catch((e: unknown) => e)) as MarketHttpError).kind).toBe("aborted");

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: 1 }), { status: 200 })));
    await expect(fetchJson("https://x/p")).resolves.toEqual({ ok: 1 });
  });

  it("parsing helpers are defensive", () => {
    expect(toPositiveNumber("17980")).toBe(17980);
    expect(toPositiveNumber("0")).toBeNull();
    expect(toPositiveNumber("abc")).toBeNull();
    expect(toPositiveNumber(-1)).toBeNull();
    expect(epochToIso(1790646406, NOW)).toBe(new Date(1790646406 * 1000).toISOString()); // seconds
    expect(epochToIso(1790646400012, NOW)).toBe(new Date(1790646400012).toISOString()); // millis
    expect(epochToIso("junk", NOW)).toBe(new Date(NOW).toISOString());
    expect(epochToIso(NOW + 10 * 86_400_000, NOW)).toBe(new Date(NOW).toISOString()); // far future → now
    expect(safeUrl("not a url")).toBe("<invalid-url>");
  });
});
