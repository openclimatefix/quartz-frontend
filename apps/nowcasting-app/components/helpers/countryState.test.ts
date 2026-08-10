/**
 * The country dimension of the global state.
 *
 * Two properties are worth protecting, and Phase 6 put them in tension:
 *
 * - the *restore* — switching country and switching back must put the map where the user
 *   left it, which is the whole reason these keys are country-keyed rather than reset;
 * - the *selection rule* — a region selection may **not** survive its country losing focus
 *   (contract §1, §7), which is what makes multi-region selection structurally
 *   single-country rather than a rule something has to police.
 *
 * So the viewport and the level restore and the selection does not. Everything else here —
 * the lazy per-country defaults, the fallback for an unconfigured country, the cookie round
 * trip, the enabled/focused invariants — is in service of those, plus the guarantee that a
 * GB-only user sees exactly what they saw before either split.
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
  normaliseCountryCode,
  normaliseCountryCodes
} from "./countryState";
import {
  focusAndSelectRegions,
  getCountryState,
  getCursorCadenceMinutes,
  getGlobalState,
  setCountryState,
  setEnabledCountries,
  setFocusedCountry,
  setGlobalState,
  toggleCountryEnabled,
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
  setGlobalState("focusedCountry", DEFAULT_COUNTRY_CODE);
  setGlobalState("enabledCountries", [DEFAULT_COUNTRY_CODE]);
  for (const key of COUNTRY_SCOPED_KEYS) {
    // Every country-keyed value is a `Record<string, …>`; the loop cannot express that the
    // key and the record's value type are correlated, so one member stands in for all.
    setGlobalState(key as "lng", {});
  }
};

beforeEach(resetState);
afterEach(() => {
  Cookies.remove(CookieStorageKeys.COUNTRY);
  Cookies.remove(CookieStorageKeys.ENABLED_COUNTRIES);
});

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

describe("reading and writing through the focused country", () => {
  test("reads the focused country's slice", () => {
    expect(getCountryState("lng")).toBe(GB.map.center.lng);
    setFocusedCountry("NL");
    expect(getCountryState("lng")).toBe(NL.map.center.lng);
  });

  test("a write lands only on the focused country", () => {
    setCountryState("zoom", 9);
    setFocusedCountry("NL");
    expect(getCountryState("zoom")).toBe(NL.map.zoom);
    expect(getCountryState("zoom", "GB")).toBe(9);
  });

  test("switching country and back restores the viewport and the level", () => {
    setCountryState("lng", 1.5);
    setCountryState("lat", 51.5);
    setCountryState("zoom", 8.25);
    setCountryState("nationalAggregationLevel", "dno");

    setFocusedCountry("NL");
    // NL is untouched: it gets its own defaults, not GB's leftovers.
    expect(getCountryState("lng")).toBe(NL.map.center.lng);
    expect(getCountryState("nationalAggregationLevel")).toBe("province");

    setFocusedCountry("GB");
    expect(getCountryState("lng")).toBe(1.5);
    expect(getCountryState("lat")).toBe(51.5);
    expect(getCountryState("zoom")).toBe(8.25);
    expect(getCountryState("nationalAggregationLevel")).toBe("dno");
  });

  // The Phase 6 exception to the restore above, and the reason `SELECTION_SCOPED_KEYS`
  // exists: a selection cannot outlive the country it belongs to (contract §1, §7). Where
  // you were looking survives; what you had picked does not.
  test("the selection does not survive the country losing focus", () => {
    setCountryState("selectedMapRegionIds", ["citr_1"]);
    setCountryState("clickedMapRegionIds", ["citr_1"]);
    setCountryState("clickedGspId", 12);

    setFocusedCountry("NL");
    setFocusedCountry("GB");

    expect(getCountryState("selectedMapRegionIds")).toBeUndefined();
    expect(getCountryState("clickedMapRegionIds")).toBeUndefined();
    expect(getCountryState("clickedGspId")).toBeUndefined();
  });

  test("each country's selection is cleared independently", () => {
    setCountryState("selectedMapRegionIds", ["citr_1"]);
    setFocusedCountry("NL");
    setCountryState("selectedMapRegionIds", ["noord-holland"]);

    // GB lost its selection on the way out; NL still holds the one just made.
    expect(getCountryState("selectedMapRegionIds", "GB")).toBeUndefined();
    expect(getCountryState("selectedMapRegionIds")).toEqual(["noord-holland"]);
  });

  test("an explicitly cleared selection stays cleared rather than reverting to the default", () => {
    // `undefined` is a meaningful stored value here — "nothing selected" must not be read
    // as "never visited".
    setCountryState("selectedMapRegionIds", ["citr_1"]);
    setCountryState("selectedMapRegionIds", undefined);
    expect(getCountryState("selectedMapRegionIds")).toBeUndefined();
  });

  test("an unconfigured focused country is usable rather than fatal", () => {
    setFocusedCountry(UNCONFIGURED);
    expect(getCountryState("zoom")).toBe(FALLBACK_MAP_DEFAULTS.zoom);
    setCountryState("zoom", 7);
    expect(getCountryState("zoom")).toBe(7);
  });
});

describe("useCountryState", () => {
  test("gives the same tuple shape as useGlobalState, scoped to the focused country", () => {
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

    act(() => setFocusedCountry("NL"));
    expect(result.current[0]).toBe(NL.map.center.lng);

    act(() => setFocusedCountry("GB"));
    expect(result.current[0]).toBe(1.5);
  });
});

/**
 * The Phase 6 split. Two invariants carry the whole model, and everything downstream — the
 * map fan-out, the cursor grid, the chart's single country — assumes both hold without
 * checking:
 *
 *   1. `enabledCountries` is never empty.
 *   2. `focusedCountry` is always a member of it.
 *
 * They are enforced in the writers rather than asserted at the call sites, so these are the
 * tests that stand between the model and a blank map.
 */
