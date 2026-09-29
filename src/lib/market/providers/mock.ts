import type { MarketDataProvider, MarketQuote, MarketSymbol, PairRequest } from "@/lib/market/types";
import { pairKey } from "@/lib/market/types";

/**
 * MockProvider — deterministic development fallback.
 *
 * Only appended to the chain when `serverConfig.market.allowMock` is true
 * (never in production unless ALLOW_MOCK_MARKET_DATA=true is set explicitly).
 * Prices start from realistic anchors and perform a gentle, seeded random walk
 * with mean reversion, so the UI can exercise its "number changed" animations
 * while tests stay reproducible (same seed → same sequence).
 *
 * Every quote carries `source: "mock"` so the snapshot can flag it honestly.
 */

export const MOCK_SOURCE = "mock";

/** Anchor prices (approximate market levels at the time of writing). */
const ANCHORS: ReadonlyMap<string, number> = new Map<string, number>([
  [pairKey("BTC", "USDT"), 83_000],
  [pairKey("ETH", "USDT"), 2_670],
  [pairKey("SOL", "USDT"), 117],
  [pairKey("ETH", "BTC"), 0.0321],
  [pairKey("SOL", "BTC"), 0.00141],
  [pairKey("USDT", "IDR"), 17_980],
  [pairKey("BTC", "IDR"), 1_492_000_000],
  [pairKey("BTC", "USD"), 82_900],
  [pairKey("ETH", "USD"), 2_662],
  [pairKey("SOL", "USD"), 116.9],
  [pairKey("USDT", "USD"), 0.9997],
]);

/** Small, fast, seedable PRNG (32-bit). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface WalkState {
  price: number;
  change24hPct: number;
}

export interface MockProviderOptions {
  /** PRNG seed — same seed gives the same sequence of quotes. */
  seed?: number;
  /** Max relative move per step (0.001 = ±0.1 %). */
  volatility?: number;
  now?: () => number;
}

export class MockProvider implements MarketDataProvider {
  readonly name = MOCK_SOURCE;
  private readonly random: () => number;
  private readonly volatility: number;
  private readonly now: () => number;
  private readonly state = new Map<string, WalkState>();

  constructor(options: MockProviderOptions = {}) {
    this.random = mulberry32(options.seed ?? 20260929);
    this.volatility = options.volatility ?? 0.001;
    this.now = options.now ?? Date.now;
  }

  supports(base: MarketSymbol, quote: MarketSymbol): boolean {
    return ANCHORS.has(pairKey(base, quote));
  }

  async fetchQuotes(requests: PairRequest[]): Promise<MarketQuote[]> {
    const updatedAt = new Date(this.now()).toISOString();
    const quotes: MarketQuote[] = [];
    const seen = new Set<string>();
    for (const r of requests) {
      const key = pairKey(r.base, r.quote);
      if (seen.has(key) || !ANCHORS.has(key)) continue;
      seen.add(key);
      const s = this.step(key);
      quotes.push({
        base: r.base,
        quote: r.quote,
        price: s.price,
        change24hPct: s.change24hPct,
        updatedAt,
        source: this.name,
      });
    }
    return quotes;
  }

  /** One random-walk step with mean reversion toward the anchor. */
  private step(key: string): WalkState {
    const anchor = ANCHORS.get(key) as number;
    let s = this.state.get(key);
    if (!s) {
      s = { price: anchor, change24hPct: (this.random() - 0.5) * 6 }; // start within ±3 %
      this.state.set(key, s);
    }
    const shock = (this.random() - 0.5) * 2 * this.volatility;
    s.price = s.price * (1 + shock) + (anchor - s.price) * 0.05;
    s.change24hPct = Math.max(-15, Math.min(15, s.change24hPct + (this.random() - 0.5) * 0.2));
    return { price: s.price, change24hPct: s.change24hPct };
  }
}
