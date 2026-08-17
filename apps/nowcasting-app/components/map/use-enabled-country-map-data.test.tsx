/**
 * The fan-out's two silent-plausible properties.
 *
 * 1. **Geometry identity survives a value change.** The map calls `setData` only when the
 *    merged collection's identity moves; if merging re-wrapped it whenever a number did,
 *    every scrub tick would re-parse and re-tessellate every country's boundaries — GB's is
 *    9 MB — and nothing on screen would say so, it would just feel slow. This is the cost
 *    Phase 5 spent itself removing, and the fan-out is where it could come back.
 * 2. **Enabling a country adds its layer; disabling removes it**, values and all, rather than
 *    leaving a stale country's states in the merged map where `applyFeatureStates` would keep
 *    painting them onto polygons that are no longer drawn.
 */
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import React from "react";
import { render } from "@testing-library/react";
import type { FeatureCollection } from "geojson";

import type { MapFeatureState } from "../helpers/data";

// The enabled set, swapped per test. `useEnabledCountries` is synchronous global state in the
// real app, which is exactly why the fan-out reads it rather than the manifest-backed listings.
let enabled: string[] = ["GB"];
jest.mock("../../hooks/data/use-countries", () => ({
  __esModule: true,
  useEnabledCountries: () => enabled,
  useFocusedCountry: () => enabled[0]
}));

const level = (regionType: string, derived = false) => ({
  regionType,
  level: derived ? 5 : 10,
  label: regionType,
  minZoom: 0,
  maxZoom: 14,
  derived
});

jest.mock("../../hooks/data", () => ({
  __esModule: true,
  useAggregationLevels: (country: string) => [country === "NL" ? level("province") : level("gsp")],
  useCurrentAggregationLevel: (country: string) =>
    country === "NL" ? level("province") : level("gsp")
}));

// One frozen collection per country: the identity is the whole point of the first test, so a
// stub returning a fresh literal per render would make it vacuously pass.
const geometryFor: Record<string, FeatureCollection> = {
  GB: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: 5,
        properties: { id: 5 },
        geometry: { type: "Point", coordinates: [0, 0] }
      }
    ]
  },
  NL: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: "groningen",
        properties: { id: "groningen" },
        geometry: { type: "Point", coordinates: [0, 0] }
      }
    ]
  }
};

const featureState = (power: number): MapFeatureState => ({
  dataState: "value",
  power,
  normalized: 0,
  capacity: 100,
  actual: null,
  delta: 0,
  deltaNormalized: 0,
  deltaBucketNormalized: DELTA_BUCKET.ZERO,
  deltaBucket: 0,
  hasDelta: false,
  label: ""
});

// The values a country reports, keyed so a test can move one country's numbers and leave the
// other's — and, crucially, leave both countries' geometry alone.
let powerFor: Record<string, number> = { GB: 1, NL: 1 };
jest.mock("./use-map-region-values", () => ({
  __esModule: true,
  default: (_level: unknown, _cursorTime: string, country: string) => ({
    geometry: geometryFor[country],
    featureStates: new Map([
      [country === "NL" ? "groningen" : 5, featureState(powerFor[country] ?? 0)]
    ]),
    coverage: { published: 1, expected: 1, isPartial: false },
    hasValues: true,
    nationalCapacityMw: country === "NL" ? 20 : 100,
    isLoading: false,
    error: undefined
  })
}));

import { DELTA_BUCKET } from "../../constant";
import {
  useEnabledCountryMapData,
  type EnabledCountryMapData
} from "./use-enabled-country-map-data";

/**
 * The loaders must actually be rendered — they are the per-country hook instances, and a
 * harness that only *called* the hook would report an empty map forever. That is the same
 * mistake a map component would make by dropping `loaders` from one of its render arms, which
 * is why both `pvLatestMap` and `deltaMap` render them outside their loading/failure branches.
 */
let latest: EnabledCountryMapData;
const Harness: React.FC<{ cursorTime: string }> = ({ cursorTime }) => {
  latest = useEnabledCountryMapData(cursorTime);
  return <>{latest.loaders}</>;
};

const renderFanOut = (cursorTime = "2026-08-04T12:00:00Z") => {
  const { rerender } = render(<Harness cursorTime={cursorTime} />);
  return {
    rerender: (next = cursorTime) => rerender(<Harness cursorTime={next} />),
    get data() {
      return latest;
    }
  };
};

describe("the map fan-out", () => {
  beforeEach(() => {
    enabled = ["GB"];
    powerFor = { GB: 1, NL: 1 };
  });

  test("draws every enabled country, each feature stamped with its country", () => {
    enabled = ["GB", "NL"];
    const fanOut = renderFanOut();

    const features = fanOut.data.geometry?.features ?? [];
    expect(features.map((feature) => feature.properties?.country)).toEqual(["GB", "NL"]);
    expect([...fanOut.data.featureStates.keys()]).toEqual(["GB:5", "NL:groningen"]);
  });

  test("a value change does not give the geometry a new identity", () => {
    enabled = ["GB", "NL"];
    const fanOut = renderFanOut();
    const before = fanOut.data.geometry;

    powerFor = { GB: 42, NL: 1 };
    fanOut.rerender("2026-08-04T12:30:00Z");

    expect(fanOut.data.geometry).toBe(before);
    expect(fanOut.data.featureStates.get("GB:5")?.power).toBe(42);
  });

  test("capacity is reported per country, not as one national figure", () => {
    enabled = ["GB", "NL"];
    const fanOut = renderFanOut();
    expect(fanOut.data.capacityByCountry).toEqual({ GB: 100, NL: 20 });
  });

  test("disabling a country drops its features and its values", () => {
    enabled = ["GB", "NL"];
    const fanOut = renderFanOut();
    expect(fanOut.data.geometry?.features).toHaveLength(2);

    enabled = ["GB"];
    fanOut.rerender();

    expect(fanOut.data.geometry?.features).toHaveLength(1);
    expect([...fanOut.data.featureStates.keys()]).toEqual(["GB:5"]);
  });
});
