import { describe, expect, test } from "@jest/globals";
import { getRoundedPvNormalized } from "./utils";

describe("check getRoundedPvNormalized with valid values", () => {
  test("check rounding to 0, 0.2, 0.4 etc.", () => {
    expect(getRoundedPvNormalized(0.9)).toBe(1);
    expect(getRoundedPvNormalized(0.55)).toBe(0.6);
    expect(getRoundedPvNormalized(0.44)).toBe(0.4);
    expect(getRoundedPvNormalized(0.45)).toBe(0.4);
    expect(getRoundedPvNormalized(0.46)).toBe(0.4);
    expect(getRoundedPvNormalized(0.333333)).toBe(0.4);
    expect(getRoundedPvNormalized(4.5)).toBe(4.6);
    expect(getRoundedPvNormalized(0.09)).toBe(0);
    expect(getRoundedPvNormalized(0.11)).toBe(0.2);
    expect(getRoundedPvNormalized(-0.35)).toBe(-0.4);
    expect(getRoundedPvNormalized(-0.3)).toBe(-0.4);
  });
});
