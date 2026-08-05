import { describe, expect, test } from "@jest/globals";

import {
  COUNTRY_CONFIG,
  configuredCountryCodes,
  getCountryConfig,
  type CountryConfig
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
