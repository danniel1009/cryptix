import { describe, expect, it } from "vitest";
import { createMemoryStore, createRateLimiter } from "@/lib/security/rate-limit";

const WINDOW = 60_000;

describe("createRateLimiter", () => {
  it("allows `max` hits in a window and blocks the next one", () => {
    const limiter = createRateLimiter({ max: 3, windowMs: WINDOW, now: () => 0 });
    const t0 = 1_000;
    expect(limiter.check("ip", t0)).toMatchObject({ allowed: true, remaining: 2, retryAfterSeconds: 0, limit: 3 });
    expect(limiter.check("ip", t0 + 1)).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.check("ip", t0 + 2)).toMatchObject({ allowed: true, remaining: 0 });
    const blocked = limiter.check("ip", t0 + 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    // Oldest hit was at t0 → frees at t0 + WINDOW → ceil((WINDOW - 3) / 1000) = 60 s.
    expect(blocked.retryAfterSeconds).toBe(60);
    expect(blocked.resetAt).toBe(t0 + WINDOW);
  });

  it("blocked calls do not count as hits", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: WINDOW });
    expect(limiter.check("k", 0).allowed).toBe(true);
    expect(limiter.check("k", 10).allowed).toBe(false);
    expect(limiter.check("k", 20).allowed).toBe(false);
    // Once the single hit at t=0 expires the caller is allowed again immediately.
    expect(limiter.check("k", WINDOW + 1).allowed).toBe(true);
  });

  it("slides: a slot frees when the OLDEST hit leaves the window", () => {
    const limiter = createRateLimiter({ max: 2, windowMs: WINDOW });
    limiter.check("k", 0);
    limiter.check("k", 30_000);
    expect(limiter.check("k", 40_000).allowed).toBe(false);
    expect(limiter.check("k", 40_000).retryAfterSeconds).toBe(20);
    expect(limiter.check("k", WINDOW + 1).allowed).toBe(true); // hit@0 expired
    expect(limiter.check("k", WINDOW + 2).allowed).toBe(false); // hit@30s + hit@60.001s still live
  });

  it("retryAfterSeconds is never below 1 second", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1_500 });
    limiter.check("k", 0);
    expect(limiter.check("k", 1_400).retryAfterSeconds).toBe(1);
  });

  it("keys are independent", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: WINDOW });
    expect(limiter.check("a", 0).allowed).toBe(true);
    expect(limiter.check("b", 0).allowed).toBe(true);
    expect(limiter.check("a", 1).allowed).toBe(false);
    expect(limiter.check("b", 1).allowed).toBe(false);
  });

  it("reset() forgets a key", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: WINDOW });
    limiter.check("k", 0);
    expect(limiter.check("k", 1).allowed).toBe(false);
    limiter.reset("k");
    expect(limiter.check("k", 2).allowed).toBe(true);
  });

  it("prune() drops expired hits and empty keys", () => {
    const limiter = createRateLimiter({ max: 5, windowMs: WINDOW, now: () => 0 });
    limiter.check("old", 0);
    limiter.check("mixed", 0);
    limiter.check("mixed", 50_000);
    limiter.check("fresh", 55_000);
    expect(limiter.size()).toBe(3);
    expect(limiter.prune(WINDOW + 1)).toBe(2); // "old" removed, "mixed" trimmed to one hit
    expect(limiter.size()).toBe(2);
    expect(limiter.check("mixed", WINDOW + 2).remaining).toBe(3); // 1 live hit + this one
  });

  it("sweeps lazily during check() once pruneIntervalMs has elapsed", () => {
    const limiter = createRateLimiter({ max: 5, windowMs: WINDOW, pruneIntervalMs: 10_000, now: () => 0 });
    limiter.check("stale", 0);
    expect(limiter.size()).toBe(1);
    // Before the interval: nothing swept even though "stale" would still be live anyway.
    limiter.check("other", 5_000);
    expect(limiter.size()).toBe(2);
    // After the window AND the interval: the stale key disappears as a side effect of another key's check.
    limiter.check("other", WINDOW + 20_000);
    expect(limiter.size()).toBe(1);
  });

  it("uses the injected clock when `now` is not passed to check()", () => {
    let clock = 0;
    const limiter = createRateLimiter({ max: 1, windowMs: WINDOW, now: () => clock });
    expect(limiter.check("k").allowed).toBe(true);
    clock = 10;
    expect(limiter.check("k").allowed).toBe(false);
    clock = WINDOW + 1;
    expect(limiter.check("k").allowed).toBe(true);
  });

  it("accepts a custom store (the seam for Redis/Upstash)", () => {
    const store = createMemoryStore();
    const limiter = createRateLimiter({ max: 1, windowMs: WINDOW, store });
    limiter.check("k", 0);
    expect(store.get("k")).toEqual([0]);
    limiter.clear();
    expect(store.get("k")).toBeUndefined();
  });

  it("rejects invalid options", () => {
    expect(() => createRateLimiter({ max: 0, windowMs: WINDOW })).toThrow(RangeError);
    expect(() => createRateLimiter({ max: 1.5, windowMs: WINDOW })).toThrow(RangeError);
    expect(() => createRateLimiter({ max: 1, windowMs: 0 })).toThrow(RangeError);
    expect(() => createRateLimiter({ max: 1, windowMs: Number.NaN })).toThrow(RangeError);
  });
});
