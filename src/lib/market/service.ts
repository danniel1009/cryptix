import "server-only";
import { MARKET_REFRESH_INTERVAL_MS, MARKET_UNAVAILABLE_AFTER_MS } from "@/config/market";
import { serverConfig } from "@/config/server";
import { describeError } from "@/lib/market/http";
import { buildProviderChain } from "@/lib/market/providers";
import type { CompositeResult, ProviderError } from "@/lib/market/providers/composite";
import { MOCK_SOURCE } from "@/lib/market/providers/mock";
import { buildSnapshot, computeStatus, isUsableQuote } from "@/lib/market/rates";
import type { MarketQuote, MarketSnapshot, PairRequest } from "@/lib/market/types";
import { pairKey } from "@/lib/market/types";

/**
 * Market service (server-only).
 *
 *   providers ──► CompositeProvider.fetchAll ──► merge (fresh ▸ last-good ▸ mock)
 *             ──► buildSnapshot ──► in-memory cache ──► /api/market, /api/market/stream
 *
 * Guarantees:
 * - `getMarketSnapshot()` NEVER throws.
 * - One refresh at a time: concurrent callers share the in-flight promise.
 * - Cache TTL = MARKET_REFRESH_INTERVAL_MS, measured from the START of the last
 *   refresh (failures count too, so a dead upstream is not hammered).
 * - Last-good retention: a pair whose providers fail keeps its previous real
 *   quote; `snapshot.updatedAt` stops advancing so the status decays to
 *   stale → unavailable by age. Old prices are never re-labelled as fresh.
 * - Production never uses mock data: when `allowMock` is false, mock-sourced
 *   quotes are dropped even if a mock provider somehow ends up in the chain.
 *   Outside production the mock fills ONLY pairs no real provider supplied and
 *   `snapshot.sources` reports it honestly ("mock" ⇒ dev badge in the UI).
 */

/** Pairs the rate engine needs: direct quotes for every supported pair + bridges. */
export const REQUIRED_PAIRS: readonly PairRequest[] = [
  { base: "BTC", quote: "USDT" },
  { base: "ETH", quote: "BTC" },
  { base: "SOL", quote: "BTC" },
  { base: "USDT", quote: "IDR" },
  { base: "ETH", quote: "USDT" },
  { base: "SOL", quote: "USDT" },
  { base: "BTC", quote: "USD" },
  { base: "ETH", quote: "USD" },
  { base: "SOL", quote: "USD" },
  { base: "USDT", quote: "USD" },
];

/** Nice-to-have pairs; their absence is not reported as an error. */
export const OPTIONAL_PAIRS: readonly PairRequest[] = [{ base: "BTC", quote: "IDR" }];

/** Anything with `fetchAll` (the CompositeProvider) — injectable for tests. */
export interface SnapshotSource {
  readonly name: string;
  fetchAll(requests: readonly PairRequest[], signal?: AbortSignal): Promise<CompositeResult>;
}

export interface MarketServiceOptions {
  provider: SnapshotSource;
  spread: number;
  allowMock: boolean;
  refreshIntervalMs?: number;
  /**
   * Keep refreshing in the background even with no visitors, so the provider
   * keep-alive connections stay warm and the first visitor never pays for a
   * cold (often failing) connection. Default: on outside tests.
   */
  warmRefresh?: boolean;
  requests?: readonly PairRequest[];
  optionalRequests?: readonly PairRequest[];
  /** Injectable clock (ms since epoch). */
  now?: () => number;
  /** Where warnings go; null silences. Defaults to console. */
  logger?: Pick<Console, "warn" | "info"> | null;
}

export interface MarketService {
  /** Cached within the refresh interval; otherwise refreshes (shared in-flight). Never throws. */
  getMarketSnapshot(options?: { force?: boolean }): Promise<MarketSnapshot>;
  /** The last produced snapshot with its status recomputed by age; null before the first refresh. */
  getCachedSnapshot(): MarketSnapshot | null;
  /** True while a refresh is running. */
  isRefreshing(): boolean;
  /** Stop the background warm-refresh loop (tests / shutdown). */
  stop(): void;
  /** Drop all state (tests / hot reload). */
  reset(): void;
}

const ERROR_MAX_CHARS = 240;

