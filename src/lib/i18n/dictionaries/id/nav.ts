import type { nav as en } from "@/lib/i18n/dictionaries/en/nav";

/**
 * `t.nav` (Bahasa Indonesia) — mirror of `en/nav.ts`. Keys are the
 * `NavSectionId`s from `src/config/site.ts`. The `#exchange` anchor targets
 * the rate checker, so its Indonesian label is "Cek kurs".
 */
export const nav: typeof en = {
  exchange: "Cek kurs",
  market: "Pasar",
  "how-it-works": "Cara kerja",
  security: "Keamanan",
  faq: "FAQ",
  contact: "Kontak",
  requestExchange: "Ajukan exchange",
  openMenu: "Buka menu",
  closeMenu: "Tutup menu",
  menu: "Menu",
  language: "Bahasa",
};
