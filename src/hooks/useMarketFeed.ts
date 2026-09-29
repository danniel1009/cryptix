"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CLIENT_POLL_INTERVAL_MS, CLIENT_STREAM_MAX_FAILURES } from "@/config/market";
import { computeStatus } from "@/lib/market/rates";
import type { MarketSnapshot, MarketStatus } from "@/lib/market/types";

/**
 * Client market feed.
 *
 *   mount ─► GET /api/market (immediate) ─► EventSource /api/market/stream
 *                                              │ CLIENT_STREAM_MAX_FAILURES errors
 *                                              ▼
 *                                   poll /api/market every CLIENT_POLL_INTERVAL_MS
 *                                   (and retry the stream every STREAM_RETRY_INTERVAL_MS)
 *
 * - `connection` describes the TRANSPORT: connecting → live | reconnecting | polling | offline.
 * - `status` describes the DATA and is recomputed client-side on a 10 s clock
 *   from the snapshot's age, so a silent server can never leave prices looking live.
 *   Age is measured as (time since we received the snapshot) + (server-side age at
 *   generation), which makes it immune to client/server clock skew.
 * - Reacts to visibilitychange (pause hidden tabs), online/offline.
 * - Every timer / socket / fetch is torn down on unmount; each effect run owns
 *   its own state object, so StrictMode's mount→unmount→mount is harmless.
 */

export type MarketConnection = "connecting" | "live" | "reconnecting" | "polling" | "offline";

export const MARKET_JSON_ENDPOINT = "/api/market";
export const MARKET_STREAM_ENDPOINT = "/api/market/stream";

/** How often the client re-evaluates `status` from the snapshot age. */
export const STATUS_TICK_MS = 10_000;
/** While polling, try to re-establish the stream this often. */
export const STREAM_RETRY_INTERVAL_MS = 60_000;

export interface ReceivedSnapshot {
  snapshot: MarketSnapshot;
  /** Client clock when the snapshot arrived. */
  receivedAt: number;
}

export interface MarketFeed {
  snapshot: MarketSnapshot | null;
  connection: MarketConnection;
  status: MarketStatus;
  lastUpdatedAt: Date | null;
  isStale: boolean;
  /** Fetch /api/market right now (manual refresh). */
  refresh: () => void;
}

export interface UseMarketFeedOptions {
  /** Set false to keep the hook idle (e.g. in tests or static previews). */
  enabled?: boolean;
}

/** Minimal runtime validation of a payload before trusting it as a snapshot. */
export function isSnapshotLike(value: unknown): value is MarketSnapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    (v.status === "live" || v.status === "stale" || v.status === "unavailable") &&
    typeof v.generatedAt === "string" &&
    (v.updatedAt === null || typeof v.updatedAt === "string") &&
    typeof v.spread === "number" &&
    Array.isArray(v.quotes) &&
    Array.isArray(v.rates) &&
    Array.isArray(v.sources)
  );
}

/**
 * Effective "updated at" on the CLIENT clock: when we received the snapshot,
 * minus how old the data already was on the server when it was generated.
 */
export function effectiveUpdatedAt(received: ReceivedSnapshot): number | null {
  const { snapshot, receivedAt } = received;
  if (!snapshot.updatedAt) return null;
  const updated = Date.parse(snapshot.updatedAt);
  const generated = Date.parse(snapshot.generatedAt);
  if (Number.isNaN(updated)) return null;
  const serverAge = Number.isNaN(generated) ? 0 : Math.max(0, generated - updated);
  return receivedAt - serverAge;
}

/** Per-effect-run mutable state (never shared between StrictMode runs). */
interface FeedRuntime {
  active: boolean;
  online: boolean;
  hasData: boolean;
  failures: number;
  source: EventSource | null;
  pollTimer: ReturnType<typeof setInterval> | null;
  retryTimer: ReturnType<typeof setTimeout> | null;
  fetchController: AbortController | null;
}

