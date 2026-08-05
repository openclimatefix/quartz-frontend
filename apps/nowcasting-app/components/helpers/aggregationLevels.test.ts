/**
 * The country-derived aggregation levels that replace the GB-shaped enums.
 *
 * The safety property is the GB equivalence: `AGGREGATION_LEVELS`,
 * `AGGREGATION_LEVEL_MIN_ZOOM`/`MAX_ZOOM` and `NationalAggregation` still have ~100
 * consumers, so the derived list has to reproduce GB's four levels and their zoom bands
 * exactly. When Phase 4 deletes the enums, these assertions are what proves nothing moved.
 */
import { describe, expect, test } from "@jest/globals";

import { getCountryConfig } from "../../config/countries";
import {
  AGGREGATION_LEVELS,
  AGGREGATION_LEVEL_MAX_ZOOM,
  AGGREGATION_LEVEL_MIN_ZOOM
} from "../../constant";
import type { RegionTypeCapability } from "../../lib/domain/types";
import { NationalAggregation } from "../map/types";
import { deriveAggregationLevels } from "./aggregationLevels";

/** Manifest region types, as `GET /countries` reports them. Level is sparse by design. */
const manifest = (
  types: Array<[type: string, label: string, level: number]>
): RegionTypeCapability[] =>
  types.map(([type, label, level]) => ({
    type,
    label,
    level,
    forecastModels: [],
    defaultModel: null
  }));

const GB_MANIFEST = manifest([
  ["national", "National", 0],
  ["gsp", "GSP", 10]
]);

const NL_MANIFEST = manifest([
  ["national", "National", 0],
  ["province", "Province", 10]
]);

describe("deriveAggregationLevels", () => {
  test.each([
    {
      country: "GB",
      regionTypes: GB_MANIFEST,
      // National, then GB's two client-side groupings, then GSP: outermost first.
      expected: [
        { regionType: "national", level: 0, label: "National", minZoom: 0, maxZoom: 5 },
        { regionType: "dno", level: 5, label: "DNO", minZoom: 5, maxZoom: 7 },
        { regionType: "zone", level: 6, label: "Zone", minZoom: 5, maxZoom: 7 },
        { regionType: "gsp", level: 10, label: "GSP", minZoom: 7, maxZoom: 8.5 }
      ],
      derived: ["dno", "zone"]
    },
    {
      country: "NL",
      regionTypes: NL_MANIFEST,
      // No groupings: the API's province level is NL's only sub-national one.
      expected: [
        { regionType: "national", level: 0, label: "National", minZoom: 0, maxZoom: 6 },
        { regionType: "province", level: 10, label: "Province", minZoom: 6, maxZoom: 14 }
      ],
      derived: []
    }
  ])("derives $country's levels from the registry and the manifest", (row) => {
    const levels = deriveAggregationLevels(getCountryConfig(row.country), row.regionTypes);

    expect(levels.map(({ derived, ...rest }) => rest)).toEqual(row.expected);
    expect(levels.filter((level) => level.derived).map((level) => level.regionType)).toEqual(
      row.derived
    );
  });

  test("falls back to a sane level and label when the manifest has not loaded", () => {
    // The list must be usable before `/countries` resolves — the map draws from it.
    const levels = deriveAggregationLevels(getCountryConfig("NL"));
    expect(levels.map((level) => [level.regionType, level.label, level.level])).toEqual([
      ["national", "National", 0],
      ["province", "Province", 10]
    ]);
  });

  test("returns [] for a country with no registry entry, matching getCountryConfig", () => {
    // `/countries` returns every country the API serves, so this is a legal state.
    expect(deriveAggregationLevels(getCountryConfig("ZZ"), GB_MANIFEST)).toEqual([]);
  });

  test("offers no level for a region type the registry has no boundaries for", () => {
    // A level that cannot be drawn or clicked would be a broken level, so the registry's
    // `geo` block gates the list rather than the manifest.
    const levels = deriveAggregationLevels(
      getCountryConfig("GB"),
      manifest([["province", "Province", 10]])
    );
    expect(levels.map((level) => level.regionType)).not.toContain("province");
  });
});

describe("GB equivalence with the enums the list replaces", () => {
  const gbLevels = deriveAggregationLevels(getCountryConfig("GB"), GB_MANIFEST);

  test("produces exactly the four levels NationalAggregation enumerates", () => {
    expect(gbLevels.map((level) => level.label).sort()).toEqual(
      Object.values(NationalAggregation).sort()
    );
  });

  // NATIONAL/REGION/GSP are the enum members with a boundary layer; the two groupings share
  // REGION's band, which is why the mapping is many-to-one. SITE has no entry: it is the
  // solar-sites view, which draws points from the sites API rather than a region layer, so
  // it is not an aggregation of regions at all.
  test.each<[string, AGGREGATION_LEVELS]>([
    ["national", AGGREGATION_LEVELS.NATIONAL],
    ["dno", AGGREGATION_LEVELS.REGION],
    ["zone", AGGREGATION_LEVELS.REGION],
    ["gsp", AGGREGATION_LEVELS.GSP]
  ])("%s keeps the zoom band AGGREGATION_LEVEL_*_ZOOM.%s declares", (regionType, level) => {
    const derived = gbLevels.find((candidate) => candidate.regionType === regionType)!;
    expect(derived.minZoom).toBe(AGGREGATION_LEVEL_MIN_ZOOM[level]);
    expect(derived.maxZoom).toBe(AGGREGATION_LEVEL_MAX_ZOOM[level]);
  });
});
