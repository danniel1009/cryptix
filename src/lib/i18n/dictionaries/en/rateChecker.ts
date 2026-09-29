import { disclaimer } from "./disclaimer";

/**
 * `t.rateChecker` — the indicative rate calculator (section `#exchange`).
 * Placeholders: `{spread}` formatted spread ("5%"), `{time}` formatted time,
 * `{sources}` comma-joined provider names, `{currency}` currency code,
 * `{amount}` formatted amount with currency.
 *
 * Consumed by: RateChecker section (and its inner rate card / amount input).
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
};
