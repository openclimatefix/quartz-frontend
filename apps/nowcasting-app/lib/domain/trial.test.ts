import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";

import { setGlobalState } from "../../components/helpers/globalState";
import { withholdFuture } from "./trial";

const NOW = "2025-07-01T10:00:00Z";

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date(NOW));
  setGlobalState("trialExpiredAt", "2025-06-01");
});

afterEach(() => {
  jest.useRealTimers();
  setGlobalState("trialExpiredAt", "");
});

const series = {
  regionName: "Great Britain",
  capacityMw: 1,
  values: [
    { timeUtc: "2025-07-01T09:30:00Z", powerMw: 1 },
    { timeUtc: NOW, powerMw: 2 },
    { timeUtc: "2025-07-01T11:00:00Z", powerMw: 3 }
  ]
};

describe("withholdFuture", () => {
  test("does nothing unless the trial has expired", () => {
    setGlobalState("trialExpiredAt", "");
    expect(withholdFuture(series)).toBe(series);
  });

  test("keeps the label of the period in progress", () => {
    const soon = { ...series, values: [{ timeUtc: "2025-07-01T10:30:00Z", powerMw: 9 }] };
    expect(withholdFuture(soon).values).toHaveLength(1);
  });

  test("cuts a time series after now, keeping now itself", () => {
    expect(withholdFuture(series).values.map((p) => p.powerMw)).toEqual([1, 2]);
  });

  test("cuts every region's arrays at the same index as the shared time axis", () => {
    const period = {
      times: ["2025-07-01T09:30:00Z", NOW, "2025-07-01T11:00:00Z"],
      cacheUpdatedUtc: null,
      regions: {
        a: {
          regionName: "a",
          capacityMw: 1,
          powerMw: [1, 2, 3],
          plevelsMw: { "10": [0, 1, 2] }
        },
        b: { regionName: "b", capacityMw: 1, powerMw: [4, 5, 6] }
      }
    };
    const out = withholdFuture(period);
    expect(out.times).toHaveLength(2);
    expect(out.regions.a.powerMw).toEqual([1, 2]);
    expect(out.regions.a.plevelsMw).toEqual({ "10": [0, 1] });
    expect(out.regions.b.powerMw).toEqual([4, 5]);
    expect((out.regions.b as { plevelsMw?: unknown }).plevelsMw).toBeUndefined();
  });

  test("empties a snapshot of a future instant and keeps a past one", () => {
    const snapshot = (timeUtc: string) => ({
      timeUtc,
      regions: { a: { regionName: "a", capacityMw: 1, powerMw: 1 } }
    });
    expect(withholdFuture(snapshot("2025-07-01T11:00:00Z")).regions).toEqual({});
    const past = snapshot("2025-07-01T09:30:00Z");
    expect(withholdFuture(past)).toBe(past);
  });

  test("passes arrays (the region and country lists) through untouched", () => {
    const regions = [{ name: "a" }, { name: "b" }];
    expect(withholdFuture(regions)).toBe(regions);
  });

  test("passes primitives, null and other objects through untouched", () => {
    const other = { code: "GB" };
    expect(withholdFuture(other)).toBe(other);
    expect(withholdFuture(null)).toBeNull();
    expect(withholdFuture(undefined)).toBeUndefined();
    expect(withholdFuture("x")).toBe("x");
  });
});