describe("enabled and focused", () => {
  const enabled = () => getGlobalState("enabledCountries");
  const focused = () => getGlobalState("focusedCountry");

  test("start as the default country alone, so a GB-only user sees what they always saw", () => {
    expect(enabled()).toEqual([DEFAULT_COUNTRY_CODE]);
    expect(focused()).toBe(DEFAULT_COUNTRY_CODE);
  });

  test("focusing a country that is not enabled enables it", () => {
    // One gesture, not two: you cannot read a chart for a country that is not on the map.
    setFocusedCountry("NL");
    expect(enabled()).toEqual(["GB", "NL"]);
    expect(focused()).toBe("NL");
  });

  test("focusing an already-enabled country does not reorder or re-add it", () => {
    setEnabledCountries(["GB", "NL"]);
    setFocusedCountry("NL");
    expect(enabled()).toEqual(["GB", "NL"]);
  });

  test("disabling the focused country hands focus to what is left", () => {
    setEnabledCountries(["GB", "NL"]);
    setFocusedCountry("NL");

    setEnabledCountries(["GB"]);
    expect(enabled()).toEqual(["GB"]);
    expect(focused()).toBe("GB");
  });

  test("disabling a country that is not focused leaves focus alone", () => {
    setEnabledCountries(["GB", "NL"]);
    expect(focused()).toBe("GB");

    setEnabledCountries(["GB"]);
    expect(focused()).toBe("GB");
  });

  test("the last enabled country cannot be disabled", () => {
    // An empty set is a blank map with no way back. The toggle disables the affordance too;
    // this is the backstop.
    setEnabledCountries([]);
    expect(enabled()).toEqual([DEFAULT_COUNTRY_CODE]);
    expect(focused()).toBe(DEFAULT_COUNTRY_CODE);
  });

  test("an unconfigured country cannot be enabled", () => {
    setEnabledCountries(["GB", UNCONFIGURED]);
    expect(enabled()).toEqual(["GB"]);
  });

  test("codes are normalised and de-duplicated, so case cannot fork the set", () => {
    setEnabledCountries(["gb", " nl ", "GB"]);
    expect(enabled()).toEqual(["GB", "NL"]);
  });

  test("a country dropped from the set loses its selection", () => {
    // Same rule as losing focus: its regions are no longer drawn, so a selection naming them
    // would come back stale on re-enable.
    setEnabledCountries(["GB", "NL"]);
    setCountryState("selectedMapRegionIds", ["noord-holland"], "NL");

    setEnabledCountries(["GB"]);
    expect(getCountryState("selectedMapRegionIds", "NL")).toBeUndefined();
  });

  test("a country dropped from the set keeps its viewport", () => {
    setEnabledCountries(["GB", "NL"]);
    setCountryState("zoom", 9, "NL");

    setEnabledCountries(["GB"]);
    expect(getCountryState("zoom", "NL")).toBe(9);
  });
});

