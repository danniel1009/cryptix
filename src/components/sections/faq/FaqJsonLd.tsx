import { INTL_LOCALES, type Locale } from "@/lib/i18n/types";

/** One FAQ entry with placeholders already interpolated (e.g. `{spread}` → "5%"). */
export interface FaqJsonLdItem {
  question: string;
  answer: string;
}

/**
 * Serialise the FAQ as a schema.org `FAQPage`.
 *
 * Content comes ONLY from the dictionary + config (never user input), but the
 * payload is still hardened for inline `<script>` embedding: `<` becomes
 * `<` so a literal `</script>` inside a string can never close the tag,
 * and U+2028/2029 are escaped because they are line terminators in JS.
 * All three escapes are valid JSON, so `JSON.parse` round-trips unchanged.
 */
export function buildFaqJsonLd(items: readonly FaqJsonLdItem[], locale?: Locale): string {
  const payload: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
  if (locale) payload.inLanguage = INTL_LOCALES[locale];
  return JSON.stringify(payload)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export interface FaqJsonLdProps {
  items: readonly FaqJsonLdItem[];
  locale: Locale;
}

/**
 * `<script type="application/ld+json">` for the FAQ. Rendered inside the FAQ
 * section (server-rendered on first paint, re-rendered on locale switch) so
 * the structured data always mirrors the visible questions and answers.
 */
export function FaqJsonLd({ items, locale }: FaqJsonLdProps) {
  return (
    <script
      type="application/ld+json"
      // Safe: see buildFaqJsonLd — dictionary/config content, `<` escaped.
      dangerouslySetInnerHTML={{ __html: buildFaqJsonLd(items, locale) }}
    />
  );
}
