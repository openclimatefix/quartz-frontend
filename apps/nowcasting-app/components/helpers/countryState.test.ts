/**
 * The country dimension of the global state.
 *
 * The property worth protecting is the *restore*: switching country and switching back must
 * put the map and the selection where the user left them. Everything else here — the lazy
 * per-country defaults, the fallback for an unconfigured country, the cookie round-trip — is
 * in service of that, plus the guarantee that a GB-only user sees exactly what they saw
 * before the split.
 */
import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import { act, renderHook } from "@testing-library/react";
import Cookies from "js-cookie";

import { getCountryConfig } from "../../config/countries";
import { DEFAULT_COUNTRY_CODE as DATA_LAYER_DEFAULT_COUNTRY } from "../../hooks/data/use-countries";
import { AGGREGATION_LEVELS } from "../../constant";
import { CookieStorageKeys } from "./cookieStorage";
import { defaultAggregationLevel } from "./aggregationLevels";
import {
  COUNTRY_SCOPED_KEYS,
  DEFAULT_COUNTRY_CODE,
  FALLBACK_MAP_DEFAULTS,
  defaultCountryScopedState,
  normaliseCountryCode
} from "./countryState";
import {
  getCountryState,
  getGlobalState,
  setCountryState,
  setCurrentCountry,
  setGlobalState,
  useCountryState
} from "./globalState";

const GB = getCountryConfig("GB")!;
const NL = getCountryConfig("NL")!;
/** A country the manifest could legally name but this build has no registry entry for. */
const UNCONFIGURED = "ZZ";

// `react-hooks-global-state` has no provider: the store is module-global and leaks between
// tests. Emptying every country-keyed record puts each test back at "no country visited
// yet", which is what the lazy defaults are keyed off.
const resetState = () => {
  setGlobalState("currentCountry", DEFAULT_COUNTRY_CODE);
  for (const key of COUNTRY_SCOPED_KEYS) {
    // Every country-keyed value is a `Record<string, …>`; the loop cannot express that the
    // key and the record's value type are correlated, so one member stands in for all.
    setGlobalState(key as "lng", {});
  }
};

beforeEach(resetState);
afterEach(() => Cookies.remove(CookieStorageKeys.COUNTRY));

describe("the default country", () => {
  test("matches the data layer's, which declares it separately", () => {
    // `countryState` cannot import `use-countries` (SWR + Auth0 at module scope, in every
    // component that touches state), so the constant is duplicated. This is the pin.
    expect(DEFAULT_COUNTRY_CODE).toBe(DATA_LAYER_DEFAULT_COUNTRY);
  });

  test("is what an unset, blank or non-string code normalises to", () => {
    expect(normaliseCountryCode(undefined)).toBe(DEFAULT_COUNTRY_CODE);
    expect(normaliseCountryCode(null)).toBe(DEFAULT_COUNTRY_CODE);
    expect(normaliseCountryCode("   ")).toBe(DEFAULT_COUNTRY_CODE);
  });

  test("canonicalises case, so `gb` and `GB` cannot become two slices", () => {
    expect(normaliseCountryCode("nl")).toBe("NL");
    expect(normaliseCountryCode(" gb ")).toBe("GB");
  });
});

describe("per-country defaults", () => {
  test("GB's viewport is the registry's, unchanged from the value that was hardcoded", () => {
    const gb = defaultCountryScopedState("GB");
    expect(gb.lng).toBe(-2.3175601);
    expect(gb.lat).toBe(54.70534432);
    expect(gb.zoom).toBe(5);
    // The pre-split initial state, restated so a registry edit fails here rather than
    // silently moving every GB user's map.
    expect({ lng: gb.lng, lat: gb.lat, zoom: gb.zoom }).toEqual({
      lng: GB.map.center.lng,
      lat: GB.map.center.lat,
      zoom: GB.map.zoom
    });
  });

  test("NL's viewport is NL's, not GB's", () => {
    const nl = defaultCountryScopedState("NL");
    expect({ lng: nl.lng, lat: nl.lat, zoom: nl.zoom }).toEqual({
      lng: NL.map.center.lng,
      lat: NL.map.center.lat,
      zoom: NL.map.zoom
    });
  });

  test("an unconfigured country degrades to a usable map rather than NaN coordinates", () => {
    const unknown = defaultCountryScopedState(UNCONFIGURED);
    expect(unknown.lng).toBe(FALLBACK_MAP_DEFAULTS.center.lng);
    expect(unknown.lat).toBe(FALLBACK_MAP_DEFAULTS.center.lat);
    expect(unknown.zoom).toBe(FALLBACK_MAP_DEFAULTS.zoom);
    expect(Number.isFinite(unknown.lng)).toBe(true);
  });

  test("selection starts empty and aggregation at national, for every country", () => {
    for (const code of ["GB", "NL", UNCONFIGURED]) {
      const slice = defaultCountryScopedState(code);
      expect(slice.clickedGspId).toBeUndefined();
      expect(slice.selectedMapRegionIds).toBeUndefined();
      expect(slice.aggregationLevel).toBe(AGGREGATION_LEVELS.NATIONAL);
    }
  });

  test("the region-type default is the country's finest non-derived level", () => {
    // Not a hardcoded GSP any more: NL has provinces and no GSPs, and this function is the
    // reason NL needs no guard downstream. Resolved from the registry alone — it runs during
    // global state init, before the manifest can exist.
    expect(defaultCountryScopedState("GB").nationalAggregationLevel).toBe("gsp");
    expect(defaultCountryScopedState("NL").nationalAggregationLevel).toBe("province");
    expect(defaultCountryScopedState(UNCONFIGURED).nationalAggregationLevel).toBe("national");
  });

  test("agrees with defaultAggregationLevel, which the hook layer uses", () => {
    // Two entry points, one rule: if these drift, the app starts on one level and the map
    // draws another.
    for (const code of ["GB", "NL", UNCONFIGURED]) {
      expect(defaultCountryScopedState(code).nationalAggregationLevel).toBe(
        defaultAggregationLevel(getCountryConfig(code))
      );
    }
  });
});

