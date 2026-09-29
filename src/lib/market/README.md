# Market data layer

Server-side provider chain → rate engine → in-memory snapshot → JSON + SSE → client hook/context.

## Data flow

```
                       ┌──────────────── server (Node runtime) ────────────────┐
  Binance-compatible ──┤  ExchangeProvider   ┐                                   │
  Indodax ─────────────┤  IndodaxProvider    ├─ CompositeProvider.fetchAll()     │
  CoinGecko ───────────┤  CoinGeckoProvider  │   pass 1: primaries in parallel   │
  TronScan (key only) ─┤  TronScanProvider   │   pass 2: per-pair fallback       │
  (dev only) ──────────┤  MockProvider       ┘   → { quotes, errors }            │
                       │            │                                            │
                       │            ▼                                            │
                       │  service.ts  merge: fresh real ▸ last-good real ▸ mock  │
                       │             cache MARKET_REFRESH_INTERVAL_MS, 1 in-flight│
                       │             buildSnapshot() ← rates.ts (pure engine)    │
                       │            │                                            │
                       │   ┌────────┴─────────┐                                  │
                       │   ▼                  ▼                                  │
                       │ GET /api/market   GET /api/market/stream (SSE)          │
                       └───┬──────────────────┬───────────────────────────────────┘
                           │ immediate fetch  │ event: snapshot every PUSH_INTERVAL
                           ▼                  ▼
                     useMarketFeed()  ── status recomputed on a 10 s client clock
                           │            (stream fails N× → poll /api/market)
                           ▼
                     <MarketProvider> → useMarket() → sections / rate checker
```

## Files

| file | role |
|---|---|
| `types.ts` | shared domain types (`MarketQuote`, `IndicativeRate`, `MarketSnapshot`, `MarketDataProvider`) |
| `http.ts` | `fetchJson()` with hard timeout + typed `MarketHttpError` (messages never contain keys/query strings); number/epoch parsing helpers |
| `rates.ts` | **pure** rate engine: `resolveMarketPrice`, `computeIndicativeRates`, `calculateReceive`, `computeStatus`, `buildSnapshot` — safe on the client |
| `providers/exchange.ts` | Binance-compatible `/api/v3/ticker/24hr` (batch, with per-symbol fallback on HTTP 400) |
| `providers/indodax.ts` | `/summaries` (one call, 24 h change from `prices_24h`) with `/ticker/<pair>` fallback |
| `providers/coingecko.ts` | `/simple/price` for X/USD, X/BTC, X/IDR (optional demo/pro key header) |
| `providers/tronscan.ts` | USDT (TRC20) `market_info.priceInUsd` → USDT/USD; enabled only with `TRONSCAN_API_KEY` |
| `providers/mock.ts` | seeded random walk, `source: "mock"`, dev only |
| `providers/composite.ts` | ordered chain, per-pair fallback, per-provider deadline + error isolation |
| `providers/index.ts` | `buildProviderChain(serverConfig)` from `MARKET_PROVIDERS` |
| `service.ts` | server-only cache: `getMarketSnapshot({ force? })`, `getCachedSnapshot()`; never throws |
| `../../app/api/market/route.ts` | JSON endpoint (`force-dynamic`, `Cache-Control: no-store`) |
| `../../app/api/market/stream/route.ts` | SSE endpoint (snapshot every `MARKET_STREAM_PUSH_INTERVAL_MS`, heartbeat comments) |
| `../../hooks/useMarketFeed.ts` | client transport (fetch → EventSource → polling fallback) + age-based status |
| `../../providers/MarketProvider.tsx` | React context `useMarket()` with memoised `getRate` / `getQuote` |

## Environment variables (server-only, see `.env.example`)

