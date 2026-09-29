import type { Dictionary } from "@/lib/i18n/dictionaries";
import { common } from "./common";
import { nav } from "./nav";
import { footer } from "./footer";
import { disclaimer } from "./disclaimer";
import { validation } from "./validation";
import { form } from "./form";
import { hero } from "./hero";
import { rateChecker } from "./rateChecker";
import { market } from "./market";
import { howItWorks } from "./howItWorks";
import { whyChooseUs } from "./whyChooseUs";
import { pairs } from "./pairs";
import { security } from "./security";
import { faq } from "./faq";
import { contact } from "./contact";
import { exchangeRequest } from "./exchangeRequest";
import { whatsapp } from "./whatsapp";
import { seo } from "./seo";
import { system } from "./system";

/**
 * Bahasa Indonesia dictionary. Typed against the English `Dictionary` so a
 * missing or extra namespace is a compile error; per-key parity is enforced
 * by `src/lib/i18n/__tests__/dictionaries.test.ts`.
 */
export const id: Dictionary = {
  common,
  nav,
  footer,
  disclaimer,
  validation,
  form,
  hero,
  rateChecker,
  market,
  howItWorks,
  whyChooseUs,
  pairs,
  security,
  faq,
  contact,
  exchangeRequest,
  whatsapp,
  seo,
  system,
};