/** Public, secret-free summary for the snapshot: provider NAMES and missing pairs only. */
function publicError(errors: readonly ProviderError[], missingRequired: readonly string[]): string | null {
  const parts: string[] = [];
  const providers = Array.from(new Set(errors.map((e) => e.provider))).sort();
  if (providers.length) parts.push(`providers unavailable: ${providers.join(", ")}`);
  if (missingRequired.length) parts.push(`missing pairs: ${missingRequired.join(", ")}`);
  return parts.length ? parts.join("; ") : null;
}

const WARN_THROTTLE_MS = 5 * 60_000;
const lastWarnAt = new Map<string, number>();
/** Log a warning once per distinct message per WARN_THROTTLE_MS (state transitions still log immediately). */
export function throttledWarn(logger: { warn: (msg: string) => void }, key: string, message: string, at = Date.now()): void {
  const last = lastWarnAt.get(key);
  if (last !== undefined && at - last < WARN_THROTTLE_MS) return;
  lastWarnAt.set(key, at);
  logger.warn(message);
}

function formatErrors(errors: readonly ProviderError[], missingRequired: readonly string[]): string | null {
  const parts: string[] = [];
  for (const e of errors.slice(0, 3)) parts.push(`${e.provider}: ${e.message}`);
  if (errors.length > 3) parts.push(`+${errors.length - 3} more`);
  if (missingRequired.length > 0) parts.push(`missing quotes: ${missingRequired.join(", ")}`);
  if (parts.length === 0) return null;
  return parts.join(" · ").slice(0, ERROR_MAX_CHARS);
}

