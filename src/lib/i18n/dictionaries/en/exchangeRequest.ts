import { disclaimer } from "./disclaimer";

/**
 * `t.exchangeRequest` — the Request exchange modal: field labels and
 * placeholders, the consent checkbox, submit/cancel, and the success state.
 * Placeholders: `{time}` formatted time of the indicative rate,
 * `{reference}` the "CX-XXXXXX" reference from `/api/exchange-request`,
 * `{n}` / `{total}` for the optional step indicator.
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
  noAccountNote: "No account needed. Nothing is executed automatically.",
};
