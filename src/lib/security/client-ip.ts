import { createHmac, randomBytes } from "node:crypto";

/**
 * Client IP resolution for rate limiting and abuse correlation.
 *
 * Header precedence: `x-forwarded-for` (first hop), `x-real-ip`,
 * `cf-connecting-ip`, then "unknown". CAVEAT: `x-forwarded-for` is only
 * trustworthy when the app sits behind a proxy that overwrites or appends to
 * it (Vercel, Cloudflare, nginx with `proxy_set_header`). A client talking
 * to the Node process directly can forge it — which only lets it dodge its
 * own rate limit, never anyone else's. Requests with no usable header share
 * the single "unknown" bucket.
 */

const IPV4_WITH_PORT = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/;
const IPV6_BRACKETED = /^\[([0-9a-fA-F:.]+)\](?::\d{1,5})?$/;
const IP_CHARSET = /^[0-9a-fA-F:.]{1,45}$/;

export const UNKNOWN_IP = "unknown";

/** Trim, strip a port suffix / IPv6 brackets, and reject garbage. */
function normaliseCandidate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim().replace(/^"|"$/g, "");
  if (value.length === 0) return null;
  const v4 = IPV4_WITH_PORT.exec(value);
  if (v4) value = v4[1];
  const v6 = IPV6_BRACKETED.exec(value);
  if (v6) value = v6[1];
  return IP_CHARSET.test(value) ? value : null;
}

/** TRUSTED_PROXY_HOPS (default 1 = one reverse proxy / platform edge in front of the app). */
function trustedProxyHops(): number {
  const n = Number(process.env.TRUSTED_PROXY_HOPS ?? 1);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // Each proxy APPENDS the address that connected to it, so only the right-most
    // TRUSTED_PROXY_HOPS entries are trustworthy; the entry just before them is the
    // client as seen by the first trusted proxy. Left-most would be spoofable.
    const parts = forwarded.split(",").map((p) => normaliseCandidate(p)).filter((p): p is string => Boolean(p));
    if (parts.length > 0) {
      const hops = trustedProxyHops();
      const candidate = parts[Math.max(0, parts.length - hops)];
      if (candidate) return candidate;
    }
  }
  const realIp = normaliseCandidate(request.headers.get("x-real-ip"));
  if (realIp) return realIp;
  const cfIp = normaliseCandidate(request.headers.get("cf-connecting-ip"));
  if (cfIp) return cfIp;
  return UNKNOWN_IP;
}

/**
 * Pseudonymous IP fingerprint stored on leads and written to logs
 * (16 hex chars of SHA-256). It lets the team correlate abuse without
 * persisting raw addresses. It is NOT anonymisation: the IPv4 space is small
 * enough to brute-force, so treat the hash as personal data in retention
 * policies all the same.
 */
const IP_HASH_KEY: string = process.env.IP_HASH_SECRET?.trim() || randomBytes(32).toString("hex");

/**
 * Keyed (HMAC) pseudonym of the client IP. With IP_HASH_SECRET unset the key is
 * random per process, so hashes are only comparable within one deployment.
 */
export function hashClientIp(ip: string): string {
  return createHmac("sha256", IP_HASH_KEY).update(ip).digest("hex").slice(0, 16);
}
