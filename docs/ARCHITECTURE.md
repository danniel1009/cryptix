# Cryptix — Architecture & Ownership Contract

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · Framer Motion 13 · zod 4 · Vitest.

**What this site is:** a crypto exchange *information & lead-generation* website. Visitors check
live market prices, calculate an indicative rate (market + spread), and submit an exchange
*request*. The exchange itself is done manually by the team over WhatsApp/email.

**What it is NOT (never build):** login/registration, wallets, deposits/withdrawals, payments,
order books, balances, transaction history, KYC, trading dashboards, automated execution.
Never use copy such as "Trade now", "Buy instantly", "Sell instantly", "Automatic exchange",
"Transaction successful", "100% secure", "Bank-grade", "Guaranteed", "Licensed".

The process the whole site communicates: **CHECK RATE → REQUEST EXCHANGE → CONTACT OUR TEAM → MANUAL EXCHANGE**.
Main CTA wording: **Request Exchange** (never Trade/Buy/Sell/Execute).

## Directory layout

```
src/
  app/
    layout.tsx                 root layout: fonts, providers, metadata (locale-aware)
    page.tsx                   single-page composition of all sections (ids = nav anchors)
    globals.css                design tokens + Tailwind v4 @theme + utilities
    icon.svg                   favicon (logo mark)
    opengraph-image.tsx        OG image
    api/market/route.ts        GET  → MarketSnapshot (JSON, no-store)
    api/market/stream/route.ts GET  → Server-Sent Events stream of MarketSnapshot
    api/contact/route.ts       POST → contact message
    api/exchange-request/route.ts POST → exchange request
  config/
    site.ts        brand name, URLs, WhatsApp number, contact email, default locale, NAV_ITEMS
    exchange.ts    CURRENCIES, SUPPORTED_PAIRS (the ONLY 4 pairs), DEFAULT_EXCHANGE_SPREAD, limits
    market.ts      public timing constants (refresh/stale/unavailable thresholds)
    server.ts      server-only: env-backed secrets, spread, provider chain, lead delivery, limits
  lib/
    utils.ts                 cn(), clamp(), sleep()
    market/                  provider abstraction, providers, rate engine, service (server)
    i18n/                    types, format, provider (client), server, dictionaries/{en,id}/<ns>.ts
    validation/              zod schemas shared by client + API routes (error CODES, not text)
    security/                rate-limit, sanitize, spam heuristics, client-ip
    leads/                   lead delivery (webhook / email / console)
    whatsapp.ts              single WhatsApp utility (URL + localized pre-filled messages)
  providers/
    ExchangeRequestProvider.tsx  modal state + prefill (DONE)
    MarketProvider.tsx           client market feed context (useMarket)
  hooks/                     client hooks (useMarketFeed, useScrollSpy, useMediaQuery …)
  components/
    ui/                      primitives: Button, Card, Badge, Input, Select, Textarea, Checkbox,
                             Section, Container, Eyebrow, Reveal, AnimatedNumber, LiveIndicator,
                             Accordion, Modal, Logo, CurrencyIcon, Tooltip
    layout/                  Navbar, MobileMenu, LanguageSwitcher, Footer, WhatsAppFloat
    sections/                Hero, RateChecker, LiveMarket, HowItWorks, WhyChooseUs,
                             SupportedPairs, Security, Faq, Contact
    exchange/                ExchangeRequestModal (form + success state)
```

## Fixed contracts (already written — build against these, do not change signatures)

### Config
- `siteConfig` (`@/config/site`): `name`, `url`, `whatsappNumber` (digits only, may be ""), `contactEmail`, `defaultLocale`, `copyrightYear`, `nav` (NAV_ITEMS: `{id, href}`; label = `t.nav[id]`).
- `@/config/exchange`: `CurrencyCode`, `CURRENCIES`, `PairId`, `ExchangePair {id, from, to, quoteBase}`, `SUPPORTED_PAIRS`, `DEFAULT_PAIR_ID`, `DEFAULT_EXCHANGE_SPREAD`, `AMOUNT_LIMITS`, `MARKET_DISPLAY_PAIRS`, helpers `getPairById`, `isPairId`, `isCurrencyCode`, `findPair`, `getSendableCurrencies`, `getReceivableCurrencies`, `pairLabel`.
- `@/config/market`: timing constants.
- `@/config/server` (server-only): `serverConfig.exchange.spread`, `serverConfig.market.*`, `serverConfig.leads.*`, `serverConfig.security.*`.

### Market types (`@/lib/market/types`)
`MarketSymbol`, `PairRequest`, `MarketQuote`, `MarketStatus = "live" | "stale" | "unavailable"`, `IndicativeRate`, `MarketSnapshot`, `MarketDataProvider`, `pairKey()`.

