/**
 * `t.faq` — Frequently asked questions (section `#faq`). Exactly 8 items.
 * `{spread}` is the formatted spread ("5%") so the copy follows config.
 * Every answer makes clear that pricing is indicative and the transaction is
 * confirmed manually by the team.
 *
 * Consumed by: Faq section (Accordion) and the FAQPage JSON-LD in layout.
 */
export const faq = {
  eyebrow: "FAQ",
  title: "Frequently asked questions",
  description: "Short answers to common questions about rates, the process and how to reach us.",
  items: [
    {
      question: "What exchange pairs are available?",
      answer:
        "All available pairs are listed in the Supported exchange pairs section of this page. We currently exchange USDT, ETH and SOL into BTC, and USDT into Indonesian Rupiah (IDR). Pairs that are not listed are not available.",
    },
    {
      question: "How is the exchange rate calculated?",
      answer:
        "We take the latest available market price from our data providers as the reference and apply a {spread} spread. The result is an indicative rate only — the final rate is confirmed by our exchange team before the transaction.",
    },
    {
      question: 'What does "Market price + {spread}" mean?',
      answer:
        "The market price is the reference price we obtain from our market data providers. Our rate is that price plus a {spread} spread, applied to the asset you receive. The rate checker shows both values so you can see the difference before contacting us.",
    },
    {
      question: "Are the displayed prices final?",
      answer:
        "No. All prices and rates on this website are indicative and may change with the market. The final exchange rate, availability and transaction details are confirmed manually by our team when you get in touch.",
    },
    {
      question: "How do I request an exchange?",
      answer:
        "Check the rate for your pair and amount, then submit the exchange request form or contact us on WhatsApp. Our team will review your request and reply with the confirmed rate and the next steps.",
    },
    {
      question: "Can I contact you through WhatsApp?",
      answer:
        "Yes. Use the WhatsApp button on this page to chat with our team directly. The rate checker can also prepare a message containing your pair and amount.",
    },
    {
      question: "Do I need an account?",
      answer:
        "No. This website has no accounts, wallets or balances. Nothing is executed on the website — every exchange is arranged and processed manually with our team.",
    },
    {
      question: "How long does the exchange process take?",
      answer:
        "It depends on the pair, the amount and network conditions. After you submit a request, our team usually responds within business hours and confirms the expected timing with you before anything is processed. We cannot promise a fixed duration.",
    },
  ],
};
