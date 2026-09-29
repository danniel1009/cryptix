/**
 * `t.nav` — navigation labels. The section keys ("exchange", "market",
 * "how-it-works", "security", "faq", "contact") MUST match `NavSectionId` in
 * `src/config/site.ts` so the navbar can render `t.nav[item.id]`.
 *
 * Consumed by: Navbar, MobileMenu, Footer (navigation column) and
 * LanguageSwitcher (`language` is the accessible group label).
 */
export const nav = {
  exchange: "Exchange",
  market: "Market",
  "how-it-works": "How it works",
  security: "Security",
  faq: "FAQ",
  contact: "Contact",
  requestExchange: "Request exchange",
  openMenu: "Open menu",
  closeMenu: "Close menu",
  menu: "Menu",
  language: "Language",
};
