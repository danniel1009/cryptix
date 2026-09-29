# Exchange Rate Converter — UI spec (client change, 2026-09-29)

The rate checker (`#exchange`) must use a **converter card** composition, not a form.

```
┌───────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────┐  │
│  │  From                    ● BTC     ▼    │  │   ← small label top-left, coin chip on the right
│  │  1                                      │  │   ← LARGE amount input, visually dominant
│  └─────────────────────────────────────────┘  │
│                    ⇅  (swap button, centred, overlapping both panels)
│  ┌─────────────────────────────────────────┐  │
│  │  To                      ● USDT    ▼    │  │
│  │  83,095.76                              │  │   ← LARGE calculated amount (read-only)
│  └─────────────────────────────────────────┘  │
│             1 BTC = 83,095.76 USDT            │   ← live market rate line
│   Market rate   1 BTC = 83,095.76 USDT        │
│   Our rate      1 BTC = 79,138.82 USDT  [+5% from market] │  ← clear, not aggressive
│   Indicative rate. Final exchange rate will be confirmed by our team.  │
│          [      Request exchange      ]       │   ← ONE large full-width pill CTA
└───────────────────────────────────────────────┘
```

Rules:
- One large rounded card (`rounded-3xl`), dark charcoal, subtle glow, generous padding; **600–700 px wide, centred** on desktop; `width: 100%` with side margins on mobile. Same composition on mobile (amount stays large, chip stays on the right, swap stays centred). Never a traditional label/dropdown form.
- Each panel: `rounded-2xl`, `bg-surface-2`, minimal border; small muted label ("From" / "To") top-left; **coin chip** (CurrencyIcon + ticker + chevron) on the RIGHT of the same field, vertically centred against the amount; the amount is the biggest text in the card (`font-mono text-4xl sm:text-5xl`).
- The **To** value updates automatically when: amount, source currency, destination currency, market price (snapshot) or spread changes.
- **Swap button**: circular 44–48 px, exactly between the panels overlapping both (`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2` on a zero-height row), emerald accent, icon ⇅ (lucide ArrowDownUp), rotates 180° with a smooth spring on each click. Click: From/To currencies swap (only when the reverse pair exists — with the 8 supported pairs it always does) and the previous *To* value becomes the new *From* amount; To recomputes.
- **Supported pairs** (the ONLY selectable combinations, `SUPPORTED_PAIRS` in `src/config/exchange.ts`):
  featured (customer-facing, listed first, defaults):  USDT → BTC · SOL → BTC · ETH → BTC · USDT → IDR
  reverse directions (allowed; required for swap):     BTC → USDT · BTC → SOL · BTC → ETH · IDR → USDT
  The From selector lists every currency that is a `from` of some pair; the To selector lists only `getReceivableCurrencies(from)` (featured first). Unsupported combinations are impossible by construction. The "Supported exchange pairs" section shows the four featured pairs and notes the reverse direction is available.
- **Rate display** under the panels: primary line `1 {quoteBase} = {market} {quoteCurrency}` from live data; two rows "Market rate" and "Our rate" with the badge `+5% FROM MARKET` / "Market + 5%" — visually clear, not aggressive; then the disclaimer:
  EN "Indicative rate. Final exchange rate will be confirmed by our team."   ID "Kurs indikatif. Kurs final akan dikonfirmasi oleh tim kami."
- **Spread direction** (unchanged from the original brief — "apply the 5% spread correctly according to the quote direction"): the customer always pays *market + spread* on the asset they RECEIVE, so `receive = amount × marketRate / (1 + spread)` for every pair and direction. USDT → BTC: our rate 1 BTC = 105,000 USDT when market is 100,000. BTC → USDT: our rate 1 BTC = 95,238.10 USDT (the customer receives less USDT than market). Tooltip: "Our rate applies a 5% spread on the asset you receive."
- **CTA**: one large full-width pill labelled "Request exchange" (never "Convert…"); opens the exchange request modal with From, To, amount, estimated receive and the current indicative rate pre-filled.
- **Exchange request modal** header summary: "You are requesting: 1 BTC → 83,095.76 USDT" and "Indicative rate: 1 BTC = 79,138.82 USDT" (captured when opened, recalculated live if the customer edits pair/amount). Customer fields: full name, WhatsApp number, email, message (+ consent). Buttons: "Send exchange request" and "Chat directly on WhatsApp" (contextual message). Pair/amount/estimate remain editable in a compact details area. Never implies execution.
- UX flow: select what I have → enter amount → select what I want → see indicative rate → see our rate (+5%) → request exchange → contact our team.
