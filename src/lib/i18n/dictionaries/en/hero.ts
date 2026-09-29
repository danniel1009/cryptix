/**
 * `t.hero` — above-the-fold copy: headline (two lines of ONE sentence-case
 * sentence, so line 2 starts lowercase), subtitle, three supporting points,
 * the two CTAs, the four-step process strip and the factual trust note.
 *
 * Consumed by: Hero section. `processSteps` are rendered as tiny mono labels
 * (the component applies `uppercase` via CSS).
 */
export const hero = {
  eyebrow: "Professional digital asset exchange",
  titleLine1: "The smarter way to",
  titleLine2: "exchange digital assets",
  subtitle:
    "Check live crypto rates, calculate indicative exchange values, and connect directly with our exchange team.",
  supporting: ["Live market data", "Transparent pricing", "Personal support"],
  ctaPrimary: "Check live rate",
  ctaSecondary: "Chat on WhatsApp",
  /** The process the whole site communicates, in order. */
  processSteps: ["Check rate", "Request exchange", "Contact our team", "Manual exchange"],
  scrollHint: "Scroll to explore",
  trustNote:
    "No account, no wallet connection, no automated execution — every exchange is handled personally by our team.",
};
