/**
 * `t.pairs` — Supported exchange pairs cards. The pair list itself comes from
 * `SUPPORTED_PAIRS` (`@/config/exchange`); this namespace only holds labels.
 * `{spread}` is the formatted spread ("5%"). `ourRateFormula` is a tiny mono
 * label and stays uppercase.
 *
 * Consumed by: SupportedPairs section.
 */
export const pairs = {
  eyebrow: "Exchange pairs",
  title: "Supported exchange pairs",
  description:
    "We currently exchange the following pairs. Each card shows the market reference and our indicative rate.",
  ourRate: "Our rate",
  ourRateFormula: "MARKET PRICE + {spread}",
  note: "Final exchange rates are confirmed by our team before the transaction.",
  youSend: "You send",
  youReceive: "You receive",
  checkRate: "Check rate",
  /** Accessible button name. `{pair}` — the pair label such as "USDT → BTC". */
  checkRateFor: "Check rate for {pair}",
  indicativeLabel: "Indicative",
  perPairNote: "Rates are indicative and refresh with market data.",
  reverseNote:
    "Each pair can also be requested in the opposite direction (for example BTC → USDT). Use the rate checker to select what you have and what you want to receive.",
};
