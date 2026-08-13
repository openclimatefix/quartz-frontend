import { describe, expect, test } from "@jest/globals";

import {
  COUNTRY_CONFIG,
  NATIONAL_FORECAST_MODEL_SUFFIX,
  configuredCountryCodes,
  forecastSeriesModel,
  getCountryConfig,
  type CountryConfig,
  sortCountryCodes
} from "./countries";

const entries = Object.entries(COUNTRY_CONFIG);

describe("COUNTRY_CONFIG", () => {
  test("carries the countries the manifest currently serves", () => {
    expect(configuredCountryCodes().sort()).toEqual(["GB", "NL"]);
  });

  test.each(entries)("%s is well-formed", (key, config: CountryConfig) => {
    // The record key is the lookup path, so a mismatch would make getCountryConfig
    // silently return a different country's config.
    expect(config.code).toBe(key);
    expect(key).toBe(key.toUpperCase());

    // A bad IANA zone throws only at the point a date is formatted, which in this app is
    // deep inside a chart tick formatter. Fail here instead.
    expect(() =>
      new Intl.DateTimeFormat(config.locale, { timeZone: config.timezone }).format(new Date(0))
    ).not.toThrow();

    expect(config.map.center.lat).toBeGreaterThanOrEqual(-90);
    expect(config.map.center.lat).toBeLessThanOrEqual(90);
    expect(config.map.center.lng).toBeGreaterThanOrEqual(-180);
    expect(config.map.center.lng).toBeLessThanOrEqual(180);
    expect(config.map.minZoom).toBeLessThanOrEqual(config.map.zoom);
    expect(config.map.zoom).toBeLessThanOrEqual(config.map.maxZoom);

    expect(Object.keys(config.geo).length).toBeGreaterThan(0);
    for (const [regionType, geo] of Object.entries(config.geo)) {
      expect(geo.url).toBe(`/geo/${key.toLowerCase()}/${regionType}.json`);
      expect(geo.joinProperty.length).toBeGreaterThan(0);
      if (geo.minZoom !== undefined && geo.maxZoom !== undefined) {
        expect(geo.minZoom).toBeLessThan(geo.maxZoom);
      }
    }

    for (const derived of Object.values(config.derivedRegionTypes)) {
      // A derived type groups a real one; grouping something that does not exist in `geo`
      // would leave it with no geometry to aggregate.
      expect(Object.keys(config.geo)).toContain(derived.source);
      expect(derived.label.length).toBeGreaterThan(0);
      // Sparse manifest levels: 0 national, 10 gsp/province. Derived types slot between.
      expect(derived.level).toBeGreaterThan(0);
      expect(derived.level).toBeLessThan(10);
    }

    for (const overlay of config.overlays) {
      expect(overlay.id.length).toBeGreaterThan(0);
      expect(overlay.url.startsWith("/")).toBe(true);
    }

    expect(config.auth0Role.length).toBeGreaterThan(0);

    // Every country charts at least one forecast line, and the first is the primary series —
    // the one the p-levels, the header numbers and the staleness indicator come from. It must
    // be the FORECAST key, because that is what remix-line's past/future pair binds to.
    expect(config.nationalChartSeries.length).toBeGreaterThan(0);
    expect(config.nationalChartSeries[0].key).toBe("FORECAST");
    // A duplicate key would have the later series silently overwrite the earlier one in the
    // merged chart row.
    const keys = config.nationalChartSeries.map((series) => series.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const series of config.nationalChartSeries) {
      expect(series.label.length).toBeGreaterThan(0);
      // Non-adjusted models only, for now. `_adjust` is applied centrally by the suffix, so a
      // model name carrying it here would double up.
      expect(series.model).not.toMatch(/_adjust$/);
    }
  });

  test("GB carries the map view previously hardcoded in globalState", () => {
    expect(COUNTRY_CONFIG.GB.map.center).toEqual({ lng: -2.3175601, lat: 54.70534432 });
    expect(COUNTRY_CONFIG.GB.map.zoom).toBe(5);
  });

  // Verified API fact 1: v1 GB gsp names are lowercase codes, properties.GSPs is uppercase,
  // so a whole-string case fold is the entire join.
  test("GB gsp joins on GSPs with a lowercase transform", () => {
    expect(COUNTRY_CONFIG.GB.geo.gsp.joinProperty).toBe("GSPs");
    expect(COUNTRY_CONFIG.GB.geo.gsp.joinTransform).toBe("lowercase");
  });

  test("GB derives DNO and zone from gsp; NL derives nothing", () => {
    expect(Object.keys(COUNTRY_CONFIG.GB.derivedRegionTypes).sort()).toEqual(["dno", "zone"]);
    expect(COUNTRY_CONFIG.GB.derivedRegionTypes.dno.source).toBe("gsp");
    expect(COUNTRY_CONFIG.NL.derivedRegionTypes).toEqual({});
  });

  test("NL uses its own timezone, locale and province region type", () => {
    expect(COUNTRY_CONFIG.NL.timezone).toBe("Europe/Amsterdam");
    expect(COUNTRY_CONFIG.NL.locale).toBe("nl-NL");
    expect(COUNTRY_CONFIG.NL.geo.province).toBeDefined();
  });

  // A later agent derives `{ regionType, level, label, minZoom, maxZoom }` from this; the
  // bands have to be expressible per region type for that to be possible at all.
  test("zoom bands are expressed per region type", () => {
    expect(COUNTRY_CONFIG.GB.geo.national.maxZoom).toBe(5);
    expect(COUNTRY_CONFIG.GB.derivedRegionTypes.dno.minZoom).toBe(5);
    expect(COUNTRY_CONFIG.GB.derivedRegionTypes.dno.maxZoom).toBe(7);
    expect(COUNTRY_CONFIG.GB.geo.gsp.minZoom).toBe(7);
  });
});

