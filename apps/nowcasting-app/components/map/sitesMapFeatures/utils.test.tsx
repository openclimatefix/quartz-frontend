import { describe, expect, test } from "@jest/globals";
import { getRingMultiplier } from "./utils";
import { AGGREGATION_LEVELS } from "../../../constant";

describe("Check getRingMultiplier", () => {
  test("check getRingMultiplier works for different values", () => {
    expect(getRingMultiplier(AGGREGATION_LEVELS.SITE, 10)).toBe(3);
    expect(getRingMultiplier(AGGREGATION_LEVELS.GSP, 10)).toBe(4.5);
    expect(getRingMultiplier(AGGREGATION_LEVELS.REGION, 10)).toBe(6);
    expect(getRingMultiplier(AGGREGATION_LEVELS.NATIONAL, 10)).toBe(10);
    expect(getRingMultiplier(AGGREGATION_LEVELS.SITE, 20)).toBe(1.5);
    expect(getRingMultiplier(AGGREGATION_LEVELS.GSP, 20)).toBe(2.25);
    expect(getRingMultiplier(AGGREGATION_LEVELS.REGION, 20)).toBe(3);
    expect(getRingMultiplier(AGGREGATION_LEVELS.NATIONAL, 20)).toBe(5);
  });
});
