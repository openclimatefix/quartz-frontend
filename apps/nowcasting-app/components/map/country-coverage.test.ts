import { describe, expect, it } from "@jest/globals";
import { computeCountryCoverage, coverageGaps, decideCountryCoverage } from "./country-coverage";
import type { MapFeatureState } from "../helpers/data";
import { DELTA_BUCKET } from "../../constant";

const state = (overrides: Partial<MapFeatureState> = {}): MapFeatureState => ({
  dataState: "unpublished",
  power: 0,
  normalized: 0,
  capacity: 100,
  areaKm2: 0,
  capacityDensity: 0,
  capacityShare: 0,
  actual: null,
  delta: 0,
  deltaNormalized: 0,
  deltaBucketNormalized: DELTA_BUCKET.ZERO,
  deltaBucket: DELTA_BUCKET.ZERO,
  hasDelta: false,
  label: "region",
  ...overrides
});

describe("decideCountryCoverage", () => {
  it("is loading when nothing has arrived yet, regardless of the cursor fact", () => {
    // The case the module's whole doc comment is about: a still-loading country must never
    // read as "no-data" — that would be a spinner-shaped answer to a staleness question.
    expect(decideCountryCoverage({ isLoading: true, hasValues: false, anyAtCursor: false })).toBe(
      "loading"
    );
  });

  it("is not loading once anything has been delivered, even mid-refetch", () => {
    expect(decideCountryCoverage({ isLoading: true, hasValues: true, anyAtCursor: true })).toBe(
      "ok"
    );
  });

  it("is no-forecast when the pipeline resolved with nothing at all", () => {
    expect(decideCountryCoverage({ isLoading: false, hasValues: false, anyAtCursor: false })).toBe(
      "no-forecast"
    );
  });

  it("is no-data when values exist but none land on the cursor instant", () => {
    // The GB-cache case: forecast/generation exist for the fetched window, but the cursor
    // sits somewhere none of them cover (a stale cache, the recent past, or the future).
    expect(decideCountryCoverage({ isLoading: false, hasValues: true, anyAtCursor: false })).toBe(
      "no-data"
    );
  });

  it("is ok when at least one region has the fact at the cursor", () => {
    expect(decideCountryCoverage({ isLoading: false, hasValues: true, anyAtCursor: true })).toBe(
      "ok"
    );
  });
});

describe("computeCountryCoverage", () => {
  it("is false/false when every region is unpublished", () => {
    const states = new Map([
      ["a", state({ dataState: "unpublished" })],
      ["b", state({ dataState: "unpublished" })]
    ]);
    expect(computeCountryCoverage(states)).toEqual({
      anyValueAtCursor: false,
      anyDeltaAtCursor: false,
      anyCapacity: true
    });
  });

  it("is false/false when every region reported no-data", () => {
    const states = new Map([
      ["a", state({ dataState: "no-data" })],
      ["b", state({ dataState: "no-data", hasDelta: false })]
    ]);
    expect(computeCountryCoverage(states)).toEqual({
      anyValueAtCursor: false,
      anyDeltaAtCursor: false,
      anyCapacity: true
    });
  });

  it("is true/true when at least one region published and has a delta", () => {
    const states = new Map([
      ["a", state({ dataState: "unpublished" })],
      ["b", state({ dataState: "value", power: 12, hasDelta: true, delta: 3 })]
    ]);
    expect(computeCountryCoverage(states)).toEqual({
      anyValueAtCursor: true,
      anyDeltaAtCursor: true,
      anyCapacity: true
    });
  });

  it("keeps the two facts independent — a value with no computable delta", () => {
    // A future slot: forecast has published ahead of time, but there is nothing to compare it
    // against yet, so hasDelta is false even though dataState is "value".
    const states = new Map([["a", state({ dataState: "value", power: 5, hasDelta: false })]]);
    expect(computeCountryCoverage(states)).toEqual({
      anyValueAtCursor: true,
      anyDeltaAtCursor: false,
      anyCapacity: true
    });
  });

  it("is false/false for an empty region set", () => {
    expect(computeCountryCoverage(new Map())).toEqual({
      anyValueAtCursor: false,
      anyDeltaAtCursor: false,
      anyCapacity: false
    });
  });
});

/**
 * Capacity comes with the region list, not the forecast, and does not move with the cursor. So
 * the capacity map must not report a forecast outage or an empty instant as a gap of its own —
 * reading `comparison === null` as "forecast" would have done exactly that.
 */
describe("coverageGaps for the capacity fill", () => {
  const status = (over: { isLoading?: boolean; hasValues?: boolean; anyCapacity?: boolean }) => ({
    isLoading: over.isLoading ?? false,
    hasValues: over.hasValues ?? false,
    coverage: {
      anyValueAtCursor: false,
      anyDeltaAtCursor: false,
      anyCapacity: over.anyCapacity ?? false
    }
  });

  it("a country with capacity but no forecast at all is no gap on the capacity map", () => {
    const statuses = { GB: status({ hasValues: false, anyCapacity: true }) };
    expect(coverageGaps(statuses, "value")).toEqual([
      { code: "GB", state: "no-forecast", metric: "value" }
    ]);
    expect(coverageGaps(statuses, "capacity")).toEqual([]);
  });

  it("a country with no capacity at all is one, once it has finished loading", () => {
    expect(coverageGaps({ NL: status({ isLoading: true }) }, "capacity")).toEqual([]);
    expect(coverageGaps({ NL: status({}) }, "capacity")).toEqual([
      { code: "NL", state: "no-forecast", metric: "capacity" }
    ]);
  });
});
