/**
 * Pure helpers for the decorative hero sparkline. Everything here is
 * deterministic: the same seed always yields the same curve, so the SVG
 * rendered on the server matches the client byte for byte (no Math.random).
 */

export interface SparklinePoint {
  x: number;
  y: number;
}

export interface SparklineOptions {
  /** Seed for the pseudo-random walk. */
  seed?: number;
  /** Number of samples along the x axis (>= 2). */
  count?: number;
  /** SVG viewBox width. */
  width?: number;
  /** SVG viewBox height. */
  height?: number;
  /** Net upward drift over the whole curve, in normalised units (0..1). */
  drift?: number;
  /** Size of each random shock, in normalised units. */
  volatility?: number;
}

export const SPARKLINE_VIEWBOX = { width: 1200, height: 240 } as const;

/** mulberry32 — tiny, well-distributed 32-bit PRNG. Returns values in [0, 1). */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A plausible "price" curve: a mean-reverting random walk with a gentle
 * upward drift, normalised so it occupies the middle ~76% of the height.
 * y grows downward (SVG), so higher prices are smaller y values.
 */
export function generateSparklinePoints(options: SparklineOptions = {}): SparklinePoint[] {
  const {
    seed = 0x2026_0929,
    count = 56,
    width = SPARKLINE_VIEWBOX.width,
    height = SPARKLINE_VIEWBOX.height,
    drift = 0.55,
    volatility = 0.09,
  } = options;
  const samples = Math.max(2, Math.floor(count));
  const random = createSeededRandom(seed);

  const values: number[] = [];
  let value = 0.5;
  for (let i = 0; i < samples; i += 1) {
    const shock = (random() - 0.5) * 2 * volatility;
    const meanReversion = (0.5 - value) * 0.08;
    value += shock + meanReversion + drift / samples;
    values.push(value);
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const padding = 0.12 * height;
  const usable = height - padding * 2;

  return values.map((v, i) => ({
    x: round((i / (samples - 1)) * width),
    y: round(height - (padding + ((v - min) / span) * usable)),
  }));
}

/** Catmull-Rom → cubic Bézier: a smooth line through every point. */
export function toSmoothPath(points: readonly SparklinePoint[]): string {
  if (points.length === 0) return "";
  const first = points[0];
  let d = `M${first.x} ${first.y}`;
  if (points.length === 1) return d;

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = round(p1.x + (p2.x - p0.x) / 6);
    const c1y = round(p1.y + (p2.y - p0.y) / 6);
    const c2x = round(p2.x - (p3.x - p1.x) / 6);
    const c2y = round(p2.y - (p3.y - p1.y) / 6);
    d += ` C${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

/** The smooth line closed down to the baseline, for a soft area fill. */
export function toAreaPath(points: readonly SparklinePoint[], height: number = SPARKLINE_VIEWBOX.height): string {
  if (points.length < 2) return "";
  const line = toSmoothPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${line} L${last.x} ${height} L${first.x} ${height} Z`;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