Rate convention: `IndicativeRate.marketRate` / `ourRate` are **units of `to` per 1 `from`**, so
`receive = amount * ourRate`. Spread is applied so the customer always pays market + spread on the
asset they receive: `ourRate = marketRate / (1 + spread)`. Display fields
(`marketPriceDisplay`, `ourPriceDisplay`) express the same in the pair's conventional direction
(`quoteBase`): USDT→BTC shows "1 BTC = 100,000 USDT → our 105,000 USDT"; SOL→BTC shows
"1 SOL = 0.00172 BTC → our 0.00163810 BTC"; USDT→IDR shows "1 USDT = Rp16,485 → our Rp15,700".
Cross pairs: prefer a direct quote (ETHBTC), else derive `ETH/USD ÷ BTC/USD` (USDT ≈ USD bridge allowed, mark `derived: true`).

### i18n (`@/lib/i18n/*`)
- `useI18n()` (client) → `{ locale, setLocale, t, formatNumber, formatAmount, formatPrice, formatPercent, formatSpread, formatTime, formatDateTime, formatRelativeTime }`.
- `t` is `Dictionary = typeof en`. Namespaces are separate files: `dictionaries/en/<ns>.ts` exports `export const <ns> = {...}` (**no `as const`**), `dictionaries/id/<ns>.ts` exports `export const <ns>: typeof en = {...}` (typed against the English file). Both `index.ts` files list every namespace.
- Placeholders use `{name}`; replace with `interpolate(template, vars)` from `@/lib/i18n/dictionaries`.
- Server: `getServerLocale()`, `getServerDictionary()` from `@/lib/i18n/server`.
- Persisted in cookie `cryptix_locale` + localStorage; layout reads the cookie so SSR renders the right language.
- Number formatting: use the `useI18n()` formatters (en: 1,000.00 · id: 1.000,00). `parseAmountInput()` in `@/lib/i18n/format` accepts both conventions.

### Exchange request modal state (`@/providers/ExchangeRequestProvider`)
`useExchangeRequest()` → `{ isOpen, prefill, open(prefill?), close() }`, `prefill = { pairId?, amount?, estimatedReceive? }` (numbers, unformatted).

### Market client context (`@/providers/MarketProvider`)
`useMarket()` → `{ snapshot, connection: "connecting"|"live"|"reconnecting"|"polling"|"offline", status: MarketStatus, lastUpdatedAt: Date|null, isStale, refresh(), getRate(pairId), getQuote(base, quote) }`.
UI rule: `status === "live"` → "● LIVE"; connection reconnecting/polling with fresh data → still LIVE data but show "○ RECONNECTING" on the connection indicator; `status === "stale"` → show "Last updated X minutes ago" and grey the prices; `status === "unavailable"` → "Market data temporarily unavailable" and hide/disable estimates (never show old prices as live).

### WhatsApp (`@/lib/whatsapp`)
`isWhatsAppConfigured()`, `buildWhatsAppUrl(message?)` → `https://wa.me/<digits>?text=<encoded>`,
`buildExchangeInquiryMessage({ locale, pair, amount, estimatedReceive, reference? })`,
`buildGeneralInquiryMessage(locale)`. Templates come from `t.whatsapp` (see `dictionaries/en/whatsapp.ts`). Amounts are formatted with the locale (`1,000 USDT` / `1.000 USDT`, `0.009 BTC` / `0,009 BTC`).

### Forms API contract (client ↔ `/api/contact`, `/api/exchange-request`)
Request JSON: form fields + `hp` (honeypot, must be empty) + `ts` (form render timestamp ms).
Responses:
- `200 { ok: true, reference: "CX-XXXXXX" }`
- `400 { ok: false, code: "validation_error", errors: { [field]: <ValidationErrorCode> } }`
- `429 { ok: false, code: "rate_limited", retryAfterSeconds }`
- `500 { ok: false, code: "delivery_failed" }`
Error codes are language-neutral; the client maps them via `t.validation[code]` / `t.form.errors[code]`.
Shared zod schemas in `@/lib/validation/schemas` (`contactSchema`, `exchangeRequestSchema`, `ValidationErrorCode`, `validate*()` helpers) are used on BOTH client (instant feedback) and server (authority).

## Conventions
- Client components start with `"use client"`. Server-only modules import `"server-only"`.
- Path alias `@/` → `src/`. Tailwind v4: tokens in `globals.css` via `@theme inline`; use semantic classes (`bg-surface`, `text-accent`, `border-line` …) defined there.
- Animations: Framer Motion, subtle; respect `prefers-reduced-motion` (use `useReducedMotion`).
- Accessibility: semantic landmarks, labelled inputs, focus-visible rings, `aria-live` for dynamic results, keyboard-operable menus/modal/accordion.
- No secrets client-side. No `process.env.*` in client code other than `NEXT_PUBLIC_*` via `siteConfig`.
- Every user-visible string comes from the dictionary. No hardcoded English in components (brand name and currency codes/names excepted).
- Verification commands: `npm run typecheck`, `npm run lint`, `npm run test`. Do NOT run `next build` while another process may be running (it clobbers `.next`); the integrator runs the build.