/**
 * The map click path — contract §1, "selection sets focus".
 *
 * The reason this is one function rather than two calls at the call site is the ordering:
 * focusing clears the outgoing country's selection, so selecting *then* focusing silently
 * drops the click, on the cross-country case only. These tests are what stop that spelling
 * coming back.
 */
describe("focusAndSelectRegions", () => {
  test("focuses the region's country and selects it there", () => {
    focusAndSelectRegions("NL", ["noord-holland"]);

    expect(getGlobalState("focusedCountry")).toBe("NL");
    expect(getCountryState("selectedMapRegionIds", "NL")).toEqual(["noord-holland"]);
  });

  test("the selection survives the focus change that carried it", () => {
    // The trap, stated as a test: the country being focused is also the country whose
    // selection is being written, and focusing clears selections.
    setCountryState("selectedMapRegionIds", ["citr_1"], "GB");

    focusAndSelectRegions("NL", ["noord-holland"]);

    expect(getCountryState("selectedMapRegionIds", "NL")).toEqual(["noord-holland"]);
    // The country left behind loses its selection, per the same rule.
    expect(getCountryState("selectedMapRegionIds", "GB")).toBeUndefined();
  });

  test("enables the country if it was not drawn", () => {
    focusAndSelectRegions("NL", ["noord-holland"]);
    expect(getGlobalState("enabledCountries")).toEqual(["GB", "NL"]);
  });

  test("within one country it is a plain selection, clearing nothing", () => {
    focusAndSelectRegions("GB", ["citr_1"]);
    focusAndSelectRegions("GB", ["citr_1", "citr_2"]);

    expect(getCountryState("selectedMapRegionIds", "GB")).toEqual(["citr_1", "citr_2"]);
    expect(getGlobalState("focusedCountry")).toBe("GB");
  });

  test("normalises the country, so a lower-case feature property cannot fork the state", () => {
    focusAndSelectRegions("nl", ["noord-holland"]);

    expect(getGlobalState("focusedCountry")).toBe("NL");
    expect(getCountryState("selectedMapRegionIds", "NL")).toEqual(["noord-holland"]);
  });
});

describe("toggleCountryEnabled", () => {
  // "Draw this" and "read this" are two gestures in two controls: the header toggle owns the
  // set, the chart header owns focus. Enabling must not quietly do both.
  test("turning a country on draws it without moving focus", () => {
    toggleCountryEnabled("NL");
    expect(getGlobalState("enabledCountries")).toEqual(["GB", "NL"]);
    expect(getGlobalState("focusedCountry")).toBe("GB");
  });

  test("turning the focused country off moves focus and leaves the rest enabled", () => {
    setEnabledCountries(["GB", "NL"]);
    setFocusedCountry("NL");

    toggleCountryEnabled("NL");
    expect(getGlobalState("enabledCountries")).toEqual(["GB"]);
    expect(getGlobalState("focusedCountry")).toBe("GB");
  });

  test("turning the last country off does nothing", () => {
    toggleCountryEnabled("GB");
    expect(getGlobalState("enabledCountries")).toEqual(["GB"]);
    expect(getGlobalState("focusedCountry")).toBe("GB");
  });
});

