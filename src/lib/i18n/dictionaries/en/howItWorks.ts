/**
 * `t.howItWorks` — the four-step process (section `#how-it-works`):
 * Check rate → Request exchange → Contact our team → Manual exchange.
 * `steps[n].number` is rendered in the mono font ("01").
 *
 * Consumed by: HowItWorks section.
 */
export const howItWorks = {
  eyebrow: "Process",
  title: "How it works",
  description: "Four simple steps from checking the rate to exchanging with our team.",
  steps: [
    {
      number: "01",
      title: "Check the rate",
      body: "Select an exchange pair and enter your amount.",
    },
    {
      number: "02",
      title: "Submit your request",
      body: "Send your exchange request through our form.",
    },
    {
      number: "03",
      title: "Our team contacts you",
      body: "Our exchange team will contact you through WhatsApp or email.",
    },
    {
      number: "04",
      title: "Exchange manually",
      body: "The transaction is processed directly with our exchange team.",
    },
  ],
  footnote:
    "Every request is reviewed and processed manually by our team. Nothing on this website executes an exchange on its own.",
};
