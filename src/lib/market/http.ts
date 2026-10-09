import { Agent as UndiciAgent, type Dispatcher } from "undici";
import { PROVIDER_TIMEOUT_MS } from "@/config/market";

/**
 * Minimal JSON HTTP client used by every market-data provider.
 *
 * Design goals:
 * - Every call has a hard timeout (AbortController) so a slow upstream can
 *   never hang the market service.
 * - Errors are typed (`MarketHttpError`) and their messages are SAFE to store
 *   in `MarketSnapshot.error` and to log: they contain only the request origin
 *   + pathname (never the query string, never headers, never API keys).
 * - Works with the native `fetch` (Node ≥ 18 / Next.js runtime); no dependencies.
 */

export type MarketHttpErrorKind = "timeout" | "aborted" | "network" | "http" | "parse";

export class MarketHttpError extends Error {
  readonly kind: MarketHttpErrorKind;
  /** HTTP status for `kind === "http"`, otherwise undefined. */
  readonly status: number | undefined;
  /** Origin + pathname of the request. The query string is deliberately dropped. */
  readonly url: string;

  constructor(
    kind: MarketHttpErrorKind,
    message: string,
    options: { url: string; status?: number; cause?: unknown },
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "MarketHttpError";
    this.kind = kind;
    this.status = options.status;
    this.url = options.url;
  }
}

/** Origin + pathname only. Never leaks query parameters (which may carry keys). */
export function safeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return "<invalid-url>";
  }
}

/**
 * Provider calls share ONE dispatcher with a long keep-alive. The VPS path to
 * Cloudflare-fronted hosts (Indodax, CoinGecko) drops many SYN packets, so a
 * NEW TCP connection fails most of the time while an established one is
 * reliable (measured 2026-10-09: 17/20 ETIMEDOUT on fresh connections vs 20/20
 * OK on a reused one). Node's default agent closes idle sockets after 4 s —
 * shorter than the refresh cadence — which is exactly the failure mode.
 */
let keepAliveDispatcher: Dispatcher | null = null;
export function getKeepAliveDispatcher(): Dispatcher {
  if (!keepAliveDispatcher) {
    keepAliveDispatcher = new UndiciAgent({
      keepAliveTimeout: 120_000,
      keepAliveMaxTimeout: 600_000,
      connections: 8,
      pipelining: 1,
    });
  }
  return keepAliveDispatcher;
}

/** Identifies our service to upstreams (some CDNs score anonymous agents as bots). */
export const PROVIDER_USER_AGENT = "Cryptix-MarketFeed/1.0 (+https://cryptix.id)";

export interface FetchJsonOptions {
  /** Extra request headers (API keys go here, never in the URL). */
  headers?: Record<string, string>;
  /** Hard timeout; defaults to PROVIDER_TIMEOUT_MS. */
  timeoutMs?: number;
  /** Optional outer signal (e.g. the composite provider's per-provider deadline). */
  signal?: AbortSignal;
}

const ERROR_HINT_MAX_CHARS = 120;

/**
 * Extract a short, printable hint from an error response body such as
 * `{"code":-1121,"msg":"Invalid symbol."}` or `{"Error":"request rate exceeded…"}`.
 * Only well-known message fields are used, never the whole body.
 */
async function readErrorHint(response: Response): Promise<string> {
  try {
    const text = (await response.text()).slice(0, 2_000);
    let hint = "";
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed && typeof parsed === "object") {
        const rec = parsed as Record<string, unknown>;
        for (const field of ["msg", "message", "Error", "error", "status"]) {
          const v = rec[field];
          if (typeof v === "string" && v.trim()) {
            hint = v.trim();
            break;
          }
          if (v && typeof v === "object") {
            const inner = (v as Record<string, unknown>).error_message;
            if (typeof inner === "string" && inner.trim()) {
              hint = inner.trim();
              break;
            }
          }
        }
      }
    } catch {
      /* not JSON – ignore the body entirely */
    }
    // Printable ASCII only; strip anything that looks like control characters.
    return hint.replace(/[^\x20-\x7E]/g, "").slice(0, ERROR_HINT_MAX_CHARS);
  } catch {
    return "";
  }
}

/**
 * GET `url` and parse the JSON body. Rejects with `MarketHttpError` only.
 */
export async function fetchJson<T = unknown>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const { headers, timeoutMs = PROVIDER_TIMEOUT_MS, signal } = options;
  const display = safeUrl(url);

  if (signal?.aborted) {
    throw new MarketHttpError("aborted", `Request aborted: ${display}`, { url: display });
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onOuterAbort = () => controller.abort();
  signal?.addEventListener("abort", onOuterAbort, { once: true });

  try {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: { accept: "application/json", "user-agent": PROVIDER_USER_AGENT, ...(headers ?? {}) },
        signal: controller.signal,
        cache: "no-store",
        // Node's fetch honours an undici dispatcher (duck-typed); test stubs ignore it.
        ...({ dispatcher: getKeepAliveDispatcher() } as object),
      });
    } catch (cause) {
      if (timedOut) {
        throw new MarketHttpError("timeout", `Request timed out after ${timeoutMs}ms: ${display}`, {
          url: display,
          cause,
        });
      }
      if (controller.signal.aborted) {
        throw new MarketHttpError("aborted", `Request aborted: ${display}`, { url: display, cause });
      }
      throw new MarketHttpError("network", `Network error: ${display}`, { url: display, cause });
    }

    if (!response.ok) {
      const hint = await readErrorHint(response);
      throw new MarketHttpError(
        "http",
        `HTTP ${response.status} from ${display}${hint ? ` (${hint})` : ""}`,
        { url: display, status: response.status },
      );
    }

    try {
      return (await response.json()) as T;
    } catch (cause) {
      throw new MarketHttpError("parse", `Invalid JSON from ${display}`, { url: display, cause });
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onOuterAbort);
  }
}

/** Short, safe, single-line description of any thrown value (for snapshot.error / logs). */
export function describeError(err: unknown, maxChars = 200): string {
  let message: string;
  if (err instanceof Error) message = err.message || err.name;
  else if (typeof err === "string") message = err;
  else message = "Unknown error";
  return message.replace(/\s+/g, " ").trim().slice(0, maxChars) || "Unknown error";
}

/* ────────────────────────── response parsing helpers ────────────────────────── */

/** Coerce a JSON value (number or numeric string) to a finite number, else null. */
export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Like `toFiniteNumber` but requires `> 0` (a price). */
export function toPositiveNumber(value: unknown): number | null {
  const n = toFiniteNumber(value);
  return n !== null && n > 0 ? n : null;
}

/**
 * Convert an epoch timestamp (seconds or milliseconds) to ISO-8601.
 * Falls back to `fallback` (default: now) when the value is missing or absurd.
 */
export function epochToIso(value: unknown, fallback: number = Date.now()): string {
  const n = toFiniteNumber(value);
  if (n === null || n <= 0) return new Date(fallback).toISOString();
  // Anything below 1e12 is almost certainly seconds (year 2001 in ms is 1e12).
  const ms = n < 1e12 ? n * 1000 : n;
  // Reject timestamps more than a day in the future or before 2015 (junk guard).
  if (ms > fallback + 86_400_000 || ms < 1_420_070_400_000) return new Date(fallback).toISOString();
  return new Date(ms).toISOString();
}

/** Strip a trailing slash so `${base}/path` never produces `//path`. */
export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}
