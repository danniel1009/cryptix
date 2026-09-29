/**
 * `t.validation` — one human-readable message per `ValidationErrorCode`
 * returned by the shared zod schemas (`@/lib/validation/schemas`) and by the
 * `/api/contact` and `/api/exchange-request` routes. The API returns codes,
 * never text; the client maps `errors[field]` → `t.validation[code]`.
 *
 * Consumed by: Contact form, ExchangeRequestModal, ui Input/Select/Textarea
 * error slots.
 */
export const validation = {
  required: "This field is required.",
  invalid_email: "Please enter a valid email address.",
  invalid_phone: "Please enter a valid WhatsApp number, including the country code.",
  too_short: "This value is too short.",
  too_long: "This value is too long.",
  invalid_pair: "Please select a supported exchange pair.",
  invalid_amount: "Please enter a valid amount.",
  amount_too_small: "The amount is below the minimum for this currency.",
  amount_too_large: "The amount is above the maximum for this currency.",
  consent_required: "Please confirm that you understand the rate is indicative.",
  invalid_value: "This value is not valid.",
};
