/**
 * `t.security` — Built with security in mind (section `#security`). Every
 * item describes something this website actually does (HTTPS, server-side
 * secrets, validated + sanitised forms, per-IP rate limits, provider-fallback
 * market data). No regulatory, licensing or custody claims.
 *
 * Consumed by: Security section (ruled feature grid).
 */
export const security = {
  eyebrow: "Security",
  title: "Built with security in mind",
  description:
    "This website is an information and enquiry service. It is built so that your details and our market data are handled carefully at every step.",
  items: [
    {
      title: "Secure communication",
      body: "All traffic between your browser and this website is encrypted over HTTPS.",
    },
    {
      title: "Protected infrastructure",
      body: "Market data and enquiry delivery run on our server, not in your browser, so third-party services are never called from your device.",
    },
    {
      title: "Server-side API credentials",
      body: "API keys and delivery secrets are stored only in the server environment and are never exposed to the client.",
    },
    {
      title: "Input validation",
      body: "Every form is validated on both the client and the server and sanitised before it is delivered to our team.",
    },
    {
      title: "Rate-limit protection",
      body: "Form submissions are rate-limited per IP address to reduce spam and abuse.",
    },
    {
      title: "Market data sourcing",
      body: "Prices come from established market data providers with fallback between them, and are clearly marked as stale when they are no longer fresh.",
    },
  ],
  note: "We do not hold customer funds or custody assets on this website. Every exchange is arranged and confirmed personally by our team.",
};
