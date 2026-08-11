/**
 * The feature-id namespace, pinned.
 *
 * This is the one part of the map fan-out with a mechanical oracle, and it is also the part
 * whose failure is invisible: two countries in one Mapbox source with colliding ids do not
 * error, they paint one country's numbers on another country's ground. Every test here is a
 * collision that would otherwise have to be spotted by eye.
 */
import { describe, expect, test } from "@jest/globals";
import type { FeatureCollection } from "geojson";

import type { MapFeatureState } from "../helpers/data";
import {
  FEATURE_KEY_PROPERTY,
  REGION_COUNTRY_PROPERTY,
  countryOfFeatureKey,
  featureKeyFor,
  mergeFeatureCollections,
  mergeFeatureStates,
  namespaceFeatureStates,
  regionIdOfFeatureKey,
  stampCountryFeatures
} from "./country-features";

const collection = (ids: (string | number)[]): FeatureCollection => ({
  type: "FeatureCollection",
  features: ids.map((id) => ({
    type: "Feature",
    id,
    properties: { id, regionName: String(id) },
    geometry: { type: "Point", coordinates: [0, 0] }
  }))
});

const featureState = (over: Partial<MapFeatureState> = {}): MapFeatureState => ({
  dataState: "value",
  power: 10,
  normalized: 0.1,
  capacity: 100,
  actual: null,
  delta: 0,
  deltaBucket: 0,
  hasDelta: false,
  label: "",
  ...over
});

describe("feature keys are unique across countries", () => {
  test("the same region id in two countries is two keys", () => {
    // GB keys GSPs on a numeric gsp_id starting at 1. Any country whose API does the same —
    // Germany, on the evidence of GB and the shape of the v1 API — collides on every region.
    expect(featureKeyFor("GB", 5)).not.toBe(featureKeyFor("DE", 5));
  });

  test("unmatched features, which are numbered per collection, do not collide either", () => {
    // `buildMapGeometry` gives a feature with no region a distinct NEGATIVE id, counting from
    // -1 in each collection independently. Two countries therefore both produce -1.
    expect(featureKeyFor("GB", -1)).not.toBe(featureKeyFor("NL", -1));
  });

  test("a numeric id and its string spelling are the same key", () => {
    // The click path builds keys out of `selectedMapRegionIds`, which is string-valued, while
    // geometry builds them out of the API's numbers. If those disagreed the selection outline
    // would simply never appear at GSP level.
    expect(featureKeyFor("GB", 5)).toBe(featureKeyFor("GB", "5"));
  });

  test("the country half is case-insensitive", () => {
    expect(featureKeyFor("gb", 5)).toBe(featureKeyFor("GB", 5));
  });

  test("a key round-trips back to its region id and country", () => {
    expect(regionIdOfFeatureKey(featureKeyFor("NL", "groningen"))).toBe("groningen");
    expect(countryOfFeatureKey(featureKeyFor("NL", "groningen"))).toBe("NL");
  });

  test("a region name containing the separator survives the round trip", () => {
    const key = featureKeyFor("GB", "a:b");
    expect(regionIdOfFeatureKey(key)).toBe("a:b");
    expect(countryOfFeatureKey(key)).toBe("GB");
  });
});

describe("stamping geometry", () => {
  test("every feature carries its country and its key, and keeps its region id", () => {
    const stamped = stampCountryFeatures("gb", collection([5, "citr_1"]))!;
    expect(
      stamped.features.map((feature) => feature.properties?.[REGION_COUNTRY_PROPERTY])
    ).toEqual(["GB", "GB"]);
    expect(stamped.features.map((feature) => feature.properties?.[FEATURE_KEY_PROPERTY])).toEqual([
      "GB:5",
      "GB:citr_1"
    ]);
    // `properties.id` is the domain id and is what `selectedMapRegionIds`, the GSP sub-chart
    // and the CSV speak. The namespace stops at the map layer.
    expect(stamped.features.map((feature) => feature.properties?.id)).toEqual([5, "citr_1"]);
  });

  test("the top-level feature id agrees with the promoted property", () => {
    const stamped = stampCountryFeatures("GB", collection([5]))!;
    expect(stamped.features[0].id).toBe(stamped.features[0].properties?.[FEATURE_KEY_PROPERTY]);
  });

  test("undefined geometry stays undefined — the pre-arrival state, not an empty map", () => {
    expect(stampCountryFeatures("GB", undefined)).toBeUndefined();
  });

  test("the source collection is not mutated", () => {
    const source = collection([5]);
    stampCountryFeatures("GB", source);
    expect(source.features[0].properties).toEqual({ id: 5, regionName: "5" });
  });
});

describe("namespacing feature states", () => {
  test("states are re-keyed onto the same keys the geometry carries", () => {
    const geometry = stampCountryFeatures("GB", collection([5]))!;
    const states = namespaceFeatureStates("GB", new Map([[5, featureState()]]));
    expect([...states.keys()]).toEqual([geometry.features[0].properties?.[FEATURE_KEY_PROPERTY]]);
  });

  test("two countries' value maps merge without overwriting each other", () => {
    const gb = namespaceFeatureStates("GB", new Map([[5, featureState({ power: 100 })]]));
    const nl = namespaceFeatureStates("NL", new Map([[5, featureState({ power: 7 })]]));
    const merged = mergeFeatureStates([gb, nl]);
    expect(merged.size).toBe(2);
    expect(merged.get("GB:5")?.power).toBe(100);
    expect(merged.get("NL:5")?.power).toBe(7);
  });

  test("the grouped flag is stamped per country, so a rollup and a region level can coexist", () => {
    const dno = namespaceFeatureStates("GB", new Map([["UKPN (East)", featureState()]]), {
      grouped: true
    });
    const province = namespaceFeatureStates("NL", new Map([["groningen", featureState()]]));
    expect(dno.get("GB:UKPN (East)")?.grouped).toBe(true);
    // Absent rather than false: `fillOpacityExpression` treats anything but `true` as the
    // region-level bands, and not writing the key keeps the feature state one entry smaller.
    expect(province.get("NL:groningen")?.grouped).toBeUndefined();
  });
});

describe("merging geometry", () => {
  test("nothing loaded is undefined, not an empty collection", () => {
    expect(mergeFeatureCollections([undefined, undefined])).toBeUndefined();
  });

  test("a country still in flight does not hold up one that has landed", () => {
    const gb = stampCountryFeatures("GB", collection([5]));
    const merged = mergeFeatureCollections([gb, undefined])!;
    expect(merged.features).toHaveLength(1);
  });

  test("both countries' features end up in one collection", () => {
    const merged = mergeFeatureCollections([
      stampCountryFeatures("GB", collection([5])),
      stampCountryFeatures("NL", collection([5]))
    ])!;
    expect(merged.features.map((feature) => feature.properties?.[FEATURE_KEY_PROPERTY])).toEqual([
      "GB:5",
      "NL:5"
    ]);
  });

  test("a single country's collection passes through by identity", () => {
    // Load-bearing: the map calls `setData` only when the collection's identity changes, and
    // the GB-only case is the common one. Re-wrapping it would re-parse 9 MB of boundaries
    // every time any of the merge's inputs re-rendered.
    const gb = stampCountryFeatures("GB", collection([5]));
    expect(mergeFeatureCollections([gb, undefined])).toBe(gb);
  });
});
