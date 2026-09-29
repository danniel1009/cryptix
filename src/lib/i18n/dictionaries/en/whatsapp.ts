/**
 * WhatsApp message templates. `{brand}`, `{pair}`, `{amount}`, `{estimate}`,
 * `{reference}` are replaced by src/lib/whatsapp.ts.
 */
export const whatsapp = {
  /** Pre-filled message from the rate checker / exchange request. */
  exchangeInquiry: {
    greeting: "Hello, I would like to request a crypto exchange.",
    pairLabel: "Pair",
    amountLabel: "Amount",
    estimateLabel: "Estimated Receive",
    referenceLabel: "Request reference",
    closing: "Please provide the latest exchange rate and further instructions.",
  },
  /** Generic message from the floating button / hero / footer. */
  generalInquiry: "Hello {brand}, I have a question about exchanging digital assets.",
  /** Floating button copy. */
  floating: {
    title: "Need help?",
    subtitle: "Chat with our team",
    ariaLabel: "Chat with our team on WhatsApp",
  },
  notConfigured: "WhatsApp is not configured yet. Please use the contact form.",
};
