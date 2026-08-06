import { getAvailablePLevels, getTicks, getZoomYMax } from "./chartUtils";
import { ChartData } from "../charts/remix-line";
import { describe, expect, it } from "@jest/globals";

describe("getTicks", () => {
  it("should return ticks for a yMax divisible by 3", () => {
    const ticks = getTicks(270, []);
    expect(ticks).toEqual([90, 180, 270]);
  });

  it("should return ticks for a yMax divisible by 4", () => {
    const ticks = getTicks(400, []);
    expect(ticks).toEqual([100, 200, 300, 400]);
  });

  it("should return ticks for a yMax divisible by 5", () => {
    const ticks = getTicks(500, []);
    expect(ticks).toEqual([100, 200, 300, 400, 500]);
  });

  it("should return ticks for a yMax divisible by 6", () => {
    const ticks = getTicks(600, []);
    expect(ticks).toEqual([100, 200, 300, 400, 500, 600]);
  });

  it("should return ticks for a yMax divisible by 7", () => {
    const ticks = getTicks(700, []);
    expect(ticks).toEqual([100, 200, 300, 400, 500, 600, 700]);
  });

  it("should return the correct ticks for a yMax of 13000", () => {
    const ticks = getTicks(13000, []);
    expect(ticks).toEqual([3000, 6000, 9000, 12000]);
  });

  it("should return the correct ticks for a yMax of 14000", () => {
    const ticks = getTicks(14000, []);
    expect(ticks).toEqual([3000, 6000, 9000, 12000]);
  });

  it("should return the correct ticks for a yMax of 15000", () => {
    const ticks = getTicks(15000, []);
    expect(ticks).toEqual([3000, 6000, 9000, 12000, 15000]);
  });

  it("should return the correct ticks for a yMax of 50", () => {
    const ticks = getTicks(50, []);
    expect(ticks).toEqual([10, 20, 30, 40, 50]);
  });

  it("should return the correct ticks for a yMax of 100", () => {
    const ticks = getTicks(100, []);
    expect(ticks).toEqual([20, 40, 60, 80, 100]);
  });

  it("should return the correct ticks for a yMax of 150", () => {
    const ticks = getTicks(150, []);
    expect(ticks).toEqual([30, 60, 90, 120, 150]);
  });

  it("should return the correct ticks for a yMax of 200", () => {
    const ticks = getTicks(200, []);
    expect(ticks).toEqual([40, 80, 120, 160, 200]);
  });

  it("should return the correct ticks for a yMax of 250", () => {
    const ticks = getTicks(250, []);
    expect(ticks).toEqual([50, 100, 150, 200, 250]);
  });

  it("should return the correct ticks for a yMax of 300", () => {
    const ticks = getTicks(300, []);
    expect(ticks).toEqual([50, 100, 150, 200, 250, 300]);
  });

  it("should return the correct ticks for a yMax of 350", () => {
    const ticks = getTicks(350, []);
    expect(ticks).toEqual([50, 100, 150, 200, 250, 300, 350]);
  });

  it("should return the correct ticks for a yMax of 400", () => {
    const ticks = getTicks(400, []);
    expect(ticks).toEqual([100, 200, 300, 400]);
  });

  it("should return the correct ticks for a yMax of 450", () => {
    const ticks = getTicks(450, []);
    expect(ticks).toEqual([150, 300, 450]);
  });

  it("should return the correct ticks for a yMax of 500", () => {
    const ticks = getTicks(500, []);
    expect(ticks).toEqual([100, 200, 300, 400, 500]);
  });

  it("should return the correct ticks for a yMax of 600", () => {
    const ticks = getTicks(600, []);
    expect(ticks).toEqual([100, 200, 300, 400, 500, 600]);
  });

  it("should return the correct ticks for a yMax of 700", () => {
    const ticks = getTicks(700, []);
    expect(ticks).toEqual([100, 200, 300, 400, 500, 600, 700]);
  });

  it("should use fallback for non-round divisors", () => {
    const ticks = getTicks(37, []);
    // For yMax > 10, the fallback is 50
    // But since 50 > 37, there's only one tick
    expect(ticks).toEqual([]);
  });

  it("should use different fallbacks based on yMax size", () => {
    const smallTicks = getTicks(3, []);
    const mediumTicks = getTicks(15, []);
    const largeTicks = getTicks(600, []);

    expect(smallTicks.length).toBeGreaterThan(0);
    expect(mediumTicks.length).toBeGreaterThan(0);
    expect(largeTicks.length).toBeGreaterThan(0);
  });

  it("should handle decimal yMax values", () => {
    const ticks = getTicks(2.5, []);
    expect(ticks).toEqual([0.5, 1, 1.5, 2, 2.5]);
  });

  it("should handle zero and negative yMax", () => {
    expect(getTicks(0, [])).toEqual([]);
    expect(getTicks(-10, [])).toEqual([]);
  });
});

const chartData = (data: Partial<ChartData>[]): ChartData[] =>
  data.map((d, i) => ({ formattedDate: `2024-01-01T00:${i}0`, ...d }));

describe("getZoomYMax", () => {
  it("should use generation/forecast max when there is no probabilistic bound", () => {
    const data = chartData([{ GENERATION: 5 }, { GENERATION_UPDATED: 10 }, { FORECAST: 7 }]);
    expect(getZoomYMax(data)).toBe(10);
  });

  it("should use the highest probabilistic upper bound when present", () => {
    const data = chartData([
      { PROBABILISTIC_UPPER_BOUND: 12, GENERATION: 1 },
      { PROBABILISTIC_UPPER_BOUND: 20, GENERATION: 2 }
    ]);
    expect(getZoomYMax(data)).toBe(20);
  });

  it("should fall back to GENERATION for a NaN probabilistic bound without breaking the max", () => {
    const data = chartData([
      { PROBABILISTIC_UPPER_BOUND: NaN, GENERATION: 2 },
      { PROBABILISTIC_UPPER_BOUND: 50, GENERATION: 3 },
      { PROBABILISTIC_UPPER_BOUND: 30, GENERATION: 4 }
    ]);
    expect(getZoomYMax(data)).toBe(50);
  });

  it("should fall back to the generation/forecast branch when every probabilistic bound is NaN", () => {
    const data = chartData([{ PROBABILISTIC_UPPER_BOUND: NaN, GENERATION: 7, FORECAST: 3 }]);
    expect(getZoomYMax(data)).toBe(7);
  });
});

describe("getAvailablePLevels", () => {
  const pLevels: [number, number][] = [
    [2, 98],
    [10, 90]
  ];

  it("should keep a pair when both bounds are in the payload", () => {
    const plevelValues = { plevel_2: 1, plevel_98: 9, plevel_10: 2, plevel_90: 8 };
    expect(getAvailablePLevels(plevelValues, pLevels)).toEqual(pLevels);
  });

  it("should drop a pair when its upper bound is missing (e.g. p2 present, p98 not)", () => {
    const plevelValues = { plevel_2: 1, plevel_10: 2, plevel_90: 8 };
    expect(getAvailablePLevels(plevelValues, pLevels)).toEqual([[10, 90]]);
  });

  it("should drop a pair when its lower bound is missing", () => {
    const plevelValues = { plevel_98: 9, plevel_10: 2, plevel_90: 8 };
    expect(getAvailablePLevels(plevelValues, pLevels)).toEqual([[10, 90]]);
  });

  it("should return an empty array when no pair has both bounds present", () => {
    expect(getAvailablePLevels({}, pLevels)).toEqual([]);
  });
});