describe("reading and writing through the current country", () => {
  test("reads the current country's slice", () => {
    expect(getCountryState("lng")).toBe(GB.map.center.lng);
    setCurrentCountry("NL");
    expect(getCountryState("lng")).toBe(NL.map.center.lng);
  });

  test("a write lands only on the current country", () => {
    setCountryState("zoom", 9);
    setCurrentCountry("NL");
    expect(getCountryState("zoom")).toBe(NL.map.zoom);
    expect(getCountryState("zoom", "GB")).toBe(9);
  });

  test("switching country and back restores the viewport and the selection", () => {
    setCountryState("lng", 1.5);
    setCountryState("lat", 51.5);
    setCountryState("zoom", 8.25);
    setCountryState("selectedMapRegionIds", ["citr_1"]);
    setCountryState("nationalAggregationLevel", "dno");

    setCurrentCountry("NL");
    // NL is untouched: it gets its own defaults, not GB's leftovers.
    expect(getCountryState("lng")).toBe(NL.map.center.lng);
    expect(getCountryState("selectedMapRegionIds")).toBeUndefined();
    setCountryState("selectedMapRegionIds", ["noord-holland"]);

    setCurrentCountry("GB");
    expect(getCountryState("lng")).toBe(1.5);
    expect(getCountryState("lat")).toBe(51.5);
    expect(getCountryState("zoom")).toBe(8.25);
    expect(getCountryState("selectedMapRegionIds")).toEqual(["citr_1"]);
    expect(getCountryState("nationalAggregationLevel")).toBe("dno");

    setCurrentCountry("NL");
    expect(getCountryState("selectedMapRegionIds")).toEqual(["noord-holland"]);
  });

  test("an explicitly cleared selection stays cleared rather than reverting to the default", () => {
    // `undefined` is a meaningful stored value here — "nothing selected" must not be read
    // as "never visited".
    setCountryState("selectedMapRegionIds", ["citr_1"]);
    setCountryState("selectedMapRegionIds", undefined);
    expect(getCountryState("selectedMapRegionIds")).toBeUndefined();
  });

  test("an unconfigured current country is usable rather than fatal", () => {
    setCurrentCountry(UNCONFIGURED);
    expect(getCountryState("zoom")).toBe(FALLBACK_MAP_DEFAULTS.zoom);
    setCountryState("zoom", 7);
    expect(getCountryState("zoom")).toBe(7);
  });
});

describe("useCountryState", () => {
  test("gives the same tuple shape as useGlobalState, scoped to the current country", () => {
    const { result } = renderHook(() => useCountryState("zoom"));
    expect(result.current[0]).toBe(GB.map.zoom);

    act(() => result.current[1](11));
    expect(result.current[0]).toBe(11);

    // Updater form: the map's move handler relies on it to avoid clobbering.
    act(() => result.current[1]((previous) => previous + 1));
    expect(result.current[0]).toBe(12);
  });

  test("re-renders onto the other country's slice when the country changes", () => {
    const { result } = renderHook(() => useCountryState("lng"));
    act(() => result.current[1](1.5));

    act(() => setCurrentCountry("NL"));
    expect(result.current[0]).toBe(NL.map.center.lng);

    act(() => setCurrentCountry("GB"));
    expect(result.current[0]).toBe(1.5);
  });
});

describe("the country cookie", () => {
  // `getValidatedCountry` runs once at module load, so each case needs a fresh copy of the
  // store. `isolateModules` + `require` keeps that copy out of the statically imported one
  // the tests above use.
  const loadCurrentCountry = (): string => {
    let country = "";
    jest.isolateModules(() => {
      const globalState = require("./globalState") as typeof import("./globalState");
      country = globalState.getGlobalState("currentCountry");
    });
    return country;
  };

  test("round-trips a configured country", () => {
    setCurrentCountry("NL");
    expect(getGlobalState("currentCountry")).toBe("NL");
    expect(loadCurrentCountry()).toBe("NL");
  });

  test("is normalised on write, so case cannot fork the state", () => {
    setCurrentCountry("nl");
    expect(loadCurrentCountry()).toBe("NL");
  });

  test("falls back when the cookie names a country this build has no config for", () => {
    // Exactly the getValidatedPLevels shape: a stale cookie cannot select something the
    // rest of the app does not know about.
    Cookies.set(CookieStorageKeys.COUNTRY, JSON.stringify(UNCONFIGURED));
    expect(loadCurrentCountry()).toBe(DEFAULT_COUNTRY_CODE);
  });

  test("falls back when the cookie holds a blank or non-country value", () => {
    Cookies.set(CookieStorageKeys.COUNTRY, JSON.stringify(""));
    expect(loadCurrentCountry()).toBe(DEFAULT_COUNTRY_CODE);
  });

  test("defaults when no cookie has been written", () => {
    expect(loadCurrentCountry()).toBe(DEFAULT_COUNTRY_CODE);
  });
});