export function useMarketFeed(options: UseMarketFeedOptions = {}): MarketFeed {
  const enabled = options.enabled ?? true;
  const [received, setReceived] = useState<ReceivedSnapshot | null>(null);
  const [connection, setConnection] = useState<MarketConnection>("connecting");
  const [now, setNow] = useState<number>(() => Date.now());
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const rt: FeedRuntime = {
      active: true,
      online: typeof navigator === "undefined" || navigator.onLine !== false,
      hasData: false,
      failures: 0,
      source: null,
      pollTimer: null,
      retryTimer: null,
      fetchController: null,
    };

    const applySnapshot = (snapshot: MarketSnapshot) => {
      if (!rt.active) return;
      rt.hasData = true;
      const at = Date.now();
      setReceived({ snapshot, receivedAt: at });
      setNow(at);
    };

    const fetchSnapshot = async () => {
      if (!rt.active || !rt.online) return;
      rt.fetchController?.abort();
      const controller = new AbortController();
      rt.fetchController = controller;
      try {
        const res = await fetch(MARKET_JSON_ENDPOINT, { cache: "no-store", signal: controller.signal });
        if (!res.ok) return;
        const body: unknown = await res.json();
        if (isSnapshotLike(body)) applySnapshot(body);
      } catch {
        /* aborted or network failure: keep the last snapshot, status decays by age */
      } finally {
        if (rt.fetchController === controller) rt.fetchController = null;
      }
    };

    const stopPolling = () => {
      if (rt.pollTimer) {
        clearInterval(rt.pollTimer);
        rt.pollTimer = null;
      }
    };

    const clearStreamRetry = () => {
      if (rt.retryTimer) {
        clearTimeout(rt.retryTimer);
        rt.retryTimer = null;
      }
    };

    const closeStream = () => {
      if (rt.source) {
        rt.source.close();
        rt.source = null;
      }
    };

    const startPolling = () => {
      if (!rt.active) return;
      setConnection("polling");
      if (rt.pollTimer) return;
      void fetchSnapshot();
      rt.pollTimer = setInterval(() => void fetchSnapshot(), CLIENT_POLL_INTERVAL_MS);
    };

    const scheduleStreamRetry = () => {
      clearStreamRetry();
      rt.retryTimer = setTimeout(() => {
        rt.retryTimer = null;
        if (!rt.active || !rt.online || document.visibilityState === "hidden") return;
        rt.failures = 0;
        openStream(); // polling keeps running until the stream actually opens
      }, STREAM_RETRY_INTERVAL_MS);
    };

    const openStream = () => {
      if (!rt.active || !rt.online || rt.source) return;
      if (typeof EventSource === "undefined") {
        startPolling();
        return;
      }
      const source = new EventSource(MARKET_STREAM_ENDPOINT);
      rt.source = source;

      source.onopen = () => {
        if (!rt.active || rt.source !== source) return;
        rt.failures = 0;
        stopPolling();
        clearStreamRetry();
        setConnection("live");
      };

      source.addEventListener("snapshot", (event: MessageEvent<string>) => {
        if (!rt.active || rt.source !== source) return;
        try {
          const body: unknown = JSON.parse(event.data);
          if (isSnapshotLike(body)) applySnapshot(body);
        } catch {
          /* malformed frame — ignore */
        }
      });

      source.onerror = () => {
        if (!rt.active || rt.source !== source) return;
        rt.failures += 1;
        // readyState CLOSED = the browser gave up (bad status / MIME); otherwise it retries itself.
        if (source.readyState === EventSource.CLOSED || rt.failures >= CLIENT_STREAM_MAX_FAILURES) {
          closeStream();
          startPolling();
          scheduleStreamRetry();
          return;
        }
        setConnection("reconnecting");
      };
    };

    /** Tear down every transport (hidden tab, offline, unmount). */
    const pause = () => {
      closeStream();
      stopPolling();
      clearStreamRetry();
      rt.fetchController?.abort();
      rt.fetchController = null;
    };

    /** Re-establish transports after a pause (visible again / back online). */
    const resume = () => {
      if (!rt.active || !rt.online) return;
      pause();
      rt.failures = 0;
      setConnection(rt.hasData ? "reconnecting" : "connecting");
      void fetchSnapshot();
      if (document.visibilityState !== "hidden") openStream();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") pause();
      else resume();
    };
    const onOnline = () => {
      rt.online = true;
      resume();
    };
    const onOffline = () => {
      rt.online = false;
      pause();
      setConnection("offline");
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    refreshRef.current = () => void fetchSnapshot();

    const tick = setInterval(() => {
      if (rt.active) setNow(Date.now());
    }, STATUS_TICK_MS);

    // Kick-off (deferred a tick so no state is set synchronously inside the effect).
    const kickoff = setTimeout(() => {
      if (!rt.active) return;
      if (!rt.online) {
        setConnection("offline");
        return;
      }
      void fetchSnapshot();
      if (document.visibilityState !== "hidden") openStream();
    }, 0);

    return () => {
      rt.active = false;
      clearTimeout(kickoff);
      clearInterval(tick);
      pause();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      refreshRef.current = () => {};
    };
  }, [enabled]);

  const status = useMemo<MarketStatus>(() => {
    if (!received) return "unavailable";
    return computeStatus(effectiveUpdatedAt(received), Math.max(now, received.receivedAt));
  }, [received, now]);

  const lastUpdatedAt = useMemo<Date | null>(() => {
    const iso = received?.snapshot.updatedAt;
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [received]);

  const refresh = useCallback(() => refreshRef.current(), []);

  return {
    snapshot: received?.snapshot ?? null,
    connection,
    status,
    lastUpdatedAt,
    isStale: status === "stale",
    refresh,
  };
}
