# Cryptix — Crypto Exchange Inquiry Website

A production-quality **crypto exchange information & lead-generation website**. Visitors can:

1. View live/latest crypto market prices.
2. Check an **indicative** exchange rate (market price + configurable spread, default 5 %).
3. Pick one of the supported exchange pairs and enter an amount to see an estimated receive amount.
4. Submit an exchange **request** through a form.
5. Contact the exchange team directly through WhatsApp (contextual pre-filled messages).

The actual exchange is handled **manually by the exchange team** outside the website. There is no login, wallet, custody, deposit, withdrawal, order book, payment gateway or automated execution — by design.

Stack: **Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · Framer Motion · zod · Vitest**.

---

## Quick start

```bash
npm install
cp .env.example .env.local   # then edit the values
npm run dev                  # http://localhost:3000
```

Other scripts:

```bash
npm run build       # production build
npm run start       # serve the production build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # vitest (unit + component tests)
npm run check       # typecheck + lint + test
```

## Configuration (environment variables)

All configuration is centralised: **`src/config/site.ts`** (brand, build-time fallbacks for the contact details), **`src/config/runtime.server.ts`** (runtime contact details: WhatsApp number + public e-mail, read per request), **`src/config/exchange.ts`** (currencies, the supported pairs, limits, default spread), **`src/config/market.ts`** (refresh / stale thresholds) and **`src/config/server.ts`** (server-only secrets and provider chain). Nothing sensitive is hardcoded; see `.env.example`.

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_BRAND_NAME` | public | Brand name (default `Cryptix`). Change once, applies everywhere. |
| `NEXT_PUBLIC_SITE_URL` | public | Canonical URL for metadata, sitemap, robots, Open Graph. |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | public | `en` (default) or `id`. |
| `WHATSAPP_NUMBER` | **runtime** | WhatsApp number, international format; non-digits are stripped (`+62 823-1760-0972` → `6282317600972`). Read by the server on **every request** and passed to the page through `<RuntimeConfigProvider>`, so every WhatsApp link follows it: **edit the env file and restart the service — no rebuild, no deploy.** Empty = WhatsApp CTAs fall back to the contact form. |
| `PUBLIC_CONTACT_EMAIL` | **runtime** | E-mail shown in the footer / contact section (same runtime semantics). Empty = not shown. |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | public | Build-time **fallback** for `WHATSAPP_NUMBER` (dev convenience). Inlined at build time — changing it needs a rebuild. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | public | Build-time **fallback** for `PUBLIC_CONTACT_EMAIL`. Inlined at build time. |
| `EXCHANGE_SPREAD` | server | Spread applied on top of the market price (`0.05` = 5 %). Sent to the client inside the market snapshot. |
| `MARKET_PROVIDERS` | server | Ordered provider chain, e.g. `exchange,indodax,coingecko,tronscan`. |
| `MARKET_EXCHANGE_API_URL` | server | Binance-compatible public market REST base URL. |
| `MARKET_DATA_API_KEY` | server | Optional key for the exchange provider. |
| `COINGECKO_API_URL` / `COINGECKO_API_KEY` | server | CoinGecko fallback (key optional). |
| `INDODAX_API_URL` | server | Indodax public API (USDT/IDR and other IDR pairs). |
| `TRONSCAN_API_URL` / `TRONSCAN_API_KEY` | server | TronScan (USDT TRC20 token market info → USDT/USD reference). |
| `ALLOW_MOCK_MARKET_DATA` | server | `true` to allow the mock provider in production (never recommended). Outside production the mock fills only pairs real providers could not supply. |
| `CONTACT_EMAIL` | server | Where leads are emailed (when an email channel is configured). Falls back to `PUBLIC_CONTACT_EMAIL`, then `NEXT_PUBLIC_CONTACT_EMAIL`. |
| `LEAD_WEBHOOK_URL` / `LEAD_WEBHOOK_SECRET` | server | Optional JSON webhook for leads (HMAC-SHA256 signature header). |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | server | Optional transactional email via Resend. |
| `FORM_RATE_LIMIT_MAX` / `FORM_RATE_LIMIT_WINDOW_MS` / `FORM_MIN_FILL_TIME_MS` | server | Form abuse protection (a too-fast submission is delivered but flagged as suspicious; the honeypot is dropped silently). |
| `TRUSTED_PROXY_HOPS` | server | How many reverse proxies / platform edges sit in front of the app (default 1). Only the right-most entries of `X-Forwarded-For` are trusted for the rate-limit key. |
| `IP_HASH_SECRET` | server | Key for the pseudonymous IP hash in lead logs (random per process when unset). |
| `NEXT_DIST_DIR` | build | Optional build output directory (e.g. `.next-build`) so a production build never clobbers a running dev server. |

If no lead channel is configured, submissions are logged to the server console in **development** so the site works out of the box. In **production** a missing channel is a hard error: the API answers `delivery_failed` rather than telling a visitor a request was received that nobody will read.

## Architecture

```
MarketDataProvider (interface)
   ├─ ExchangeProvider   Binance-compatible public REST (BTC/USDT, ETH/BTC, SOL/BTC, …)
   ├─ IndodaxProvider    USDT/IDR (+ */IDR)
   ├─ CoinGeckoProvider  fallback for */USD, */BTC, */IDR
   ├─ TronScanProvider   USDT (TRC20) token market info → USDT/USD
   └─ MockProvider       development-only fallback, clearly labelled "mock"
            ↓ CompositeProvider (ordered chain, per-pair fallback, error isolation)
            ↓ service.ts  (server cache, in-flight dedupe, live / stale / unavailable status)
            ↓ rates.ts    (pair normalisation → cross rates → + spread → indicative rate)
            ↓ GET /api/market (JSON)  ·  GET /api/market/stream (Server-Sent Events)
            ↓ useMarketFeed → <MarketProvider> → useMarket()  (SSE first, polling fallback, client-side staleness clock)
            ↓ Rate checker · Live market · Supported pairs · Exchange request modal
