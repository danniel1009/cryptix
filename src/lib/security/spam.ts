/**
 * Cheap, deterministic spam heuristics for the lead forms.
 *
 * These run BEFORE validation so obvious bots never cost a delivery call.
 * Every rule is conservative: a false positive silently drops a real lead,
 * which is worse than letting an occasional junk message through.
 * Pure module — safe to unit-test and to reuse from any runtime.
 */

export type SpamReason =
  | "honeypot"
  | "too_fast"
  | "too_many_urls"
  | "repeated_characters"
  | "spam_pattern";

export interface SpamCheckInput {
  /** Honeypot field value. A human never sees the field, so anything non-empty is a bot. */
  hp?: unknown;
  /** Client timestamp (ms) taken when the form was rendered. */
  ts?: unknown;
  /** Server "now" in ms. Defaults to Date.now(). */
  now?: number;
  /** Concatenated free-text fields to inspect. */
  text?: string;
  /** Submissions faster than this (ms after render) are treated as automated. */
  minFillTimeMs?: number;
  /** More than this many URLs in `text` is spam. Default 3. */
  maxUrls?: number;
}

export interface SpamCheckResult {
  spam: boolean;
  reason?: SpamReason;
}

export const DEFAULT_MIN_FILL_TIME_MS = 2_500;
export const DEFAULT_MAX_URLS = 3;

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;
/** The same non-whitespace character 10+ times in a row ("aaaaaaaaaa", "!!!!!!!!!!"). */
const REPEATED_CHAR = /([^\s])\1{9,}/;
/** The same word (2+ letters/digits) repeated 6+ times in a row. */
const REPEATED_WORD = /\b([\p{L}\p{N}]{2,})(?:\s+\1\b){5,}/iu;

/**
 * Known spam phrases. Deliberately short and specific — this is a crypto site,
 * so words like "crypto", "bitcoin", "rate" or "exchange" must NOT be flagged.
 */
const SPAM_PATTERNS: readonly RegExp[] = [
  /\b(?:viagra|cialis|casino|porn|xxx)\b/i,
  /\bseo (?:services?|ranking|optimi[sz]ation)\b/i,
  /\bbacklinks?\b/i,
  /\b(?:guaranteed|make|earn) money (?:fast|online|from home)\b/i,
  /\bwork from home\b/i,
  /\bclick here\b/i,
  /\[url=/i,
  /<a\s+href/i,
  /\bbuy (?:followers|likes|subscribers|views)\b/i,
  /\bfree (?:bitcoin|btc|crypto|giveaway)\b/i,
  /\bdouble your (?:bitcoin|btc|crypto|money|investment)\b/i,
  /\bgiveaway\b/i,
  /\bwe (?:offer|provide) (?:web|website|app) (?:design|development)\b/i,
];

/** Count URLs in a text. */
export function countUrls(text: string): number {
  const matches = text.match(URL_PATTERN);
  return matches ? matches.length : 0;
}

/** Join the string-valued fields of a raw request body for inspection. */
export function collectTextFields(body: Record<string, unknown>, keys?: readonly string[]): string {
  const source = keys ?? Object.keys(body);
  const parts: string[] = [];
  for (const key of source) {
    const value = body[key];
    if (typeof value === "string" && value.length > 0) parts.push(value);
  }
  return parts.join("\n");
}

export function isLikelySpam(input: SpamCheckInput): SpamCheckResult {
  const { hp, ts } = input;
  const now = input.now ?? Date.now();
  const text = input.text ?? "";
  const minFillTimeMs = input.minFillTimeMs ?? DEFAULT_MIN_FILL_TIME_MS;
  const maxUrls = input.maxUrls ?? DEFAULT_MAX_URLS;

  // 1. Honeypot: hidden field that humans cannot fill.
  if (hp !== undefined && hp !== null && String(hp).trim().length > 0) {
    return { spam: true, reason: "honeypot" };
  }

  // 2. Fill time. Only judged when the client sent a plausible timestamp and
  //    its clock is not ahead of ours (a client clock ahead by a minute would
  //    otherwise look "instant"). Missing/invalid `ts` is NOT flagged: the
  //    heuristic is weak by nature and must never reject a real person.
  if (typeof ts === "number" && Number.isFinite(ts) && minFillTimeMs > 0) {
    const elapsed = now - ts;
    if (elapsed >= 0 && elapsed < minFillTimeMs) return { spam: true, reason: "too_fast" };
  }

  if (text.length === 0) return { spam: false };

  // 3. Link stuffing.
  if (countUrls(text) > maxUrls) return { spam: true, reason: "too_many_urls" };

  // 4. Keyboard mashing / padding.
  if (REPEATED_CHAR.test(text) || REPEATED_WORD.test(text)) {
    return { spam: true, reason: "repeated_characters" };
  }

  // 5. Known spam phrases.
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) return { spam: true, reason: "spam_pattern" };
  }

  return { spam: false };
}
