/**
 * `t.disclaimer` — the legal/indicative-rate wording shown wherever a rate
 * or estimate appears. `{spread}` in `full` is the formatted spread ("5%").
 *
 * Consumed by: RateChecker (`short`), Footer (`full`), ExchangeRequestModal
 * (`formRate`). `rateChecker.disclaimer` and `exchangeRequest.disclaimer`
 * re-export these strings so every surface shows identical wording.
 */
export const disclaimer = {
  short: "Indicative rate. Final exchange rate will be confirmed by our exchange team.",
  full: "Market prices shown on this website are for reference purposes only. Our displayed rate includes a {spread} spread over the referenced market price. Final exchange rates, availability and transaction terms will be confirmed by our exchange team.",
  formRate:
    "The displayed rate is indicative only. Final exchange rate and transaction details will be confirmed by our exchange team.",
};