```

* **Rate math** (`src/lib/market/rates.ts`, fully unit-tested): `ourRate = marketRate / (1 + spread)` in "receive per send" units, i.e. the customer always pays *market price + spread* on the asset they receive. Cross pairs prefer a direct quote (e.g. `ETHBTC`) and otherwise derive `ETH/USD ÷ BTC/USD` (marked `derived`). Display follows market convention per pair (`1 BTC = 105,000 USDT`, `1 SOL = 0.00164 BTC`, `1 USDT = Rp15,700`).
* **Realtime**: the server polls providers on a short TTL and pushes snapshots over SSE; the client falls back to polling if the stream cannot connect, and computes `live / stale / unavailable` from the snapshot age itself so stale prices are never shown as live.
* **Forms** (`POST /api/contact`, `POST /api/exchange-request`): shared zod schemas (language-neutral error codes mapped to EN/ID messages on the client), sanitisation, per-IP rate limiting, honeypot + timing spam heuristics, body-size limits, lead delivery (webhook / Resend / console).
* **i18n**: cookie-persisted locale (`cryptix_locale`), server-rendered in the visitor's language, dictionaries in `src/lib/i18n/dictionaries/{en,id}` with a parity test that also bans misleading phrases ("trade now", "instantly", "guaranteed", "licensed", …).
* **WhatsApp**: one utility (`src/lib/whatsapp.ts`) builds `https://wa.me/<number>?text=<encoded>` with localized, contextual messages (pair, amount, estimated receive, request reference).

See `docs/ARCHITECTURE.md` and `docs/DESIGN.md` for the full contracts and the visual system.

## Adding or replacing a market data provider

1. Implement `MarketDataProvider` (`src/lib/market/types.ts`): `name`, `supports(base, quote)`, `fetchQuotes(requests)`.
2. Register it in `src/lib/market/providers/index.ts` and add its name to `MARKET_PROVIDERS`.
3. Keep secrets in `src/config/server.ts` (env vars only). Never import server modules from client components.

## Deployment notes

* Any Node.js host that supports Next.js 16 (Vercel, a VPS with `npm run build && npm run start`, Docker).
* Set `NEXT_PUBLIC_SITE_URL` to the public URL before building (public `NEXT_PUBLIC_*` vars are inlined at build time).
* The WhatsApp number and the public e-mail are **runtime** values (`WHATSAPP_NUMBER`, `PUBLIC_CONTACT_EMAIL`): change them in the env file and restart the service — no rebuild. See `docs/DEPLOY-DEWAWEB.md` → "Mengganti nomor WhatsApp".
* The in-memory rate limiter and market cache are per instance; for multi-instance deployments plug a shared store into `src/lib/security/rate-limit.ts` (documented seam).

## Decisions & known limitations

* **Spread direction.** The customer always pays market + spread on the asset they *receive* (`ourRate = marketRate / (1 + spread)`), in every direction. For USDT → BTC that displays as "1 BTC = 105,000 USDT" when market is 100,000; for BTC → USDT it displays as "1 BTC = 95,238 USDT". Change `EXCHANGE_SPREAD` to tune the size, and `src/lib/market/rates.ts` if the business ever wants a different convention.
* **Pairs.** Eight pairs are selectable (the four featured customer-facing pairs plus their reverse directions, which the converter's swap button needs). Marketing sections show the featured four; `FEATURED_PAIRS` / `featured: true` in `src/config/exchange.ts` control that.
* **Hero CTAs.** The hero keeps "Check live rate" (scrolls to the converter) + "Chat on WhatsApp" as specified by the client; "Request exchange" is the main CTA everywhere else (navbar, converter, FAQ, modal).
* **Locale & SEO.** The language is a cookie preference on a single URL; search engines index the default locale only. If Indonesian discoverability matters, add a crawlable `/id` variant and `hreflang` alternates.
* **Market data is single-sourced per pair** (first provider that answers wins, with fallback and age-based staleness); there is no cross-provider price comparison. The Security section copy says exactly that.
* **Realtime transport** is Server-Sent Events (works on any Node host and the App Router) with polling fallback; a WebSocket transport can replace `useMarketFeed` without touching consumers. Serverless hosts keep a function alive per open stream.
* **Rate limiting and the market cache** are in-memory per instance; multi-instance deployments should plug a shared store into `src/lib/security/rate-limit.ts`.
