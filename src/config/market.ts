/**
 * Public (client-safe) market data timing configuration.
 * Provider selection and API keys are in `src/config/server.ts`.
 */

/** How often the server re-queries providers (in-memory cache TTL). */
export const MARKET_REFRESH_INTERVAL_MS = 10_000;
/** How often the SSE stream pushes a snapshot to connected clients. */
export const MARKET_STREAM_PUSH_INTERVAL_MS = 5_000;
/** SSE keep-alive comment interval. */
export const MARKET_STREAM_HEARTBEAT_MS = 15_000;
/** A snapshot whose last successful update is older than this is STALE. */
export const MARKET_STALE_AFTER_MS = 90_000;
/** Older than this (or never fetched) is UNAVAILABLE. */
export const MARKET_UNAVAILABLE_AFTER_MS = 5 * 60_000;
/** Client-side fallback polling interval when the stream cannot connect. */
export const CLIENT_POLL_INTERVAL_MS = 15_000;
/** Client gives up on SSE after this many consecutive failures and polls instead. */
export const CLIENT_STREAM_MAX_FAILURES = 3;
/** Upstream HTTP timeout per provider call. */
export const PROVIDER_TIMEOUT_MS = 6_000;
