import { MARKET_STREAM_HEARTBEAT_MS, MARKET_STREAM_PUSH_INTERVAL_MS } from "@/config/market";
import { getCachedSnapshot, getMarketSnapshot } from "@/lib/market/service";
import type { MarketSnapshot } from "@/lib/market/types";

/**
 * GET /api/market/stream → Server-Sent Events.
 *
 *   retry: 3000                       (client reconnect delay hint)
 *   event: snapshot\nid: …\ndata: {MarketSnapshot JSON}\n\n   every MARKET_STREAM_PUSH_INTERVAL_MS
 *   : keep-alive …\n\n                every MARKET_STREAM_HEARTBEAT_MS
 *
 * Each tick pushes the service's cached snapshot immediately and kicks a
 * (deduplicated, cache-throttled) refresh in the background, so N connected
 * clients never cause more than one upstream refresh per interval.
 * The loop stops cleanly when the request is aborted (client disconnect).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RETRY_HINT_MS = 3_000;

function snapshotFrame(snapshot: MarketSnapshot): string {
  // JSON.stringify never emits raw newlines, so a single `data:` line is enough.
  return `event: snapshot\nid: ${snapshot.generatedAt}\ndata: ${JSON.stringify(snapshot)}\n\n`;
}

export async function GET(request: Request): Promise<Response> {
  const encoder = new TextEncoder();
  let pushTimer: ReturnType<typeof setInterval> | undefined;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  let cleanup: () => void = () => {};

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup(); // the consumer went away mid-write
        }
      };

      cleanup = () => {
        if (closed) return;
        closed = true;
        if (pushTimer) clearInterval(pushTimer);
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        request.signal.removeEventListener("abort", cleanup);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      if (request.signal.aborted) {
        cleanup();
        return;
      }
      request.signal.addEventListener("abort", cleanup, { once: true });

      send(`retry: ${RETRY_HINT_MS}\n\n`);

      // First frame: wait for a real snapshot so the client renders immediately.
      try {
        send(snapshotFrame(await getMarketSnapshot()));
      } catch {
        /* the service never throws, but a stream must never crash either */
      }
      if (closed) return;

      pushTimer = setInterval(() => {
        const cached = getCachedSnapshot();
        if (cached) send(snapshotFrame(cached));
        // Background refresh: cached within the interval, deduped when in flight.
        void getMarketSnapshot().catch(() => {});
      }, MARKET_STREAM_PUSH_INTERVAL_MS);

      heartbeatTimer = setInterval(() => {
        send(`: keep-alive ${Date.now()}\n\n`);
      }, MARKET_STREAM_HEARTBEAT_MS);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
