import { useCallback } from "react";
import { createGlobalState } from "react-hooks-global-state";
import { getDeltaBucketKeys, P_LEVEL_OPTIONS, SORT_BY, VIEWS } from "../../constant";
import {
  CookieStorageKeys,
  getArraySettingFromCookieStorage,
  getBooleanSettingFromCookieStorage,
  getSettingFromCookieStorage,
  setSettingInCookieStorage
} from "./cookieStorage";
import { LoadingState, NationalEndpointStates, SitesEndpointStates } from "../types";
import { ActiveUnit } from "../map/types";
import { DateTime } from "luxon";
import type { ChannelSelection } from "./satelliteLayer";
import { getCountryConfig } from "../../config/countries";
import {
  CountryKeyedState,
  CountryScopedKey,
  CountryScopedStateType,
  DEFAULT_COUNTRY_CODE,
  initialCountryKeyedState,
  normaliseCountryCode,
  readCountryScoped,
  writeCountryScoped
} from "./countryState";

export function get30MinNow(offsetMinutes = 0) {
  // this is a function to get the date of now, but rounded up to the closest 30 minutes
  let date = DateTime.utc();

  let minutes: number = date.minute;
  if (offsetMinutes !== 0) {
    minutes += offsetMinutes;
    date = date.set({ minute: minutes });
  }
  const jsDate = getNext30MinSlot(date.toJSDate());
  const newDate = DateTime.fromJSDate(jsDate);
  return newDate.toUTC().toISO() as string;
}
export function get30MinSlot(isoTime: Date) {
  if (isoTime.getMinutes() === 30) {
    return isoTime;
  } else if (isoTime.getMinutes() === 0) {
    return isoTime;
  } else if (isoTime.getMinutes() < 30) {
    isoTime.setHours(isoTime.getHours());
    isoTime.setMinutes(30, 0, 0); // Resets also seconds and milliseconds
  } else {
    isoTime.setHours(isoTime.getHours() + 1);
    isoTime.setMinutes(0, 0, 0); // Resets also seconds and milliseconds
  }
  return isoTime;
}
export function getNext30MinSlot(isoTime: Date) {
  if (isoTime.getMinutes() === 30) {
    isoTime.setHours(isoTime.getHours() + 1);
    isoTime.setMinutes(0, 0, 0); // Resets also seconds and milliseconds
  } else if (isoTime.getMinutes() < 30) {
    isoTime.setHours(isoTime.getHours());
    isoTime.setMinutes(30, 0, 0); // Resets also seconds and milliseconds
  } else {
    isoTime.setHours(isoTime.getHours() + 1);
    isoTime.setMinutes(0, 0, 0); // Resets also seconds and milliseconds
  }
  return isoTime;
}

/**
 * State that means the same thing whichever country you are looking at.
 *
 * The country-dependent half lives in `CountryKeyedState` (see `countryState.ts`) and is
 * reached through `useCountryState` rather than `useGlobalState`.
 */
export type FlatGlobalStateType = {
  /** The country the charts, headline figures and map are currently showing. */
  currentCountry: string;
  activeUnit: ActiveUnit;
  selectedISOTime: string;
  timeNow: string;
  intervals: any[];
  forecastCreationTime?: string;
  view: VIEWS;
  visibleLines: string[];
  selectedBuckets: string[];
  maps: mapboxgl.Map[];
  showSiteCount?: boolean;
  showNHourView?: boolean;
  showConstraints: boolean;
  dashboardMode: boolean;
  sortBy: SORT_BY;
  autoZoom: boolean;
  isPlaying: boolean;
  globalChartIsZooming: boolean;
  globalChartIsZoomed: boolean;
  globalZoomArea: { x1: string; x2: string };
  loadingState: LoadingState<NationalEndpointStates>;
  sitesLoadingState: LoadingState<SitesEndpointStates>;
  nHourForecast: number;
  pLevels: [number, number][];
  showCloudLayer: boolean;
  activeChannel: ChannelSelection;
  showPvLayer: boolean;
};

export type GlobalStateType = FlatGlobalStateType & CountryKeyedState;

const DEFAULT_P_LEVELS: [number, number][] = [[10, 90]];

// Drop any stored p-level pair that's no longer in P_LEVEL_OPTIONS, so a stale cookie from
// before the available p-levels changed can't select a pair the rest of the app doesn't know about.
const getValidatedPLevels = (): [number, number][] => {
  const stored = getArraySettingFromCookieStorage<[number, number]>(CookieStorageKeys.P_LEVELS);
  const validStored = stored?.filter(([lower, upper]) =>
    P_LEVEL_OPTIONS.some(([l, u]) => l === lower && u === upper)
  );
  return validStored?.length ? validStored : DEFAULT_P_LEVELS;
};

// Same shape of check as getValidatedPLevels above: a cookie written by an older build (or
// by hand) can name a country this build has no registry entry for, and an unconfigured
// current country has no boundaries to draw or timezone to render in. Fall back rather than
// trust it.
const getValidatedCountry = (): string => {
  const stored = getSettingFromCookieStorage<string>(CookieStorageKeys.COUNTRY);
  const code = normaliseCountryCode(stored);
  return getCountryConfig(code) ? code : DEFAULT_COUNTRY_CODE;
};

