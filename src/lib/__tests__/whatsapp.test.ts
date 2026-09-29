import { beforeEach, describe, expect, it, vi } from "vitest";

/** Mutable brand config so the "not configured" path can be exercised without env juggling. */
const site = vi.hoisted(() => ({
  name: "Cryptix",
  url: "http://localhost:3000",
  whatsappNumber: "6281234567890",
  contactEmail: "",
  defaultLocale: "en" as const,
  copyrightYear: 2026,
  nav: [],
}));
vi.mock("@/config/site", () => ({
  siteConfig: site,
  NAV_ITEMS: [],
  normalizeWhatsAppNumber: (raw: string) => raw.replace(/[^\d]/g, ""),
}));

import {
  buildExchangeInquiryMessage,
  buildGeneralInquiryMessage,
  buildWhatsAppUrl,
  isWhatsAppConfigured,
  WHATSAPP_FALLBACK_HREF,
} from "@/lib/whatsapp";

const EN_WITH_REFERENCE = [
  "Hello, I would like to request a crypto exchange.",
  "",
  "Pair: USDT → BTC",
  "Amount: 1,000 USDT",
  "Estimated Receive: 0.009 BTC",
  "Request reference: CX-7KQ2MZ",
  "",
  "Please provide the latest exchange rate and further instructions.",
].join("\n");

const ID_WITHOUT_REFERENCE = [
  "Halo, saya ingin mengajukan exchange crypto.",
  "",
  "Pair: USDT → BTC",
  "Jumlah: 1.000 USDT",
  "Estimasi menerima: 0,009 BTC",
  "",
  "Mohon informasi kurs terbaru dan proses selanjutnya.",
].join("\n");

beforeEach(() => {
  site.whatsappNumber = "6281234567890";
  site.name = "Cryptix";
});

describe("buildExchangeInquiryMessage", () => {
  it("renders the English layout exactly, with a reference", () => {
    expect(
      buildExchangeInquiryMessage({
        locale: "en",
        pairId: "USDT_BTC",
        amount: 1000,
        estimatedReceive: 0.009,
        reference: "CX-7KQ2MZ",
      }),
    ).toBe(EN_WITH_REFERENCE);
  });

  it("renders the Indonesian layout exactly, without a reference", () => {
    expect(
      buildExchangeInquiryMessage({ locale: "id", pairId: "USDT_BTC", amount: 1000, estimatedReceive: 0.009 }),
    ).toBe(ID_WITHOUT_REFERENCE);
    expect(
      buildExchangeInquiryMessage({
        locale: "id",
        pairId: "USDT_BTC",
        amount: 1000,
        estimatedReceive: 0.009,
        reference: null,
      }),
    ).toBe(ID_WITHOUT_REFERENCE);
  });

  it("drops trailing zero decimals but keeps meaningful ones", () => {
    const msg = buildExchangeInquiryMessage({
      locale: "en",
      pairId: "USDT_BTC",
      amount: 1500.5,
      estimatedReceive: 0.01428571,
    });
    expect(msg).toContain("Amount: 1,500.5 USDT");
    expect(msg).toContain("Estimated Receive: 0.01428571 BTC");
  });

  it("formats fiat with the Rp symbol and other pairs correctly", () => {
    expect(
      buildExchangeInquiryMessage({ locale: "id", pairId: "USDT_IDR", amount: 250, estimatedReceive: 3_925_000 }),
    ).toContain("Pair: USDT → IDR\nJumlah: 250 USDT\nEstimasi menerima: Rp3.925.000");
    expect(buildExchangeInquiryMessage({ locale: "en", pairId: "SOL_BTC", amount: 12.5, estimatedReceive: 0.02 })).toContain(
      "Pair: SOL → BTC\nAmount: 12.5 SOL\nEstimated Receive: 0.02 BTC",
    );
  });

  it("omits the estimate line when no estimate is known", () => {
    const msg = buildExchangeInquiryMessage({ locale: "en", pairId: "ETH_BTC", amount: 2 });
    expect(msg).toBe(
      [
        "Hello, I would like to request a crypto exchange.",
        "",
        "Pair: ETH → BTC",
        "Amount: 2 ETH",
        "",
        "Please provide the latest exchange rate and further instructions.",
      ].join("\n"),
    );
    expect(buildExchangeInquiryMessage({ locale: "en", pairId: "ETH_BTC", amount: 2, estimatedReceive: null })).toBe(msg);
    expect(buildExchangeInquiryMessage({ locale: "en", pairId: "ETH_BTC", amount: 2, estimatedReceive: Number.NaN })).toBe(
      msg,
    );
  });
});

describe("buildGeneralInquiryMessage", () => {
  it("interpolates the brand in both languages", () => {
    expect(buildGeneralInquiryMessage("en")).toBe(
      "Hello Cryptix, I have a question about exchanging digital assets.",
    );
    expect(buildGeneralInquiryMessage("id")).toBe("Halo Cryptix, saya ingin bertanya tentang exchange aset digital.");
    site.name = "Acme";
    expect(buildGeneralInquiryMessage("en")).toContain("Hello Acme,");
  });
});

describe("buildWhatsAppUrl", () => {
  it("builds https://wa.me/<digits>?text=<encoded> with nothing raw left in the URL", () => {
    const url = buildWhatsAppUrl(EN_WITH_REFERENCE);
    expect(url.startsWith("https://wa.me/6281234567890?text=")).toBe(true);
    expect(url).toBe(`https://wa.me/6281234567890?text=${encodeURIComponent(EN_WITH_REFERENCE)}`);
    expect(url).not.toMatch(/[\s→]/);
    expect(url).toContain("%0A%0A");
    expect(url).toContain("%E2%86%92");
    expect(decodeURIComponent(url.split("?text=")[1])).toBe(EN_WITH_REFERENCE);
  });

  it("omits the text parameter when there is no message", () => {
    expect(buildWhatsAppUrl()).toBe("https://wa.me/6281234567890");
    expect(buildWhatsAppUrl("")).toBe("https://wa.me/6281234567890");
  });

  it("falls back to #contact when no number is configured", () => {
    site.whatsappNumber = "";
    expect(isWhatsAppConfigured()).toBe(false);
    expect(buildWhatsAppUrl("hello")).toBe(WHATSAPP_FALLBACK_HREF);
    expect(buildWhatsAppUrl()).toBe("#contact");
  });

  it("reports configured when a number exists", () => {
    expect(isWhatsAppConfigured()).toBe(true);
  });
});
