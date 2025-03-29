import { getTicks } from "./chartUtils";
import { describe, expect, it } from "@jest/globals";

describe("getTicks", () => {
  it("should return ticks for a yMax divisible by 3", () => {
    const ticks = getTicks(300, []);
    expect(ticks).toEqual([100, 200, 300]);
  });

  it("should return ticks for a yMax divisible by 4", () => {
    const ticks = getTicks(400, []);
    expect(ticks).toEqual([100, 200, 300, 400]);
  });

  it("should return ticks for a yMax divisible by 5", () => {
    const ticks = getTicks(500, []);
    expect(ticks).toEqual([100, 200, 300, 400, 500]);
  });

  it("should return ticks for a yMax divisible by 7", () => {
    const ticks = getTicks(700, []);
    expect(ticks).toEqual([100, 200, 300, 400, 500, 600, 700]);
  });

  it("should handle big yMax values", () => {
    const ticks = getTicks(15000, []);
    expect(ticks).toEqual([5000, 10000, 15000]);
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
