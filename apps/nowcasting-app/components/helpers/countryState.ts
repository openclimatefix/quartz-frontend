import { AGGREGATION_LEVELS } from "../../constant";
import { NationalAggregation } from "../map/types";
import { getCountryConfig } from "../../config/countries";

// The country dimension of the global state.
//
// Global state splits in two. Keys that mean the same thing wherever you are looking (the
// selected time, the view, which chart lines are visible) stay flat. Keys that only mean
// something *relative to a country* — where the map is pointed, which regions are selected,
// how far the data is aggregated — are stored once per country code, so switching country
// and switching back restores what you were looking at rather than resetting it. That
// restore is the whole point of keying rather than clearing.
//
// This module is deliberately React-free and synchronous: it is called during global state
// initialisation, before any hook can run. It reads the *static* registry only — nothing
// here may reach for the country manifest or the API, both of which are async.

/**
 * The default country until a cookie or the toggle says otherwise.
 *
 * Duplicated from `hooks/data/use-countries.ts` rather than imported: that module pulls in
 * SWR, Auth0 and the v1 client at module scope, and `globalState` is imported by nearly
 * every component in the app, so importing it here would drag the whole data layer into
 * every render tree and every test that touches state. `countryState.test.ts` pins the two
 * values equal so the duplication cannot drift.
 */
export const DEFAULT_COUNTRY_CODE = "GB";

/** Codes are canonicalised to uppercase so `gb` and `GB` cannot become two separate slices. */
export const normaliseCountryCode = (code: string | null | undefined): string =>
  typeof code === "string" && code.trim() !== "" ? code.trim().toUpperCase() : DEFAULT_COUNTRY_CODE;

/** State whose meaning is country-relative. Every key here is stored per country code. */
export type CountryScopedStateType = {
  clickedGspId?: number | string;
  clickedMapRegionIds?: string[];
  selectedMapRegionIds?: string[];
  clickedSiteGroupId?: string;
  /** Map viewport. Defaults come from the registry's `map` block, not from constants. */
  lng: number;
  lat: number;
  zoom: number;
  aggregationLevel: AGGREGATION_LEVELS;
  nationalAggregationLevel: NationalAggregation;
};

export type CountryScopedKey = keyof CountryScopedStateType;

/**
 * How the country-scoped keys are held in global state: one record per key, keyed by code.
 *
 * Per key rather than one `Record<code, slice>` on purpose — `react-hooks-global-state`
 * subscribes components per top-level key, so a map pan (which writes `lng`/`lat`/`zoom`
 * continuously) must not re-render every component that merely watches the region
 * selection. Keeping the keys at the top level preserves exactly the render granularity the
 * flat state had.
 */
export type CountryKeyedState = {
  [K in CountryScopedKey]-?: Record<string, CountryScopedStateType[K]>;
};

export const COUNTRY_SCOPED_KEYS = [
  "clickedGspId",
  "clickedMapRegionIds",
  "selectedMapRegionIds",
  "clickedSiteGroupId",
  "lng",
  "lat",
  "zoom",
  "aggregationLevel",
  "nationalAggregationLevel"
] as const satisfies readonly CountryScopedKey[];

/**
 * Viewport used for a country with no registry entry.
 *
 * `/countries` returns every country the API serves, so the manifest can legally name one
 * this build has no config for (see `getCountryConfig`). Such a country should never be
 * selectable — `useEntitledCountries` filters it out — but if one reaches the state layer it
 * must degrade to a usable map rather than `NaN` centre coordinates. Centred on western
 * Europe at a zoom that shows a whole country.
 */
export const FALLBACK_MAP_DEFAULTS = {
  center: { lng: 4.0, lat: 50.0 },
  zoom: 4
};

/**
 * The starting slice for one country, resolved lazily the first time that country is read.
 *
 * Lazy rather than seeded at init: it gives configured and unconfigured countries the same
 * code path, and means adding a registry entry needs no state migration.
 *
 * `nationalAggregationLevel` starts at `GSP` for every country because `NationalAggregation`
 * is still the GB-shaped enum — NL's equivalent level is `province`, which has no member.
 * Phase 4 replaces the enum with the derived list in `aggregationLevels.ts`, at which point
 * this becomes the country's outermost sub-national level.
 */
export const defaultCountryScopedState = (code: string): CountryScopedStateType => {
  const map = getCountryConfig(code)?.map ?? FALLBACK_MAP_DEFAULTS;
  return {
    clickedGspId: undefined,
    clickedMapRegionIds: undefined,
    selectedMapRegionIds: undefined,
    clickedSiteGroupId: undefined,
    lng: map.center.lng,
    lat: map.center.lat,
    zoom: map.zoom,
    aggregationLevel: AGGREGATION_LEVELS.NATIONAL,
    nationalAggregationLevel: NationalAggregation.GSP
  };
};

/** Every country-keyed record starts empty; slices fill in on first read. See above. */
export const initialCountryKeyedState = (): CountryKeyedState =>
  COUNTRY_SCOPED_KEYS.reduce((state, key) => {
    // Each key's record has a different value type, which one reduce cannot express.
    (state as Record<string, unknown>)[key] = {};
    return state;
  }, {} as CountryKeyedState);

/**
 * Read one country's value for one key, falling back to that country's lazy default.
 *
 * Uses `in` rather than a truthiness or `undefined` check because `undefined` is a
 * meaningful stored value for the selection keys — "nothing is selected" must not be
 * mistaken for "never visited, use the default".
 */
export const readCountryScoped = <K extends CountryScopedKey>(
  record: Record<string, CountryScopedStateType[K]>,
  code: string,
  key: K
): CountryScopedStateType[K] =>
  code in record
    ? record[code]
    : (defaultCountryScopedState(code)[key] as CountryScopedStateType[K]);

/** Write one country's value for one key, leaving every other country's slice untouched. */
export const writeCountryScoped = <K extends CountryScopedKey>(
  record: Record<string, CountryScopedStateType[K]>,
  code: string,
  value: CountryScopedStateType[K]
): Record<string, CountryScopedStateType[K]> => ({ ...record, [code]: value });