export const { useGlobalState, getGlobalState, setGlobalState } =
  createGlobalState<GlobalStateType>({
    ...initialCountryKeyedState(),
    currentCountry: getValidatedCountry(),
    activeUnit: ActiveUnit.percentage,
    selectedISOTime: get30MinNow(),
    timeNow: get30MinNow(),
    intervals: [],
    forecastCreationTime: undefined,
    view: VIEWS.FORECAST,
    visibleLines: getArraySettingFromCookieStorage(CookieStorageKeys.VISIBLE_LINES) || [
      "GENERATION",
      "GENERATION_UPDATED",
      "FORECAST",
      "N_HOUR_FORECAST",
      "SEASONAL_MEAN"
    ],
    selectedBuckets: getDeltaBucketKeys().filter((key) => key !== "ZERO"),
    maps: [],
    autoZoom: true,
    isPlaying: false,
    globalChartIsZooming: false,
    globalChartIsZoomed: false,
    globalZoomArea: { x1: "", x2: "" },
    showSiteCount: undefined,
    sortBy: SORT_BY.CAPACITY,
    showNHourView: getBooleanSettingFromCookieStorage(CookieStorageKeys.N_HOUR_VIEW, true),
    showConstraints: getBooleanSettingFromCookieStorage(CookieStorageKeys.CONSTRAINTS),
    dashboardMode: getBooleanSettingFromCookieStorage(CookieStorageKeys.DASHBOARD_MODE),
    loadingState: {
      initialLoadComplete: false,
      showMessage: false,
      message: "Loading data"
    },
    sitesLoadingState: {
      initialLoadComplete: false,
      showMessage: false,
      message: "Loading data"
    },
    nHourForecast: 4,
    pLevels: getValidatedPLevels(),
    showCloudLayer: false,
    activeChannel: "COMPOSITE_VISIBLE",
    showPvLayer: true
  });

/**
 * `useGlobalState` for a country-scoped key: reads and writes the current country's slice.
 *
 * The tuple is deliberately identical in shape to `useGlobalState`'s — value plus setter,
 * setter accepting a value or an updater — so a call site changes only in which hook it
 * names. Everything else about it, including the render granularity, is unchanged.
 */
export function useCountryState<K extends CountryScopedKey>(
  key: K
): [CountryScopedStateType[K], (update: CountryScopedUpdate<K>) => void] {
  const [currentCountry] = useGlobalState("currentCountry");
  // `GlobalStateType` is an intersection, and indexing one with a *generic* key collapses
  // to the union of every member's value type — TypeScript cannot carry the correlation
  // between `K` and the record's value through it. The cast restores what the mapped type
  // in `CountryKeyedState` already guarantees; `K` is still checked at the call site.
  const [record, setRecord] = useGlobalState(key) as unknown as CountryRecordTuple<K>;

  const value = readCountryScoped(record, currentCountry, key);

  const setValue = useCallback(
    (update: CountryScopedUpdate<K>) => {
      // Resolved against the record inside the updater rather than the `value` closed over
      // above, so two writes in one tick (the map writes lng/lat/zoom on every pan) cannot
      // clobber each other with a stale slice.
      setRecord((previous) => {
        const current = readCountryScoped(previous, currentCountry, key);
        const next = isUpdater(update) ? update(current) : update;
        return writeCountryScoped(previous, currentCountry, next);
      });
    },
    [setRecord, currentCountry, key]
  );

  return [value, setValue];
}

/** What `useGlobalState` returns for a country-keyed key, once `K` is pinned. See above. */
type CountryRecord<K extends CountryScopedKey> = Record<string, CountryScopedStateType[K]>;
type CountryRecordTuple<K extends CountryScopedKey> = [
  CountryRecord<K>,
  (update: CountryRecord<K> | ((previous: CountryRecord<K>) => CountryRecord<K>)) => void
];

type CountryScopedUpdate<K extends CountryScopedKey> =
  | CountryScopedStateType[K]
  | ((previous: CountryScopedStateType[K]) => CountryScopedStateType[K]);

/**
 * None of the country-scoped keys hold a function, so a callable update can only be an
 * updater — the ambiguity that makes `SetStateAction` awkward elsewhere does not arise.
 */
const isUpdater = <K extends CountryScopedKey>(
  update: CountryScopedUpdate<K>
): update is (previous: CountryScopedStateType[K]) => CountryScopedStateType[K] =>
  typeof update === "function";

/** Imperative read of a country-scoped key, outside React. Mirrors `getGlobalState`. */
export const getCountryState = <K extends CountryScopedKey>(
  key: K,
  country: string = getGlobalState("currentCountry")
): CountryScopedStateType[K] =>
  readCountryScoped(getGlobalState(key) as unknown as CountryRecord<K>, country, key);

/** Imperative write of a country-scoped key, outside React. Mirrors `setGlobalState`. */
export const setCountryState = <K extends CountryScopedKey>(
  key: K,
  value: CountryScopedStateType[K],
  country: string = getGlobalState("currentCountry")
): void => {
  const setRecord = ((update) =>
    setGlobalState(key, update as GlobalStateType[K])) as CountryRecordTuple<K>[1];
  setRecord((previous) => writeCountryScoped(previous, country, value));
};

/**
 * Switch the current country.
 *
 * Nothing country-scoped is cleared: every slice stays where it was, so switching back
 * restores the viewport and selection the user left behind. That is the whole reason these
 * keys are keyed rather than reset.
 */
export const setCurrentCountry = (code: string): void => {
  const country = normaliseCountryCode(code);
  setGlobalState("currentCountry", country);
  // Persisted here rather than in the toggle so any future caller gets persistence for
  // free; `getValidatedCountry` above is what makes a stale value harmless on read.
  setSettingInCookieStorage(CookieStorageKeys.COUNTRY, country);
};

export default useGlobalState;
