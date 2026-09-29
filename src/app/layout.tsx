import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { SkipLink } from "@/components/layout/SkipLink";
import { WhatsAppFloat } from "@/components/layout/WhatsAppFloat";
import { siteConfig } from "@/config/site";
import { interpolate } from "@/lib/i18n/dictionaries";
import { getServerDictionary } from "@/lib/i18n/server";
import { INTL_LOCALES, type Locale } from "@/lib/i18n/types";
import { I18nProvider } from "@/lib/i18n/provider";
import { ExchangeRequestProvider } from "@/providers/ExchangeRequestProvider";
import { MarketProvider } from "@/providers/MarketProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const OG_LOCALES: Record<Locale, string> = { en: "en_US", id: "id_ID" };

/** `siteConfig.url` comes from env; never let a malformed value break rendering. */
function resolveMetadataBase(): URL {
  try {
    return new URL(siteConfig.url);
  } catch {
    return new URL("http://localhost:3000");
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { locale, t } = await getServerDictionary();
  const brand = siteConfig.name;
  const title = interpolate(t.seo.title, { brand });
  const description = interpolate(t.seo.description, { brand });
  const ogTitle = interpolate(t.seo.ogTitle, { brand });
  const ogDescription = interpolate(t.seo.ogDescription, { brand });

  return {
    metadataBase: resolveMetadataBase(),
    title,
    description,
    keywords: t.seo.keywords,
    applicationName: brand,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      url: "/",
      siteName: brand,
      title: ogTitle,
      description: ogDescription,
      locale: OG_LOCALES[locale],
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: ogTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: ["/opengraph-image"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
    },
    icons: {
      icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#050608",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

/**
 * JSON-LD built ONLY from config + dictionary (no user input). `<` is escaped
 * so the payload can never close the script tag.
 */
function buildJsonLd(locale: Locale, description: string): string {
  const base = resolveMetadataBase().origin;
  const organization: Record<string, unknown> = {
    "@type": "Organization",
    "@id": `${base}/#organization`,
    name: siteConfig.name,
    url: base,
    logo: `${base}/icon.svg`,
  };
  if (siteConfig.contactEmail) organization.email = siteConfig.contactEmail;
  if (siteConfig.whatsappNumber) {
    organization.contactPoint = [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        url: `https://wa.me/${siteConfig.whatsappNumber}`,
        availableLanguage: ["en", "id"],
      },
    ];
  }
  const website = {
    "@type": "WebSite",
    "@id": `${base}/#website`,
    name: siteConfig.name,
    url: base,
    description,
    inLanguage: INTL_LOCALES[locale],
    publisher: { "@id": `${base}/#organization` },
  };
  const graph = { "@context": "https://schema.org", "@graph": [organization, website] };
  return JSON.stringify(graph)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale, t } = await getServerDictionary();
  const jsonLd = buildJsonLd(locale, interpolate(t.seo.description, { brand: siteConfig.name }));

  return (
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable} dark h-full`}>
      <body className="flex min-h-full flex-col bg-bg text-fg antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
        <I18nProvider initialLocale={locale}>
          <MarketProvider>
            <ExchangeRequestProvider>
              <SkipLink />
              <Navbar />
              <main id="main" className="flex-1">
                {children}
              </main>
              <Footer />
              <WhatsAppFloat />
            </ExchangeRequestProvider>
          </MarketProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
