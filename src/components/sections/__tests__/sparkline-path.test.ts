import { describe, expect, it } from "vitest";
import {
  createSeededRandom,
  generateSparklinePoints,
  SPARKLINE_VIEWBOX,
  toAreaPath,
  toSmoothPath,
} from "@/components/sections/hero/sparkline-path";

describe("createSeededRandom", () => {
  it("is deterministic for a seed and stays within [0, 1)", () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    const seqA = Array.from({ length: 50 }, () => a());
    const seqB = Array.from({ length: 50 }, () => b());
    expect(seqA).toEqual(seqB);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(new Set(seqA).size).toBeGreaterThan(40);
  });

  it("produces different sequences for different seeds", () => {
    const a = createSeededRandom(1);
    const b = createSeededRandom(2);
    expect(Array.from({ length: 5 }, () => a())).not.toEqual(Array.from({ length: 5 }, () => b()));
  });
});

describe("generateSparklinePoints", () => {
  it("renders the same curve every time for the default seed (SSR === client)", () => {
    expect(generateSparklinePoints()).toEqual(generateSparklinePoints());
    expect(toSmoothPath(generateSparklinePoints())).toBe(toSmoothPath(generateSparklinePoints()));
  });

  it("spans the viewBox left to right with monotonic x and y inside the box", () => {
    const points = generateSparklinePoints({ count: 40 });
    expect(points).toHaveLength(40);
    expect(points[0].x).toBe(0);
    expect(points[points.length - 1].x).toBe(SPARKLINE_VIEWBOX.width);
    for (let i = 1; i < points.length; i += 1) {
      expect(points[i].x).toBeGreaterThan(points[i - 1].x);
    }
    for (const p of points) {
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(SPARKLINE_VIEWBOX.height);
    }
  });

  it("uses the full vertical band (min and max touch the padding)", () => {
    const points = generateSparklinePoints();
    const ys = points.map((p) => p.y);
    const padding = 0.12 * SPARKLINE_VIEWBOX.height;
    expect(Math.min(...ys)).toBeCloseTo(padding, 0);
    expect(Math.max(...ys)).toBeCloseTo(SPARKLINE_VIEWBOX.height - padding, 0);
  });

  it("never yields fewer than two points", () => {
    expect(generateSparklinePoints({ count: 0 })).toHaveLength(2);
  });
});

describe("path builders", () => {
  it("toSmoothPath emits one cubic segment per gap", () => {
    const points = generateSparklinePoints({ count: 10 });
    const d = toSmoothPath(points);
    expect(d.startsWith(`M${points[0].x} ${points[0].y}`)).toBe(true);
    expect(d.match(/ C/g)).toHaveLength(9);
    expect(d).not.toMatch(/NaN|undefined/);
  });

  it("toSmoothPath handles degenerate inputs", () => {
    expect(toSmoothPath([])).toBe("");
    expect(toSmoothPath([{ x: 3, y: 4 }])).toBe("M3 4");
  });

  it("toAreaPath closes the line down to the baseline", () => {
    const points = generateSparklinePoints({ count: 6 });
    const d = toAreaPath(points);
    expect(d.startsWith(toSmoothPath(points))).toBe(true);
    expect(d.endsWith(`L${SPARKLINE_VIEWBOX.width} ${SPARKLINE_VIEWBOX.height} L0 ${SPARKLINE_VIEWBOX.height} Z`)).toBe(
      true,
    );
    expect(toAreaPath([{ x: 0, y: 0 }])).toBe("");
  });
});
