import { getMarketSnapshot } from "@/lib/market/service";

/**
 * GET /api/market → MarketSnapshot (JSON).
 *
 * Always 200 with the freshest snapshot the service has (status/error inside
 * the body tell the client whether the data is live, stale or unavailable).
 * Never cached: every hit reads the in-memory service cache, which itself
 * throttles upstream calls to MARKET_REFRESH_INTERVAL_MS.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const snapshot = await getMarketSnapshot();
  return new Response(JSON.stringify(snapshot), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}
