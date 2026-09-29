import { disclaimer } from "./disclaimer";

/**
 * `t.exchangeRequest` — the Request exchange modal: field labels and
 * placeholders, the consent checkbox, submit/cancel, and the success state.
 * Placeholders: `{time}` formatted time of the indicative rate,
 * `{reference}` the "CX-XXXXXX" reference from `/api/exchange-request`,
 * `{n}` / `{total}` for the optional step indicator,
 * `{min}` / `{max}` formatted amount limits of the sent currency,
 * `{market}` formatted market price (summary header).
 *
 * Consumed by: ExchangeRequestModal (opened via `useExchangeRequest()`).
 */
export const exchangeRequest = {
  title: "Request exchange",
  subtitle:
    "Tell us what you would like to exchange. Our team confirms the final rate with you personally.",
  fields: {
    fullName: { label: "Full name", placeholder: "Your full name" },
    whatsapp: { label: "WhatsApp number", placeholder: "+62 812 3456 7890" },
    email: { label: "Email", placeholder: "you@example.com" },
    pair: { label: "Exchange pair", placeholder: "Select a pair" },
    amount: { label: "Amount you send", placeholder: "Enter amount" },
    estimatedReceive: {
      label: "Estimated receive",
      placeholder: "Calculated from the indicative rate",
    },
    message: { label: "Message", placeholder: "Anything else we should know? (optional)" },
  },
  estimatedHint: "Based on the indicative rate at {time}. You can edit this.",
  /** Identical to `t.disclaimer.formRate` by construction. */
  disclaimer: disclaimer.formRate,
  consent:
    "I understand that the displayed rate is indicative and the final rate will be confirmed by the exchange team.",
  submit: "Send exchange request",
  cancel: "Cancel",
  success: {
    title: "Request received",
    body: "Thank you for contacting us. Our exchange team will review your request and contact you through WhatsApp or email.",
    reference: "Your reference: {reference}",
    chat: "Chat directly on WhatsApp",
    close: "Close",
    newRequest: "Submit another request",
  },
  prefillNote: "Pre-filled from the rate checker — you can change any value.",
  stepLabel: "Step {n} of {total}",
  noAccountNote: "No account needed. Our team confirms every request with you personally.",
  /** Tiny mono group labels above the two field groups. */
  sectionContact: "Your contact details",
  sectionExchange: "Exchange details",
  /** Under the amount field. `{min}` / `{max}` are formatted amounts with currency. */
  amountHint: "Minimum {min}, maximum {max}.",
  /** Shown once the visitor has typed into the estimate field themselves. */
  estimateEditedNote: "Edited manually. Live updates are paused for this field.",
  /** Ghost button that hands the estimate back to the live rate. */
  recalculate: "Recalculate",
  /** Estimate hint while market data is unavailable (the field stays editable). */
  estimateUnavailableHint:
    "The live rate is unavailable right now. You may enter the amount you expect; our team will confirm it.",
  /** Connection notes shown next to the rate while fresh data is still displayed. */
  marketNote: {
    reconnecting: "Reconnecting to the live market feed. Estimates use the latest available data.",
    polling: "Live stream unavailable. Prices refresh periodically.",
    offline: "You appear to be offline. Estimates use the last received data.",
  },
  /**
   * Summary header at the top of the form: what is being requested and the
   * indicative rate it is based on. `{market}` formatted market price with
   * currency, `{spread}` formatted spread ("5%"), `{time}` formatted clock time
   * at which the rate checker showed this rate.
   */
  summary: {
    title: "You are requesting",
    rate: "Indicative rate",
    marketNote: "Market {market} · our rate includes a {spread} spread",
    capturedAt: "Rate as shown at {time}",
  },
  /** Ghost button that expands the collapsed exchange-details group (pair / amount / estimate). */
  editDetails: "Edit details",
  /** Footer CTA next to submit: opens WhatsApp with the current pair / amount pre-filled. */
  chatWhatsApp: "Chat directly on WhatsApp",
};
