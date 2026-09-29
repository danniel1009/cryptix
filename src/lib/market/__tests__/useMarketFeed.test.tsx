/** @vitest-environment jsdom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLIENT_POLL_INTERVAL_MS, CLIENT_STREAM_MAX_FAILURES, MARKET_STALE_AFTER_MS, MARKET_UNAVAILABLE_AFTER_MS } from "@/config/market";
import { STATUS_TICK_MS, STREAM_RETRY_INTERVAL_MS, effectiveUpdatedAt, isSnapshotLike, useMarketFeed, HIDDEN_PAUSE_GRACE_MS } from "@/hooks/useMarketFeed";
import type { MarketSnapshot } from "@/lib/market/types";

/** Minimal EventSource double with test hooks. */
class FakeEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static instances: FakeEventSource[] = [];
  readyState = FakeEventSource.CONNECTING;
  onopen: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  closed = false;
  private listeners = new Map<string, Set<(e: MessageEvent) => void>>();
  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, fn: (e: MessageEvent) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }
  removeEventListener(type: string, fn: (e: MessageEvent) => void) {
    this.listeners.get(type)?.delete(fn);
  }
  close() {
    this.closed = true;
    this.readyState = FakeEventSource.CLOSED;
  }
  // test helpers
  open() {
    this.readyState = FakeEventSource.OPEN;
    this.onopen?.(new Event("open"));
  }
  emit(type: string, data: unknown) {
    for (const fn of this.listeners.get(type) ?? []) fn(new MessageEvent(type, { data: JSON.stringify(data) }));
  }
  fail(final = false) {
    this.readyState = final ? FakeEventSource.CLOSED : FakeEventSource.CONNECTING;
    this.onerror?.(new Event("error"));
  }
  static get live(): FakeEventSource[] {
    return FakeEventSource.instances.filter((s) => !s.closed);
  }
}

function snapshot(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  const iso = new Date().toISOString();
  return { status: "live", generatedAt: iso, updatedAt: iso, spread: 0.05, quotes: [], rates: [], sources: ["binance"], error: null, ...overrides };
}

const fetchMock = vi.fn();
function respondWith(snap: MarketSnapshot) {
  fetchMock.mockImplementation(async () => ({ ok: true, json: async () => snap }));
}

const flush = async (ms = 0) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-29T08:00:00.000Z"));
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
  vi.stubGlobal("fetch", fetchMock);
  respondWith(snapshot());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  fetchMock.mockReset();
});