describe("the national chart's series list", () => {
  // The v0 -> v1 model mapping, pinned. Every one of these existed as a hardcoded fetch in
  // pages/index.tsx; if a name drifts, the line silently disappears rather than erroring,
  // because an unknown model is the API's problem and the chart just draws nothing.
  test("GB charts the same six models v0 did, under the v1 names", () => {
    expect(COUNTRY_CONFIG.GB.nationalChartSeries.map((s) => [s.key, s.model])).toEqual([
      ["FORECAST", "blend"],
      ["INTRADAY_ECMWF_ONLY", "pvnet_ecmwf"],
      ["PVNET_DAY_AHEAD", "pvnet_day_ahead"],
      ["PVNET_INTRADAY", "pvnet_intraday"],
      ["MET_OFFICE_ONLY", "pvnet_ukv"],
      ["SAT_ONLY", "pvnet_sat"]
    ]);
  });

  // The point of the whole exercise: the two-line-plus-five-comparisons chart is a GB fact.
  test("NL charts one line, not GB's six", () => {
    expect(COUNTRY_CONFIG.NL.nationalChartSeries).toHaveLength(1);
    expect(COUNTRY_CONFIG.NL.nationalChartSeries[0]).toMatchObject({
      key: "FORECAST",
      model: "blend"
    });
  });

  // Only the series that had a legend entry before have one now; the two PVNet comparison
  // series are fetched and charted but unlabelled, exactly as they were.
  test("GB gives ECMWF, Met Office and Satellite legend entries and the PVNet pair none", () => {
    const withLegend = COUNTRY_CONFIG.GB.nationalChartSeries
      .filter((s) => !!s.legend)
      .map((s) => s.key);
    expect(withLegend).toEqual(["INTRADAY_ECMWF_ONLY", "MET_OFFICE_ONLY", "SAT_ONLY"]);
  });

  // The `_adjust` swap has to stay a one-line edit, so it must go through this one function.
  describe("forecastSeriesModel", () => {
    test("appends the suffix, which is empty today", () => {
      expect(NATIONAL_FORECAST_MODEL_SUFFIX).toBe("");
      expect(forecastSeriesModel({ key: "FORECAST", model: "blend", label: "x" })).toBe("blend");
    });

    // `null` means "send no model parameter", which is not the same as sending an empty one:
    // the API applies the region type's default server-side and the cache key stays stable.
    test("a null model sends no model parameter at all", () => {
      expect(forecastSeriesModel({ key: "FORECAST", model: null, label: "x" })).toBeUndefined();
    });
  });
});

describe("getCountryConfig", () => {
  test.each([
    ["GB", "GB"],
    ["gb", "GB"],
    ["nl", "NL"]
  ])("resolves %s case-insensitively", (input, expected) => {
    expect(getCountryConfig(input)?.code).toBe(expected);
  });

  // /countries returns every country the API serves, so the manifest can name one this
  // build has no entry for. That must be a miss, not a throw.
  test.each([["DE"], [""], ["not-a-country"]])("returns undefined for %p", (input) => {
    expect(getCountryConfig(input)).toBeUndefined();
  });

  test.each([[null], [undefined], [42], [{}]])("tolerates the non-string %p", (input) => {
    expect(getCountryConfig(input as never)).toBeUndefined();
  });
});

/**
 * One list order, shared by every surface that lists countries.
 *
 * The header toggle, the chart's country picker and the footer's zone stack each had their own
 * rule — manifest order, enabled-set order, and UTC offset respectively — so the same two
 * countries appeared in different sequences on one screen, and the picker reordered itself as
 * the user toggled things.
 */
describe("sortCountryCodes", () => {
  test("returns registry order regardless of the order it is given", () => {
    const codes = (order: string[]) => sortCountryCodes(order, (code) => code);
    expect(codes(["NL", "GB"])).toEqual(["GB", "NL"]);
    expect(codes(["GB", "NL"])).toEqual(["GB", "NL"]);
  });

  test("sorts countries this build has no config for last, alphabetically", () => {
    // The header lists every country the API serves, including ones with no registry entry —
    // they have to land somewhere predictable rather than at the front.
    expect(sortCountryCodes(["ZZ", "NL", "AA", "GB"], (code) => code)).toEqual([
      "GB",
      "NL",
      "AA",
      "ZZ"
    ]);
  });

  test("does not mutate its input", () => {
    const input = ["NL", "GB"];
    sortCountryCodes(input, (code) => code);
    expect(input).toEqual(["NL", "GB"]);
  });

  test("orders objects by the code the accessor picks out", () => {
    const rows = [{ code: "NL" }, { code: "GB" }];
    expect(sortCountryCodes(rows, (row) => row.code).map((row) => row.code)).toEqual(["GB", "NL"]);
  });
});
