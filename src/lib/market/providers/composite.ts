import { MarketHttpError } from "@/lib/market/http";
import { PROVIDER_TIMEOUT_MS } from "@/config/market";
import { describeError } from "@/lib/market/http";
import { isUsableQuote } from "@/lib/market/rates";
import type { MarketDataProvider, MarketQuote, MarketSymbol, PairRequest } from "@/lib/market/types";
import { pairKey } from "@/lib/market/types";

/**
 * CompositeProvider (the "fallback provider").
 *
 * Wraps an ORDERED chain of providers and answers every requested pair from
 * the first provider that (a) supports it and (b) actually returns it.
 *
 * Two passes:
 *   1. PRIMARY — in parallel, each provider is asked for the pairs it is the
 *      first supporter of (minimal upstream calls, minimal latency).
 *   2. FALLBACK — sequentially down the chain, each provider is asked for the
 *      still-unresolved pairs it supports (only when something failed).
 *
 * Per-provider isolation: a rejected promise, a hang (per-provider deadline),
 * a non-array result or junk quotes never affect other providers; the failure
 * is recorded in `errors` (safe messages only) and the chain moves on.
 */

export interface ProviderError {
  provider: string;
  message: string;
}

export interface CompositeResult {
  quotes: MarketQuote[];
  errors: ProviderError[];
}

export interface CompositeProviderOptions {
  /**
   * Hard deadline for ONE provider call (covers its internal fallbacks).
   * Defaults to 2.5 × PROVIDER_TIMEOUT_MS.
   */
  providerDeadlineMs?: number;
  /**
   * Extra attempts for TRANSIENT transport failures (network error / timeout),
   * e.g. a brief burst of SYN loss on the host's upstream path. HTTP errors are
   * never retried. Default 1 (two attempts in total).
   */
  transientRetries?: number;
  /** Delay before a retry; jittered. Injectable for tests. */
  retryDelayMs?: number;
  /** Sleep implementation; injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
  /** After an HTTP 429 a provider is skipped for this long (default 90 s). */
  rateLimitCooldownMs?: number;
  /** Clock; injectable for tests. */
  now?: () => number;
  /** Optional hook (e.g. logging) invoked for every recorded error. */
  onError?: (error: ProviderError) => void;
}

function dedupeRequests(requests: readonly PairRequest[]): PairRequest[] {
  const seen = new Set<string>();
  const out: PairRequest[] = [];
  for (const r of requests) {
    if (!r || typeof r.base !== "string" || typeof r.quote !== "string" || r.base === r.quote) continue;
    const key = pairKey(r.base, r.quote);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ base: r.base, quote: r.quote });
  }
  return out;
}

