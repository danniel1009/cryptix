import { disclaimer } from "./disclaimer";

/**
 * `t.rateChecker` — the indicative rate calculator (section `#exchange`).
 * Placeholders: `{spread}` formatted spread ("5%"), `{time}` formatted time,
 * `{sources}` comma-joined provider names, `{currency}` currency code,
 * `{amount}` formatted amount with currency.
 *
 * Consumed by: RateChecker section (converter card: panels, swap button, rate rows, CTA).
 * Only `spreadBadge` and `ourRateFormula` (tiny mono labels) are uppercase.
 */
export const rateChecker = {
  eyebrow: "Rate checker",
  title: "Check exchange rate",
  description: "Get an indicative exchange rate based on the latest available market price.",
  youSend: "You send",
  youReceive: "You receive approximately",
  amountLabel: "Amount",
  amountPlaceholder: "Enter amount",
  currencyLabel: "Currency",
  pairLabel: "Exchange pair",
  marketRate: "Market rate",
  ourRate: "Our rate",
  estimatedReceive: "Estimated receive",
  spreadBadge: "+{spread} FROM MARKET",
  ourRateFormula: "MARKET PRICE + {spread}",
  /** Identical to `t.disclaimer.short` by construction. */
  disclaimer: disclaimer.short,
  requestExchange: "Request exchange",
  chatOnWhatsApp: "Chat on WhatsApp",
  swapHint: "Select the currency you send and the currency you want to receive.",
  unavailableTitle: "Market data temporarily unavailable",
  unavailableBody:
    "We cannot calculate an indicative rate right now. Please try again shortly or contact our team directly.",
  staleNote: "Last updated {time}",
  derivedNote: "Cross rate derived from {sources}",
  perUnit: "per 1 {currency}",
  enterAmount: "Enter an amount to see an estimate.",
  invalidAmount: "Please enter a valid amount.",
  minAmount: "Minimum {amount}",
  maxAmount: "Maximum {amount}",
  sourceLabel: "Source",
  rateBasis: "Rates refresh automatically as market data updates.",
  quickAmounts: "Quick amounts",
  /** Accessible names of the two currency dropdowns. */
  sendCurrencyLabel: "Currency you send",
  receiveCurrencyLabel: "Currency you receive",
  /** Tiny line under the estimate. `{amount}` — formatted amount with currency ("1,000.00 USDT"). */
  forAmount: "for {amount}",
  /** Meta line. `{time}` — formatted clock time. */
  updatedAt: "Updated {time}",
  estimateUnavailable: "Estimate unavailable",
  /** Converter card panel labels (small, muted, top-left of each panel). */
  from: "From",
  to: "To",
  /** Accessible name of the circular swap button between the panels. */
  swap: "Swap currencies",
  /** Tooltip on the "Our rate" row. `{spread}` — formatted spread such as "5%". */
  spreadExplainer: "Our rate applies a {spread} spread on the asset you receive.",
  /** Accessible name of the small info button that opens `spreadExplainer`. */
  spreadInfoLabel: "How our rate is calculated",
};