| variable | default | meaning |
|---|---|---|
| `MARKET_PROVIDERS` | `exchange,indodax,coingecko,tronscan` | ordered chain; first provider that supports a pair **and answers** wins |
| `MARKET_EXCHANGE_API_URL` | `https://data-api.binance.vision` | Binance-compatible REST base URL |
| `MARKET_DATA_API_KEY` | – | sent as `X-MBX-APIKEY` only when set |
| `COINGECKO_API_URL` | `https://api.coingecko.com/api/v3` | use `https://pro-api.coingecko.com/api/v3` with a pro key |
| `COINGECKO_API_KEY` | – | `x-cg-demo-api-key`, or `x-cg-pro-api-key` when the URL host contains `pro-api` |
| `INDODAX_API_URL` | `https://indodax.com/api` | public, no key |
| `TRONSCAN_API_URL` | `https://apilist.tronscanapi.com/api` | |
| `TRONSCAN_API_KEY` | – | `TRON-PRO-API-KEY`; **without it the provider is disabled** (unauthenticated calls are IP-throttled at 3 rps) |
| `ALLOW_MOCK_MARKET_DATA` | `false` | production only honours mock when this is `true`; outside production mock is always appended last |
| `EXCHANGE_SPREAD` | `0.05` | our rate = market + spread (on the received asset) |

Timing constants (public) live in `src/config/market.ts`.

## Which provider quotes what

| pair | exchange (Binance) | indodax | coingecko | tronscan |
|---|---|---|---|---|
| BTC/USDT, ETH/USDT, SOL/USDT | ✓ | | | |
| ETH/BTC, SOL/BTC | ✓ | | ✓ | |
| USDT/IDR, BTC/IDR, ETH/IDR, SOL/IDR | | ✓ | ✓ | |
| BTC/USD, ETH/USD, SOL/USD | ✓ | | ✓ | |
| USDT/USD | ✓ | | ✓ | ✓ (key) |

The service requests BTC/USDT, ETH/BTC, SOL/BTC, USDT/IDR, ETH/USDT, SOL/USDT, BTC/USD, ETH/USD, SOL/USD, USDT/USD (required) and BTC/IDR (optional).
The rate engine prefers a direct quote, then the inverse, then a cross via USDT → USD → BTC, then a mixed USDT≈USD bridge (`derived: true`, `updatedAt` = oldest leg).

## Status semantics

* `snapshot.updatedAt` = last time any provider answered successfully. The service **never** re-labels retained (last-good) quotes as fresh.
* `status` = `live` (< 90 s) · `stale` (< 5 min) · `unavailable` — computed from that age on the server *and again on the client* every 10 s, so a silent server cannot leave prices looking live.
* `snapshot.error` is a short safe string (`"indodax: HTTP 503 from https://indodax.com/api/summaries"`), null when healthy. Partial failures keep `status: live` for the pairs that did refresh; each `IndicativeRate.updatedAt` carries its own age.
* `snapshot.sources` lists contributing providers; `"mock"` present ⇒ show the dev badge (`t.common.devMockData`).

## Adding or replacing a provider

1. Create `providers/<name>.ts` implementing `MarketDataProvider`:
   * `name` — the `source` written on every quote.
   * `supports(base, quote)` — **static and honest**: only pairs the API really lists.
   * `fetchQuotes(requests, signal)` — return only the requested pairs you could parse (omit the rest; the next provider fills them). Reject **only** on transport-level failure. Use `fetchJson()` from `http.ts` (timeout, typed errors) and the `toPositiveNumber` / `epochToIso` helpers. Put API keys in headers, never in the URL.
2. Add the name to `MarketProviderName` and `parseProviderList()` in `src/config/server.ts`, plus its env vars.
3. Wire it in `providers/index.ts` (`createProvider`).
4. Before coding, `curl` the public endpoint and paste the observed shape in the file header; add a parsing test in `__tests__/providers.test.ts` with that fixture.
5. Set `MARKET_PROVIDERS` to the desired priority order.

Replacing the exchange API: point `MARKET_EXCHANGE_API_URL` at any Binance-compatible host. Unknown symbols make the batch call fail with HTTP 400; the provider then retries symbol-by-symbol and keeps what answers.

## Testing

```
npx vitest run src/lib/market/__tests__
```

* `rates.test.ts` — exact numbers for all four pairs, bridge order, inverse/cross change math, spread-direction mutation guard.
* `composite.test.ts` — parallel primaries, per-pair fallback, error isolation, deadline, abort.
* `service.test.ts` — cache/in-flight dedupe, last-good retention, stale/unavailable decay, production-never-mock, dev mock gap-fill, chain building.
* `providers.test.ts` — parsers against recorded real responses (Binance, Indodax, CoinGecko, TronScan), key headers, 400 fallback.
* `routes.test.ts` — JSON + SSE handlers (headers, frame format, abort).
* `useMarketFeed.test.tsx` — stream → polling fallback, age-based status, offline/online, StrictMode, cleanup.
