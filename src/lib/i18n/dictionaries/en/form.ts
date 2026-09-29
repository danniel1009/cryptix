/**
 * `t.form` — form-level (non-field) messages. `errors` has one entry per
 * non-validation API error code from `submitContact` /
 * `submitExchangeRequest` (`@/lib/api/client`): `rate_limited`,
 * `delivery_failed`, `network_error`, `spam_detected`, `unknown`.
 *
 * Consumed by: Contact form, ExchangeRequestModal (status banner, submit
 * button busy label, retry button, hidden honeypot label).
 */
export const form = {
  errors: {
    rate_limited: "Too many requests. Please try again in a few minutes.",
    delivery_failed:
      "We could not deliver your message right now. Please try again or contact us on WhatsApp.",
    network_error: "Network error. Please check your connection and try again.",
    spam_detected:
      "Your submission could not be accepted. Please try again or contact us on WhatsApp.",
    unknown: "Something went wrong. Please try again.",
  },
  /** Label of the visually hidden honeypot field (never shown to humans). */
  honeypotLabel: "Leave this field empty",
  submitting: "Submitting…",
  retry: "Try again",
};
