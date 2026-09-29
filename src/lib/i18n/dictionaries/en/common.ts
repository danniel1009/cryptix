/**
 * `t.common` — shared UI strings reused across many components: generic
 * buttons (Request exchange, Close, Retry), live-feed status words, rate
 * labels and generic form words.
 *
 * Consumed by: Navbar / MobileMenu (CTA), Hero, RateChecker, LiveMarket,
 * SupportedPairs, ExchangeRequestModal, WhatsAppFloat, ui primitives
 * (LiveIndicator, Modal, Button) and the root layout (skip link).
 * Section-specific copy lives in its own namespace.
 *
 * Copy case (docs/DESIGN.md): sentence case everywhere; only the tiny mono
 * labels `spreadBadge` / `ourRateFormula` are uppercase.
 */
export const common = {
  brandTagline: "Professional digital asset exchange",
  requestExchange: "Request exchange",
  checkLiveRate: "Check live rate",
  chatOnWhatsApp: "Chat on WhatsApp",
  sendMessage: "Send message",
  close: "Close",
  retry: "Retry",
  loading: "Loading…",
  sending: "Sending…",
  learnMore: "Learn more",
  skipToContent: "Skip to content",
  live: "Live",
  reconnecting: "Reconnecting",
  unavailable: "Unavailable",
  lastUpdated: "Last updated",
  /** `{time}` — a formatted time or relative time ("2 minutes ago"). */
  updatedAgo: "Last updated {time}",
  marketUnavailable: "Market data temporarily unavailable",
  indicativeRate: "Indicative rate",
  ourRate: "Our rate",
  marketRate: "Market rate",
  marketPrice: "Market price",
  estimatedReceive: "Estimated receive",
  youSend: "You send",
  youReceive: "You receive",
  /** Tiny mono badge. `{spread}` — formatted spread such as "5%". */
  spreadBadge: "+{spread} FROM MARKET",
  /** Tiny mono label. `{spread}` — formatted spread such as "5%". */
  ourRateFormula: "MARKET PRICE + {spread}",
  devMockData: "Development mock data",
  optional: "Optional",
  required: "Required",
  selectPair: "Select pair",
  amount: "Amount",
  whatsapp: "WhatsApp",
  email: "Email",
};
