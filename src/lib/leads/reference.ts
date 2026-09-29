/**
 * Customer-facing request references such as "CX-7KQ2MZ".
 *
 * Six characters from a 32-symbol alphabet give ~10^9 combinations — plenty
 * for a manual desk, and short enough to read out over the phone. Ambiguous
 * glyphs (0/O, 1/I) are excluded. Randomness comes from Web Crypto, which
 * exists in browsers and in Node ≥ 19, so this module is runtime-agnostic.
 */

/** 32 symbols: A–Z without I and O, digits 2–9. */
export const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const REFERENCE_LENGTH = 6;
export const DEFAULT_REFERENCE_PREFIX = "CX";

/** Matches "<PREFIX>-<6 symbols>", e.g. /^CX-[A-HJ-NP-Z2-9]{6}$/ for the default prefix. */
export const REFERENCE_PATTERN = /^[A-Z]{1,8}-[A-HJ-NP-Z2-9]{6}$/;

function randomBytes(length: number): Uint8Array {
  const webCrypto = globalThis.crypto;
  if (!webCrypto || typeof webCrypto.getRandomValues !== "function") {
    throw new Error("generateReference: Web Crypto (crypto.getRandomValues) is not available");
  }
  return webCrypto.getRandomValues(new Uint8Array(length));
}

export function generateReference(prefix: string = DEFAULT_REFERENCE_PREFIX): string {
  const bytes = randomBytes(REFERENCE_LENGTH);
  let body = "";
  for (let i = 0; i < REFERENCE_LENGTH; i += 1) {
    // The alphabet has exactly 32 symbols, so masking 5 bits is uniform (no modulo bias).
    body += REFERENCE_ALPHABET[bytes[i] & 31];
  }
  return `${prefix}-${body}`;
}

export function isLeadReference(value: unknown): value is string {
  return typeof value === "string" && REFERENCE_PATTERN.test(value);
}
