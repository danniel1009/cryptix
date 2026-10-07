/**
 * Third-party platforms the exchange team settles through. Shown as an
 * information strip only — the logos are trademarks of their owners and the
 * copy must never imply affiliation, endorsement, or regulatory status.
 */
export type PlatformRole = "exchange" | "wallet" | "exchangeIndonesia";

export interface SettlementPlatform {
  id: string;
  /** Proper noun, language independent. */
  name: string;
  /** Path under /public. */
  logo: string;
  /** Intrinsic logo size (keeps layout stable before the image loads). */
  width: number;
  height: number;
  /** Official website (opens in a new tab). */
  href: string;
  /** Dictionary key under t.platforms.roles. */
  role: PlatformRole;
}

export const SETTLEMENT_PLATFORMS: readonly SettlementPlatform[] = [
  { id: "binance", name: "Binance", logo: "/platforms/binance.svg", width: 632, height: 127, href: "https://www.binance.com", role: "exchange" },
  { id: "trust-wallet", name: "Trust Wallet", logo: "/platforms/trust-wallet.svg", width: 134, height: 37, href: "https://trustwallet.com", role: "wallet" },
  { id: "indodax", name: "Indodax", logo: "/platforms/indodax.png", width: 720, height: 120, href: "https://indodax.com", role: "exchangeIndonesia" },
] as const;