export class CompositeProvider implements MarketDataProvider {
  readonly name = "composite";
  private readonly providers: readonly MarketDataProvider[];
  private readonly deadlineMs: number;
  private readonly onError: ((error: ProviderError) => void) | undefined;
  private readonly transientRetries: number;
  /** Providers that answered HTTP 429 are skipped until this time (ms epoch). */
  private readonly cooldownUntil = new Map<string, number>();
  private readonly rateLimitCooldownMs: number;
  private readonly now: () => number;
  private readonly retryDelayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(providers: readonly MarketDataProvider[], options: CompositeProviderOptions = {}) {
    this.providers = providers;
    this.deadlineMs = options.providerDeadlineMs ?? PROVIDER_TIMEOUT_MS * 2.5;
    this.onError = options.onError;
    this.transientRetries = Math.max(0, Math.trunc(options.transientRetries ?? 1));
    this.rateLimitCooldownMs = Math.max(0, options.rateLimitCooldownMs ?? 90_000);
    this.now = options.now ?? Date.now;
    this.retryDelayMs = Math.max(0, options.retryDelayMs ?? 1200);
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  /** Provider names in chain order (for logs / diagnostics). */
  get chain(): readonly string[] {
    return this.providers.map((p) => p.name);
  }

  supports(base: MarketSymbol, quote: MarketSymbol): boolean {
    return this.providers.some((p) => p.supports(base, quote));
  }

  /** MarketDataProvider-compatible: quotes only. Never rejects. */
  async fetchQuotes(requests: PairRequest[], signal?: AbortSignal): Promise<MarketQuote[]> {
    return (await this.fetchAll(requests, signal)).quotes;
  }

  /** Quotes + the per-provider errors encountered while producing them. Never rejects. */
  async fetchAll(requests: readonly PairRequest[], signal?: AbortSignal): Promise<CompositeResult> {
    const wanted = dedupeRequests(requests);
    const resolved = new Map<string, MarketQuote>();
    const errors: ProviderError[] = [];
    if (wanted.length === 0 || this.providers.length === 0) return { quotes: [], errors };

    // Which provider is the primary (first supporter) for each pair.
    const primaryIndex = new Map<string, number>();
    const primaryBatches = new Map<number, PairRequest[]>();
    for (const r of wanted) {
      const idx = this.providers.findIndex((p) => this.safeSupports(p, r));
      if (idx < 0) continue;
      primaryIndex.set(pairKey(r.base, r.quote), idx);
      const batch = primaryBatches.get(idx) ?? [];
      batch.push(r);
      primaryBatches.set(idx, batch);
    }

    // Pass 1 — primaries in parallel.
    await Promise.all(
      Array.from(primaryBatches.entries()).map(([idx, batch]) =>
        this.callProvider(this.providers[idx], batch, signal, resolved, errors),
      ),
    );

    // Pass 2 — fallbacks, sequentially down the chain, only for unresolved pairs.
    for (let i = 0; i < this.providers.length; i++) {
      if (signal?.aborted) break;
      const provider = this.providers[i];
      const pending = wanted.filter((r) => {
        const key = pairKey(r.base, r.quote);
        return !resolved.has(key) && primaryIndex.get(key) !== i && this.safeSupports(provider, r);
      });
      if (pending.length === 0) continue;
      await this.callProvider(provider, pending, signal, resolved, errors);
    }

    return {
      quotes: wanted
        .map((r) => resolved.get(pairKey(r.base, r.quote)))
        .filter((q): q is MarketQuote => Boolean(q)),
      errors,
    };
  }

  private recordError(provider: MarketDataProvider, err: unknown, errors: ProviderError[]): void {
    if (err instanceof MarketHttpError && err.kind === "http" && err.status === 429 && this.rateLimitCooldownMs > 0) {
      this.cooldownUntil.set(provider.name, this.now() + this.rateLimitCooldownMs);
    }
    const error: ProviderError = { provider: provider.name, message: describeError(err) };
    errors.push(error);
    try {
      this.onError?.(error);
    } catch {
      /* a logging hook must never break the chain */
    }
  }

  /** `supports()` is supposed to be pure, but a throwing implementation must not break the chain. */
  private safeSupports(provider: MarketDataProvider, r: PairRequest): boolean {
    const until = this.cooldownUntil.get(provider.name);
    if (until !== undefined) {
      if (this.now() < until) return false; // rate-limited recently: let the next provider serve it
      this.cooldownUntil.delete(provider.name);
    }
    try {
      return provider.supports(r.base, r.quote) === true;
    } catch {
      return false;
    }
  }

  private async callProvider(
    provider: MarketDataProvider,
    batch: PairRequest[],
    outerSignal: AbortSignal | undefined,
    resolved: Map<string, MarketQuote>,
    errors: ProviderError[],
  ): Promise<void> {
    // Already cancelled (e.g. the SSE client went away): don't even start the call.
    if (outerSignal?.aborted) {
      this.recordError(provider, new Error("Request aborted"), errors);
      return;
    }
    const controller = new AbortController();
    const onOuterAbort = () => controller.abort();
    outerSignal?.addEventListener("abort", onOuterAbort, { once: true });

    let deadline: ReturnType<typeof setTimeout> | undefined;
    const deadlinePromise = new Promise<never>((_, reject) => {
      deadline = setTimeout(() => {
        controller.abort();
        reject(new Error(`Provider deadline of ${this.deadlineMs}ms exceeded`));
      }, this.deadlineMs);
    });

    try {
      // Called synchronously (inside the try) so a provider that throws
      // synchronously is isolated too, and an abort listener it registers is
      // in place before any caller can abort the outer signal.
      const attempt = async (): Promise<MarketQuote[]> => {
        for (let tries = 0; ; tries += 1) {
          try {
            return await provider.fetchQuotes(batch, controller.signal);
          } catch (err) {
            if (tries >= this.transientRetries || controller.signal.aborted || !isTransientError(err)) throw err;
            // jittered pause so a burst of SYN loss has a chance to clear
            await this.sleep(this.retryDelayMs + Math.floor(Math.random() * 200));
            if (controller.signal.aborted) throw err;
          }
        }
      };
      const result = await Promise.race([attempt(), deadlinePromise]);
      if (!Array.isArray(result)) throw new Error("Provider returned a non-array result");

      const requested = new Set(batch.map((r) => pairKey(r.base, r.quote)));
      for (const q of result) {
        if (!isUsableQuote(q)) continue;
        const key = pairKey(q.base, q.quote);
        if (!requested.has(key) || resolved.has(key)) continue;
        resolved.set(key, {
          base: q.base,
          quote: q.quote,
          price: q.price,
          change24hPct: q.change24hPct ?? null,
          updatedAt: q.updatedAt,
          source: q.source || provider.name,
        });
      }
    } catch (err) {
      this.recordError(provider, err, errors);
    } finally {
      if (deadline) clearTimeout(deadline);
      outerSignal?.removeEventListener("abort", onOuterAbort);
      // Swallow the deadline rejection when the provider won the race.
      deadlinePromise.catch(() => {});
    }
  }
}

/** Transport-level failures worth one retry: our own network/timeout kinds or raw socket errors. */
export function isTransientError(err: unknown): boolean {
  if (err instanceof MarketHttpError) return err.kind === "network" || err.kind === "timeout";
  const code = (err as { cause?: { code?: string }; code?: string })?.cause?.code ?? (err as { code?: string })?.code;
  if (typeof code === "string" && /^(ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|EPIPE)$/.test(code)) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /network error|timed out|fetch failed/i.test(msg);
}
