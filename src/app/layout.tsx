import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/provider";
import { getServerLocale } from "@/lib/i18n/server";
import { MarketProvider } from "@/providers/MarketProvider";
import { ExchangeRequestProvider } from "@/providers/ExchangeRequestProvider";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppFloat } from "@/components/layout/WhatsAppFloat";

// INTERIM layout — the design-system/layout agent replaces this with the final
// version (locale-aware generateMetadata, OG, fonts, skip link, etc.).

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = { title: "Cryptix", description: "Crypto exchange" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getServerLocale();
  return (
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <I18nProvider initialLocale={locale}>
          <MarketProvider>
            <ExchangeRequestProvider>
              <Navbar />
              <main className="flex-1">{children}</main>
              <Footer />
              <WhatsAppFloat />
            </ExchangeRequestProvider>
          </MarketProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
