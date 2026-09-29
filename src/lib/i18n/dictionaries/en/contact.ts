/**
 * `t.contact` — Contact our team (section `#contact`): form field labels and
 * placeholders, the success state, and the direct-contact panel.
 * `{reference}` is the "CX-XXXXXX" reference returned by `/api/contact`.
 * `{seconds}` in `retryAfter` is the formatted `retryAfterSeconds` of a
 * rate-limited response.
 *
 * Consumed by: Contact section (form + success + direct contact card).
 */
export const contact = {
  eyebrow: "Contact",
  title: "Contact our team",
  description: "Have a question about an exchange or need assistance?",
  fields: {
    name: { label: "Name", placeholder: "Your full name" },
    email: { label: "Email", placeholder: "you@example.com" },
    whatsapp: { label: "WhatsApp number", placeholder: "+62 812 3456 7890" },
    subject: { label: "Subject", placeholder: "What is your question about?" },
    message: { label: "Message", placeholder: "Tell us how we can help." },
  },
  submit: "Send message",
  success: {
    title: "Message sent",
    body: "Thank you. Our team will get back to you through WhatsApp or email.",
    chat: "Chat directly on WhatsApp",
    reference: "Reference: {reference}",
    another: "Send another message",
  },
  privacyNote:
    "Your details are used only to respond to your enquiry and are not shared with anyone else.",
  directTitle: "Prefer to talk directly?",
  directBody: "Reach our exchange team on WhatsApp or by email.",
  whatsappLabel: "WhatsApp",
  emailLabel: "Email",
  responseTime: "We usually reply within business hours.",
  /** Title of the form card. */
  formTitle: "Send us a message",
  /** Small note under the form title. */
  formNote: "All fields are required. Our team replies through WhatsApp or email.",
  /** Secondary line of the WhatsApp channel row. */
  whatsappHint: "Fastest way to reach the team",
  /** Secondary line of the email channel row. */
  emailHint: "For detailed or written enquiries",
  /** Shown under the rate-limit error. `{seconds}` — formatted number of seconds. */
  retryAfter: "You can try again in {seconds} seconds.",
};
