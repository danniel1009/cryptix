/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketSnapshot } from "@/lib/market/types";

const snapshot: MarketSnapshot = {
  status: "live",
  generatedAt: "2026-09-29T08:00:00.000Z",
  updatedAt: "2026-09-29T08:00:00.000Z",
  spread: 0.05,
  quotes: [{ base: "BTC", quote: "USDT", price: 100_000, change24hPct: 1, updatedAt: "2026-09-29T08:00:00.000Z", source: "binance" }],
  rates: [],
  sources: ["binance"],
  error: null,
};

const getMarketSnapshot = vi.fn(async () => snapshot);
const getCachedSnapshot = vi.fn(() => snapshot);

vi.mock("@/lib/market/service", () => ({ getMarketSnapshot, getCachedSnapshot }));

beforeEach(() => {
  getMarketSnapshot.mockClear();
  getCachedSnapshot.mockClear();
});

describe("GET /api/market", () => {
  it("returns the snapshot as uncached JSON", async () => {
    const route = await import("@/app/api/market/route");
    expect(route.dynamic).toBe("force-dynamic");
    const res = await route.GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const body = (await res.json()) as MarketSnapshot;
    expect(body).toEqual(snapshot);
    expect(getMarketSnapshot).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/market/stream", () => {
  async function readUntil(reader: ReadableStreamDefaultReader<Uint8Array>, needle: string, maxReads = 6): Promise<string> {
    const decoder = new TextDecoder();
    let text = "";
    for (let i = 0; i < maxReads; i++) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      if (text.includes(needle)) break;
    }
    return text;
  }

  it("streams SSE frames with the right headers and stops on abort", async () => {
    const route = await import("@/app/api/market/stream/route");
    expect(route.dynamic).toBe("force-dynamic");
    const controller = new AbortController();
    const res = await route.GET(new Request("http://localhost/api/market/stream", { signal: controller.signal }));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/event-stream/);
    expect(res.headers.get("cache-control")).toContain("no-cache");
    expect(res.headers.get("connection")).toBe("keep-alive");
    expect(res.headers.get("x-accel-buffering")).toBe("no");

    const reader = res.body!.getReader();
    const text = await readUntil(reader, "event: snapshot");
    expect(text).toMatch(/^retry: \d+\n\n/);
    const frame = text.slice(text.indexOf("event: snapshot"));
    expect(frame).toMatch(/^event: snapshot\nid: 2026-09-29T08:00:00\.000Z\ndata: \{/);
    const data = frame.split("\n").find((l) => l.startsWith("data: "))!.slice("data: ".length);
    expect(JSON.parse(data)).toEqual(snapshot);
    expect(getMarketSnapshot).toHaveBeenCalledTimes(1);

    controller.abort();
    const end = await reader.read();
    expect(end.done).toBe(true);
  });
});
