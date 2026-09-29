import { createHash } from "node:crypto";

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

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // "client, proxy1, proxy2" → the left-most entry is the original client.
    const first = normaliseCandidate(forwarded.split(",")[0]);
    if (first) return first;
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
export function hashClientIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}