export function createMarketService(options: MarketServiceOptions): MarketService {
  const {
    provider,
    spread,
    allowMock,
    refreshIntervalMs = MARKET_REFRESH_INTERVAL_MS,
    requests = REQUIRED_PAIRS,
    optionalRequests = OPTIONAL_PAIRS,
    now = Date.now,
    warmRefresh = process.env.NODE_ENV !== "test",
  } = options;
  const logger = options.logger === undefined ? console : options.logger;
  const allRequests: PairRequest[] = [...requests, ...optionalRequests];
  const requiredKeys = new Set(requests.map((r) => pairKey(r.base, r.quote)));

  let snapshot: MarketSnapshot | null = null;
  /** Real (non-mock) quotes by pair key, kept across failed refreshes. */
  const lastGood = new Map<string, MarketQuote>();
  let lastRefreshStartedAt = Number.NEGATIVE_INFINITY;
  let inFlight: Promise<MarketSnapshot> | null = null;

  function withCurrentStatus(snap: MarketSnapshot, at: number): MarketSnapshot {
    const status = computeStatus(snap.updatedAt, at);
    return status === snap.status ? snap : { ...snap, status };
  }

  async function refresh(startedAt: number): Promise<MarketSnapshot> {
    lastRefreshStartedAt = startedAt;

    let result: CompositeResult;
    try {
      result = await provider.fetchAll(allRequests);
    } catch (err) {
      result = { quotes: [], errors: [{ provider: provider.name, message: describeError(err) }] };
    }

    const finishedAt = now();
    const generatedAt = new Date(finishedAt).toISOString();

    try {
      const freshReal = new Map<string, MarketQuote>();
      const freshMock = new Map<string, MarketQuote>();
      for (const q of Array.isArray(result.quotes) ? result.quotes : []) {
        if (!isUsableQuote(q)) continue;
        const key = pairKey(q.base, q.quote);
        if (q.source === MOCK_SOURCE) {
          if (allowMock) freshMock.set(key, q); // production: dropped, full stop
        } else {
          freshReal.set(key, q);
          lastGood.set(key, q);
        }
      }

      // Last-good quotes are retained only within the unavailable window: a pair whose
      // provider is down must drop out (and show as unavailable) rather than be re-served
      // indefinitely under a snapshot that other providers keep "live".
      for (const [key, q] of lastGood) {
        if (finishedAt - Date.parse(q.updatedAt) > MARKET_UNAVAILABLE_AFTER_MS) lastGood.delete(key);
      }

      // Merge priority: fresh real ▸ last-good real ▸ (dev only) fresh mock.
      const merged: MarketQuote[] = [];
      let usedMock = false;
      const missingRequired: string[] = [];
      for (const r of allRequests) {
        const key = pairKey(r.base, r.quote);
        const q = freshReal.get(key) ?? lastGood.get(key) ?? freshMock.get(key);
        if (q) {
          merged.push(q);
          if (q.source === MOCK_SOURCE) usedMock = true;
        } else if (requiredKeys.has(key)) {
          missingRequired.push(key);
        }
      }

      const anyFresh = freshReal.size > 0 || usedMock;
      const updatedAt = anyFresh ? generatedAt : (snapshot?.updatedAt ?? null);
      const errors = Array.isArray(result.errors) ? result.errors : [];
      const detailedError = formatErrors(errors, missingRequired);
      const error = publicError(errors, missingRequired);

      if (detailedError && logger) throttledWarn(logger, detailedError, `[market] refresh finished with problems — ${detailedError}`, finishedAt);

      snapshot = buildSnapshot({ quotes: merged, spread, updatedAt, generatedAt, error });
      return snapshot;
    } catch (err) {
      // Defensive: the merge above is pure, but the service must never throw.
      if (logger) logger.warn(`[market] refresh failed: ${describeError(err)}`);
      snapshot = buildSnapshot({
        quotes: snapshot?.quotes ?? [],
        spread,
        updatedAt: snapshot?.updatedAt ?? null,
        generatedAt,
        error: "Market refresh failed",
      });
      return snapshot;
    }
  }

  function getMarketSnapshot(opts?: { force?: boolean }): Promise<MarketSnapshot> {
    const at = now();
    const fresh = snapshot !== null && at - lastRefreshStartedAt < refreshIntervalMs;
    if (!opts?.force && fresh) return Promise.resolve(withCurrentStatus(snapshot as MarketSnapshot, at));
    if (inFlight) return inFlight;
    inFlight = refresh(at).finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  // Warm loop: refresh on the cadence regardless of traffic. `unref` keeps it
  // from holding the process open; errors never escape (getMarketSnapshot never throws).
  let warmTimer: ReturnType<typeof setInterval> | null = null;
  if (warmRefresh) {
    warmTimer = setInterval(() => {
      void getMarketSnapshot().catch(() => {});
    }, refreshIntervalMs);
    warmTimer.unref?.();
  }

  return {
    getMarketSnapshot,
    getCachedSnapshot() {
      return snapshot ? withCurrentStatus(snapshot, now()) : null;
    },
    isRefreshing() {
      return inFlight !== null;
    },
    reset() {
      snapshot = null;
      lastGood.clear();
      lastRefreshStartedAt = Number.NEGATIVE_INFINITY;
      inFlight = null;
    },
    stop() {
      if (warmTimer) clearInterval(warmTimer);
      warmTimer = null;
    },
  };
}

/* ───────────────────────────── process singleton ───────────────────────────── */

// Stored on globalThis so the /api/market and /api/market/stream bundles (which
// may be separate module graphs in dev) share ONE cache and ONE in-flight refresh.
const GLOBAL_KEY = "__cryptixMarketService" as const;

type GlobalWithService = typeof globalThis & { [GLOBAL_KEY]?: MarketService };

function getDefaultService(): MarketService {
  const g = globalThis as GlobalWithService;
  if (!g[GLOBAL_KEY]) {
    const chain = buildProviderChain(serverConfig, {
      onError: (e) => throttledWarn(console, `provider:${e.provider}:${e.message}`, `[market] provider ${e.provider} failed: ${e.message}`),
    });
    console.info(`[market] provider chain: ${chain.chain.join(" → ") || "(none)"}`);
    g[GLOBAL_KEY] = createMarketService({
      provider: chain,
      spread: serverConfig.exchange.spread,
      allowMock: serverConfig.market.allowMock,
    });
  }
  return g[GLOBAL_KEY] as MarketService;
}

/** Current snapshot (cached ≤ MARKET_REFRESH_INTERVAL_MS). Never throws. */
export function getMarketSnapshot(options?: { force?: boolean }): Promise<MarketSnapshot> {
  return getDefaultService().getMarketSnapshot(options);
}

/** Last produced snapshot with status recomputed by age — no provider calls. */
export function getCachedSnapshot(): MarketSnapshot | null {
  return getDefaultService().getCachedSnapshot();
}