describe("the country cookies", () => {
  // `getValidatedFocusedCountry` and `getValidatedEnabledCountries` run once at module load,
  // so each case needs a fresh copy of the store. `isolateModules` + `require` keeps that
  // copy out of the statically imported one the tests above use.
  const loadCountryState = (): { focused: string; enabled: string[] } => {
    let loaded = { focused: "", enabled: [] as string[] };
    jest.isolateModules(() => {
      const globalState = require("./globalState") as typeof import("./globalState");
      loaded = {
        focused: globalState.getGlobalState("focusedCountry"),
        enabled: globalState.getGlobalState("enabledCountries")
      };
    });
    return loaded;
  };

  const loadCurrentCountry = (): string => loadCountryState().focused;

  test("round-trips a configured country", () => {
    setFocusedCountry("NL");
    expect(getGlobalState("focusedCountry")).toBe("NL");
    expect(loadCurrentCountry()).toBe("NL");
  });

  test("is normalised on write, so case cannot fork the state", () => {
    setFocusedCountry("nl");
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

  test("round-trips the enabled set", () => {
    setEnabledCountries(["GB", "NL"]);
    expect(loadCountryState().enabled).toEqual(["GB", "NL"]);
  });

  test("both invariants survive the round trip, whatever the cookies say", () => {
    // The interesting case: two cookies written independently can disagree. A focused
    // country missing from the enabled set must be added rather than dropped — dropping it
    // would boot the chart to a country the user did not choose.
    Cookies.set(CookieStorageKeys.COUNTRY, JSON.stringify("NL"));
    Cookies.set(CookieStorageKeys.ENABLED_COUNTRIES, JSON.stringify(["GB"]));

    const loaded = loadCountryState();
    expect(loaded.focused).toBe("NL");
    expect(loaded.enabled).toContain("NL");
    expect(loaded.enabled).toContain("GB");
  });

  test("drops enabled countries this build has no config for", () => {
    Cookies.set(CookieStorageKeys.ENABLED_COUNTRIES, JSON.stringify(["GB", UNCONFIGURED]));
    expect(loadCountryState().enabled).toEqual(["GB"]);
  });

  test("falls back to the default set when the cookie leaves nothing usable", () => {
    // Blank entries are dropped rather than defaulted (see `normaliseCountryCodes`), so this
    // empties — and an empty enabled set is not a state the app may start in.
    Cookies.set(CookieStorageKeys.ENABLED_COUNTRIES, JSON.stringify([UNCONFIGURED, "", "  "]));
    expect(loadCountryState().enabled).toEqual([DEFAULT_COUNTRY_CODE]);
  });

  test("survives a cookie that is not a list at all", () => {
    Cookies.set(CookieStorageKeys.ENABLED_COUNTRIES, JSON.stringify("GB"));
    expect(loadCountryState().enabled).toEqual([DEFAULT_COUNTRY_CODE]);
  });
});

describe("normaliseCountryCodes", () => {
  test("upper-cases, trims and de-duplicates, keeping order", () => {
    expect(normaliseCountryCodes([" nl ", "gb", "NL"])).toEqual(["NL", "GB"]);
  });

  test("drops blanks rather than defaulting them, unlike the single-code normaliser", () => {
    // The one deliberate divergence: in a list `""` means nothing, and reading it as GB
    // would silently re-enable a country the user turned off.
    expect(normaliseCountryCodes(["", "   ", "NL"])).toEqual(["NL"]);
    expect(normaliseCountryCode("")).toBe(DEFAULT_COUNTRY_CODE);
  });

  test("ignores non-strings and a missing list", () => {
    expect(normaliseCountryCodes([1, null, undefined, {}, "GB"])).toEqual(["GB"]);
    expect(normaliseCountryCodes(null)).toEqual([]);
    expect(normaliseCountryCodes(undefined)).toEqual([]);
  });
});

// Track B's half of the same seam: the shared cursor runs on the finest *enabled* country's
// grid, so the writers above move it as well as the map. Kept here rather than beside the
// pure arithmetic in `lib/time/cursor.test.ts` because what is under test is the state
// transition, not the rounding.
describe("the cursor grid follows the enabled set", () => {
  const cursor = () => getGlobalState("selectedISOTime");

  test("is the finest enabled country's cadence", () => {
    expect(getCursorCadenceMinutes()).toBe(30);
    setEnabledCountries(["GB", "NL"]);
    expect(getCursorCadenceMinutes()).toBe(15);
  });

  test("re-snaps a cursor the grid has coarsened under", () => {
    setEnabledCountries(["GB", "NL"]);
    setGlobalState("selectedISOTime", "2026-08-10T16:15:00.000Z");

    // NL off: 16:15 is an instant GB never publishes, and every lookup at it comes back
    // empty — a blank map rather than an error.
    setEnabledCountries(["GB"]);
    expect(cursor()).toBe("2026-08-10T16:30:00.000Z");
  });

  test("leaves the cursor alone when the grid only refines", () => {
    setGlobalState("selectedISOTime", "2026-08-10T16:30:00.000Z");
    setEnabledCountries(["GB", "NL"]);
    expect(cursor()).toBe("2026-08-10T16:30:00.000Z");
  });

  test("re-snaps through the toggle too, not just the setter", () => {
    setEnabledCountries(["GB", "NL"]);
    setGlobalState("selectedISOTime", "2026-08-10T16:45:00.000Z");

    toggleCountryEnabled("NL");
    expect(cursor()).toBe("2026-08-10T17:00:00.000Z");
  });
});