describe("useMarketFeed", () => {
  it("fetches /api/market immediately, then opens the stream and goes live", async () => {
    const { result } = renderHook(() => useMarketFeed());
    expect(result.current.connection).toBe("connecting");
    expect(result.current.status).toBe("unavailable");
    await flush();
    expect(fetchMock).toHaveBeenCalledWith("/api/market", expect.objectContaining({ cache: "no-store" }));
    expect(result.current.snapshot).not.toBeNull();
    expect(result.current.status).toBe("live");
    expect(FakeEventSource.live).toHaveLength(1);
    expect(FakeEventSource.live[0].url).toBe("/api/market/stream");

    await act(async () => FakeEventSource.live[0].open());
    expect(result.current.connection).toBe("live");

    const pushed = snapshot({ sources: ["stream"] });
    await act(async () => FakeEventSource.live[0].emit("snapshot", pushed));
    expect(result.current.snapshot?.sources).toEqual(["stream"]);
    expect(result.current.lastUpdatedAt?.toISOString()).toBe(pushed.updatedAt);
    // Junk frames are ignored.
    await act(async () => FakeEventSource.live[0].emit("snapshot", { nope: true }));
    expect(result.current.snapshot?.sources).toEqual(["stream"]);
  });

  it("marks reconnecting on transient errors, then falls back to polling after CLIENT_STREAM_MAX_FAILURES and retries the stream later", async () => {
    const { result } = renderHook(() => useMarketFeed());
    await flush();
    const es = FakeEventSource.live[0];
    await act(async () => es.open());
    for (let i = 1; i < CLIENT_STREAM_MAX_FAILURES; i++) {
      await act(async () => es.fail());
      expect(result.current.connection).toBe("reconnecting");
    }
    fetchMock.mockClear();
    await act(async () => es.fail());
    expect(result.current.connection).toBe("polling");
    expect(es.closed).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1); // immediate poll
    await flush(CLIENT_POLL_INTERVAL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await flush(CLIENT_POLL_INTERVAL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Data stays LIVE while polling works (transport ≠ data status).
    expect(result.current.status).toBe("live");

    // After STREAM_RETRY_INTERVAL_MS a new EventSource is attempted; polling continues until it opens.
    await flush(STREAM_RETRY_INTERVAL_MS);
    expect(FakeEventSource.live).toHaveLength(1);
    expect(result.current.connection).toBe("polling");
    const calls = fetchMock.mock.calls.length;
    await act(async () => FakeEventSource.live[0].open());
    expect(result.current.connection).toBe("live");
    await flush(CLIENT_POLL_INTERVAL_MS * 2);
    expect(fetchMock.mock.calls.length).toBe(calls); // polling stopped
  });

  it("a stream the browser gave up on (readyState CLOSED) falls back to polling immediately", async () => {
    const { result } = renderHook(() => useMarketFeed());
    await flush();
    await act(async () => FakeEventSource.live[0].fail(true));
    expect(result.current.connection).toBe("polling");
  });

  it("recomputes status from the snapshot age on a ticking clock even when the server goes silent", async () => {
    const { result } = renderHook(() => useMarketFeed());
    await flush();
    await act(async () => FakeEventSource.live[0].open());
    expect(result.current.status).toBe("live");
    expect(result.current.isStale).toBe(false);

    await flush(MARKET_STALE_AFTER_MS + STATUS_TICK_MS);
    expect(result.current.status).toBe("stale");
    expect(result.current.isStale).toBe(true);
    expect(result.current.connection).toBe("live"); // transport still open, data is not

    await flush(MARKET_UNAVAILABLE_AFTER_MS);
    expect(result.current.status).toBe("unavailable");

    // Fresh data brings it back.
    await act(async () => FakeEventSource.live[0].emit("snapshot", snapshot()));
    expect(result.current.status).toBe("live");
  });

  it("uses the server-side age, not the server clock, so clock skew cannot fake freshness", async () => {
    const skewed = snapshot({
      // Server clock 1 h ahead of the client, but the data was already 2 min old when generated.
      generatedAt: new Date(Date.now() + 3_600_000).toISOString(),
      updatedAt: new Date(Date.now() + 3_600_000 - 120_000).toISOString(),
    });
    respondWith(skewed);
    const { result } = renderHook(() => useMarketFeed());
    await flush();
    expect(result.current.status).toBe("stale");
    expect(effectiveUpdatedAt({ snapshot: skewed, receivedAt: Date.now() })).toBe(Date.now() - 120_000);
    expect(effectiveUpdatedAt({ snapshot: snapshot({ updatedAt: null }), receivedAt: Date.now() })).toBeNull();
  });

  it("goes offline/online with the browser and pauses while the tab is hidden", async () => {
    const { result } = renderHook(() => useMarketFeed());
    await flush();
    await act(async () => FakeEventSource.live[0].open());
    expect(result.current.connection).toBe("live");

    await act(async () => window.dispatchEvent(new Event("offline")));
    expect(result.current.connection).toBe("offline");
    expect(FakeEventSource.live).toHaveLength(0);
    fetchMock.mockClear();
    await flush(CLIENT_POLL_INTERVAL_MS * 2);
    expect(fetchMock).not.toHaveBeenCalled(); // nothing runs while offline

    await act(async () => window.dispatchEvent(new Event("online")));
    expect(result.current.connection).toBe("reconnecting"); // had data before
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(FakeEventSource.live).toHaveLength(1);
    await act(async () => FakeEventSource.live[0].open());
    expect(result.current.connection).toBe("live");

    // Hidden: transports survive the grace period (quick tab switches never reconnect) …
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(FakeEventSource.live).toHaveLength(1);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(FakeEventSource.live).toHaveLength(1); // still the same stream, nothing rebuilt
    expect(result.current.connection).toBe("live");

    // … but a tab hidden for longer than the grace period is paused, and resumed when shown again.
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    await flush(HIDDEN_PAUSE_GRACE_MS + 1);
    expect(FakeEventSource.live).toHaveLength(0);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(FakeEventSource.live).toHaveLength(1);
  });

  it("reopens the stream at once on a server-initiated recycle (event: reconnect) without counting a failure", async () => {
    const { result } = renderHook(() => useMarketFeed());
    await flush();
    await act(async () => FakeEventSource.live[0].open());
    expect(result.current.connection).toBe("live");
    const first = FakeEventSource.live[0];
    await act(async () => first.emit("reconnect", {}));
    expect(FakeEventSource.live).toHaveLength(1);
    expect(FakeEventSource.live[0]).not.toBe(first);
    await act(async () => FakeEventSource.live[0].open());
    expect(result.current.connection).toBe("live");
    // Polling never started: the recycle is not an error.
    fetchMock.mockClear();
    await flush(CLIENT_POLL_INTERVAL_MS * 2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refresh() fetches on demand", async () => {
    const { result } = renderHook(() => useMarketFeed());
    await flush();
    fetchMock.mockClear();
    respondWith(snapshot({ sources: ["manual"] }));
    await act(async () => {
      result.current.refresh();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.snapshot?.sources).toEqual(["manual"]);
  });

  it("cleans up every source and timer on unmount, and survives StrictMode double-mount with ONE stream", async () => {
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
    const { result, unmount } = renderHook(() => useMarketFeed(), { wrapper });
    await flush();
    expect(FakeEventSource.live).toHaveLength(1); // the first (StrictMode) run's source was closed
    await act(async () => FakeEventSource.live[0].open());
    expect(result.current.connection).toBe("live");
    unmount();
    expect(FakeEventSource.live).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does nothing when disabled", async () => {
    renderHook(() => useMarketFeed({ enabled: false }));
    await flush(1000);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it("isSnapshotLike validates the wire shape", () => {
    expect(isSnapshotLike(snapshot())).toBe(true);
    expect(isSnapshotLike({ ...snapshot(), status: "weird" })).toBe(false);
    expect(isSnapshotLike({ ...snapshot(), quotes: "x" })).toBe(false);
    expect(isSnapshotLike(null)).toBe(false);
  });
});
