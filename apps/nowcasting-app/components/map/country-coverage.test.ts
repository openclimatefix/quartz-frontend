import { describe, expect, it } from "@jest/globals";
import { computeCountryCoverage, decideCountryCoverage } from "./country-coverage";
import type { MapFeatureState } from "../helpers/data";
import { DELTA_BUCKET } from "../../constant";

const state = (overrides: Partial<MapFeatureState> = {}): MapFeatureState => ({
  dataState: "unpublished",
  power: 0,
  normalized: 0,
  capacity: 100,
  actual: null,
  delta: 0,
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
      anyDeltaAtCursor: false
    });
  });

  it("is false/false when every region reported no-data", () => {
    const states = new Map([
      ["a", state({ dataState: "no-data" })],
      ["b", state({ dataState: "no-data", hasDelta: false })]
    ]);
    expect(computeCountryCoverage(states)).toEqual({
      anyValueAtCursor: false,
      anyDeltaAtCursor: false
    });
  });

  it("is true/true when at least one region published and has a delta", () => {
    const states = new Map([
      ["a", state({ dataState: "unpublished" })],
      ["b", state({ dataState: "value", power: 12, hasDelta: true, delta: 3 })]
    ]);
    expect(computeCountryCoverage(states)).toEqual({
      anyValueAtCursor: true,
      anyDeltaAtCursor: true
    });
  });

  it("keeps the two facts independent — a value with no computable delta", () => {
    // A future slot: forecast has published ahead of time, but there is nothing to compare it
    // against yet, so hasDelta is false even though dataState is "value".
    const states = new Map([["a", state({ dataState: "value", power: 5, hasDelta: false })]]);
    expect(computeCountryCoverage(states)).toEqual({
      anyValueAtCursor: true,
      anyDeltaAtCursor: false
    });
  });

  it("is false/false for an empty region set", () => {
    expect(computeCountryCoverage(new Map())).toEqual({
      anyValueAtCursor: false,
      anyDeltaAtCursor: false
    });
  });
});
