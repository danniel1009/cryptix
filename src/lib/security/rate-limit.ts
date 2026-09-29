/**
 * Sliding-window rate limiter.
 *
 * The default store is IN-MEMORY and therefore PER INSTANCE: on a multi-instance
 * or serverless deployment each instance keeps its own counters, so the
 * effective limit is `max × instances`. That is acceptable for a
 * lead-generation form (the goal is to blunt abuse, not to bill precisely).
 * To make the limit global, implement `RateLimitStore` on Upstash/Redis
 * (e.g. a ZSET per key with ZREMRANGEBYSCORE + ZADD + ZCARD in a MULTI) and
 * pass it via `createRateLimiter({ store })`; consumers `await check()`,
 * which is why `RateLimiter.check` may return a Promise.
 *
 * No timers are used: pruning happens lazily during `check()` (at most once
 * per `pruneIntervalMs`) so the limiter never keeps a serverless process alive.
 */

export interface RateLimitResult {
  /** Whether the request may proceed. */
  allowed: boolean;
  /** Requests left in the current window (0 when blocked). */
  remaining: number;
  /** Seconds until a blocked caller may retry (0 when allowed). Always ≥ 1 when blocked. */
  retryAfterSeconds: number;
  /** The configured maximum, echoed for convenience (e.g. RateLimit-Limit header). */
  limit: number;
  /** Epoch ms when the oldest hit in the window expires. */
  resetAt: number;
}

/** Minimal key → hit-timestamps storage. The in-memory version is a Map. */
export interface RateLimitStore {
  get(key: string): number[] | undefined;
  set(key: string, hits: number[]): void;
  delete(key: string): void;
  entries(): IterableIterator<[string, number[]]>;
  clear(): void;
}

/** What API routes depend on. Implementations may be sync (memory) or async (Redis). */
export interface RateLimiter {
  check(key: string, now?: number): RateLimitResult | Promise<RateLimitResult>;
  reset(key: string): void | Promise<void>;
}

/** The in-memory limiter: fully synchronous, with a few introspection helpers for tests/ops. */
export interface InMemoryRateLimiter extends RateLimiter {
  check(key: string, now?: number): RateLimitResult;
  reset(key: string): void;
  /** Drop expired hits and empty keys. Returns the number of keys still tracked. */
  prune(now?: number): number;
  /** Number of keys currently tracked. */
  size(): number;
  /** Forget everything. */
  clear(): void;
}

export interface RateLimitOptions {
  /** Maximum hits per key per window. Must be an integer ≥ 1. */
  max: number;
  /** Window length in milliseconds. Must be > 0. */
  windowMs: number;
  /** How often (at most) a full sweep of expired keys runs. Defaults to `windowMs`. */
  pruneIntervalMs?: number;
  /** Alternative storage. Defaults to a fresh in-memory Map. */
  store?: RateLimitStore;
  /** Clock override for tests. Defaults to `Date.now`. */
  now?: () => number;
}

export function createMemoryStore(): RateLimitStore {
  const map = new Map<string, number[]>();
  return {
    get: (key) => map.get(key),
    set: (key, hits) => {
      map.set(key, hits);
    },
    delete: (key) => {
      map.delete(key);
    },
    entries: () => map.entries(),
    clear: () => map.clear(),
  };
}

function countEntries(store: RateLimitStore): number {
  let count = 0;
  for (const entry of store.entries()) {
    if (entry) count += 1;
  }
  return count;
}

export function createRateLimiter(options: RateLimitOptions): InMemoryRateLimiter {
  const { max, windowMs } = options;
  if (!Number.isInteger(max) || max < 1) {
    throw new RangeError(`createRateLimiter: max must be an integer >= 1 (got ${max})`);
  }
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new RangeError(`createRateLimiter: windowMs must be > 0 (got ${windowMs})`);
  }
  const pruneIntervalMs =
    options.pruneIntervalMs !== undefined && options.pruneIntervalMs > 0
      ? options.pruneIntervalMs
      : windowMs;
  const store = options.store ?? createMemoryStore();
  const clock = options.now ?? Date.now;
  let lastSweepAt = clock();

  /** Hits for `key` that are still inside the window ending at `now`. */
  function liveHits(key: string, now: number): number[] {
    const hits = store.get(key);
    if (!hits || hits.length === 0) return [];
    const cutoff = now - windowMs;
    // Timestamps are appended in order, so find the first live one and slice.
    let firstLive = 0;
    while (firstLive < hits.length && hits[firstLive] <= cutoff) firstLive += 1;
    return firstLive === 0 ? hits : hits.slice(firstLive);
  }

  function prune(now = clock()): number {
    const cutoff = now - windowMs;
    for (const [key, hits] of Array.from(store.entries())) {
      const live = hits.filter((t) => t > cutoff);
      if (live.length === 0) store.delete(key);
      else if (live.length !== hits.length) store.set(key, live);
    }
    lastSweepAt = now;
    return countEntries(store);
  }

  function check(key: string, now = clock()): RateLimitResult {
    if (now - lastSweepAt >= pruneIntervalMs) prune(now);
    const hits = liveHits(key, now);
    if (hits.length >= max) {
      // The oldest hit in the window decides when a slot frees up.
      const resetAt = hits[0] + windowMs;
      store.set(key, hits);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
        limit: max,
        resetAt,
      };
    }
    const next = hits.concat(now);
    store.set(key, next);
    return {
      allowed: true,
      remaining: max - next.length,
      retryAfterSeconds: 0,
      limit: max,
      resetAt: next[0] + windowMs,
    };
  }

  return {
    check,
    reset: (key) => store.delete(key),
    prune,
    size: () => countEntries(store),
    clear: () => store.clear(),
  };
}
