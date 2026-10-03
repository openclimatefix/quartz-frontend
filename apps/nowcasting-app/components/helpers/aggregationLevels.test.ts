/**
 * The country-derived aggregation levels that replace the GB-shaped enums.
 *
 * The safety property is the GB equivalence: the derived list has to reproduce GB's four
 * levels and their zoom bands exactly, so that replacing the enums moved nothing visible.
 *
 * `NationalAggregation` is now deleted (Phase 5), and the four labels it held are spelled
 * out literally below rather than imported. `AGGREGATION_LEVELS` and
 * `AGGREGATION_LEVEL_MIN_ZOOM`/`MAX_ZOOM` survive, but only as the **sites view's** bands —
 * every remaining consumer is the sites map, its zoom slider or its chart. They are not the
 * region hierarchy any more, and nothing here should treat them as such.
 */
import { describe, expect, test } from "@jest/globals";

import { getCountryConfig } from "../../config/countries";
import {
  AGGREGATION_LEVELS,
  AGGREGATION_LEVEL_MAX_ZOOM,
  AGGREGATION_LEVEL_MIN_ZOOM
} from "../../constant";
import type { RegionTypeCapability } from "../../lib/domain/types";
import { defaultAggregationLevel, deriveAggregationLevels } from "./aggregationLevels";

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

// `gsp` is spelled "Grid Supply Point" here because that is what the live manifest says.
// The registry overrides it to "GSP" for GB, so this fixture being truthful is what makes
// the label assertions below prove the override rather than restate the input.
const GB_MANIFEST = manifest([
  ["national", "National", 0],
  ["gsp", "Grid Supply Point", 10]
]);

const NL_MANIFEST = manifest([
  ["national", "National", 0],
  ["province", "Province", 10]
]);

describe("GB's registry label overrides the manifest's", () => {
  // Brad's call: GB reads "GSP" throughout. The manifest says "Grid Supply Point", so
  // without the override the aggregation control's copy changes under us the moment the
  // manifest lands — and, before it lands, reads "Gsp" from the fallback derivation.
  test("uses the registry label, not the manifest's", () => {
    const levels = deriveAggregationLevels(getCountryConfig("GB"), GB_MANIFEST);
    expect(levels.find((level) => level.regionType === "gsp")?.label).toBe("GSP");
  });

  test("resolves the same label before the manifest loads, so the control does not flash", () => {
    const withManifest = deriveAggregationLevels(getCountryConfig("GB"), GB_MANIFEST);
    const withoutManifest = deriveAggregationLevels(getCountryConfig("GB"));
    const labelOf = (levels: ReturnType<typeof deriveAggregationLevels>) =>
      levels.find((level) => level.regionType === "gsp")?.label;
    expect(labelOf(withoutManifest)).toBe("GSP");
    expect(labelOf(withManifest)).toBe(labelOf(withoutManifest));
  });

  test("NL keeps the manifest's label, having declared no override", () => {
    const levels = deriveAggregationLevels(getCountryConfig("NL"), NL_MANIFEST);
    expect(levels.find((level) => level.regionType === "province")?.label).toBe("Province");
  });
});

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
    // And nothing else moved: GB still gets exactly the levels its registry entry declares.
    expect(levels.map((level) => level.regionType)).toEqual(["national", "dno", "zone", "gsp"]);
  });
});

describe("defaultAggregationLevel", () => {
  const GB = getCountryConfig("GB")!;

  test.each([
    ["GB", getCountryConfig("GB"), GB_MANIFEST, "gsp"],
    ["NL", getCountryConfig("NL"), NL_MANIFEST, "province"]
  ])("%s starts on its finest non-derived level", (_name, config, regionTypes, expected) => {
    expect(defaultAggregationLevel(config, regionTypes)).toBe(expected);
  });

  test("resolves the same without the manifest, which is how the state layer calls it", () => {
    // `defaultCountryScopedState` is synchronous and pre-hook: it has the registry and
    // nothing else. If the two answers could differ, the app would start on one level and
    // silently move to another when `/countries` resolved.
    expect(defaultAggregationLevel(getCountryConfig("GB"))).toBe("gsp");
    expect(defaultAggregationLevel(getCountryConfig("NL"))).toBe("province");
  });

  test("never picks a derived level, however fine it sorts", () => {
    // A country with GB's client-side groupings but no sub-national boundaries of its own.
    // `zone` sorts finer than `national` and would win a naive "last level" rule, but its
    // values are a rollup over a source region type this config cannot draw.
    const groupingsOnly = { ...GB, geo: { national: GB.geo.national } };
    expect(defaultAggregationLevel(groupingsOnly, GB_MANIFEST)).toBe("national");
  });

  test("falls back to national for a country with no sub-national geo entry", () => {
    const nationalOnly = { ...GB, geo: { national: GB.geo.national }, derivedRegionTypes: {} };
    expect(defaultAggregationLevel(nationalOnly, GB_MANIFEST)).toBe("national");
  });

  test("falls back to national for a country with no registry entry", () => {
    expect(defaultAggregationLevel(getCountryConfig("ZZ"), GB_MANIFEST)).toBe("national");
  });
});

describe("GB equivalence with the enums the list replaces", () => {
  const gbLevels = deriveAggregationLevels(getCountryConfig("GB"), GB_MANIFEST);

  // These four strings were `NationalAggregation`'s members. The enum is gone as of Phase 5,
  // so they are spelled out here rather than imported: this test's whole job is to pin GB's
  // levels against an independent statement of what they were, and deriving the expectation
  // from the same code under test would make it vacuous. Changing this list means GB's
  // aggregation control changed, which is a product decision, not a refactor.
  test("produces exactly the four levels the old NationalAggregation enum listed", () => {
    expect(gbLevels.map((level) => level.label).sort()).toEqual(
      ["DNO", "GSP", "National", "Zone"].sort()
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
