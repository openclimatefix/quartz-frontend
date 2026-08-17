import { useCallback } from "react";
import { createGlobalState } from "react-hooks-global-state";
import { getDeltaBucketKeys, P_LEVEL_OPTIONS, SORT_BY } from "../../constant";
import {
  CookieStorageKeys,
  getArraySettingFromCookieStorage,
  getBooleanSettingFromCookieStorage,
  getSettingFromCookieStorage,
  setSettingInCookieStorage
} from "./cookieStorage";
import { LoadingState, SitesEndpointStates } from "../types";
import { ActiveUnit } from "../map/types";
import type { ChannelSelection } from "./satelliteLayer";
import { getCountryConfig } from "../../config/countries";
import { ComparisonSelection } from "./comparison";
import { ChartMode, ChartSplitPercent } from "../shell/geometry";
import { cursorCadenceMinutes, cursorNow, snapToCadence } from "../../lib/time/cursor";
import {
  CountryKeyedState,
  CountryScopedKey,
  CountryScopedStateType,
  DEFAULT_COUNTRY_CODE,
  DEFAULT_ENABLED_COUNTRY_CODES,
  SELECTION_SCOPED_KEYS,
  initialCountryKeyedState,
  normaliseCountryCode,
  normaliseCountryCodes,
  readCountryScoped,
  writeCountryScoped
} from "./countryState";

/**
 * The cursor grid: the focused country's cadence.
 *
 * Global state rather than a hook because the cursor is written from places React is not —
 * the 60-second interval in `use-and-update-selected-time`, the play button, the initial
 * state below. `lib/time/cursor.ts` holds the arithmetic and knows nothing about state; this
 * is the one line that joins the two.
 */
export const getCursorCadenceMinutes = (): number =>
  cursorCadenceMinutes(getGlobalState("focusedCountry"));

/**
 * Now, on the cursor grid — the slot currently filling.
 *
 * Replaces `get30MinNow`, which did exactly this at GB's cadence hardcoded. Naming the
 * cadence rather than assuming it is the single change that makes the shared cursor correct
 * on a country that does not publish every 30 minutes; on a GB-only session the value is
 * identical to what it always was.
 *
 * This is a cursor value, not a country's slot. Anything looking data up for one country
 * resolves it first with `slotForInstant(instant, country)`.
 */
export function getCursorNow(offsetMinutes = 0): string {
  return cursorNow(getCursorCadenceMinutes(), offsetMinutes);
}

/**
 * State that means the same thing whichever country you are looking at.
 *
 * The country-dependent half lives in `CountryKeyedState` (see `countryState.ts`) and is
 * reached through `useCountryState` rather than `useGlobalState`.
 */
/** The play button's step rate — a multiplier on the base 1-second-per-slot interval. */
export type PlaybackSpeed = 1 | 2 | 4;

export type FlatGlobalStateType = {
  /**
   * The country that owns the chart, the capacity figure, the level selector and the
   * number/date formatting. Always a member of `enabledCountries`.
   *
   * Read it through `useFocusedCountry()`, never straight off global state.
   */
  focusedCountry: string;
  /**
   * Every country that draws on the map. Never empty, always contains `focusedCountry`.
   *
   * Read it through `useEnabledCountries()`. Written only by `setEnabledCountries` and
   * `setFocusedCountry`, which between them keep both invariants.
   */
  enabledCountries: string[];
  /**
   * What the map's colour means: a comparison preset, or `null` for the plain forecast.
   *
   * This is what the dashboard switches on since Phase 6 — see `helpers/comparison.ts` and
   * contract §2. Write it through `setComparison`.
   */
  comparison: ComparisonSelection;
  activeUnit: ActiveUnit;
  selectedISOTime: string;
  timeNow: string;
  intervals: any[];
  forecastCreationTime?: string;
  /**
   * True only on `/sites` (`pages/sites.tsx` sets it on mount, clears it on unmount). The
   * dashboard route never writes it.
   *
   * Replaces `view: VIEWS` (Wave 4). `view`'s FORECAST/DELTA split is `comparison` now; its
   * SOLAR_SITES branch was the only one anything still read for a real decision, so it is
   * this one boolean rather than a three-member enum. Consumers that used to distinguish
   * FORECAST from DELTA get that from the pane that is actually mounted (`pages/index.tsx`
   * mounts one of `PvRemixChart`/`DeltaViewChart` on `comparison`), not from state.
   */
  isSitesChart: boolean;
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
  /**
   * The play button's speed, shared so its footer instance and `/sites`'s agree. Not
   * persisted — like `isPlaying`, it describes playback in progress rather than a durable
   * preference, and resetting to 1x on reload is the less surprising default.
   */
  playbackSpeed: PlaybackSpeed;
  globalChartIsZooming: boolean;
  globalChartIsZoomed: boolean;
  globalZoomArea: { x1: string; x2: string };
  sitesLoadingState: LoadingState<SitesEndpointStates>;
  nHourForecast: number;
  pLevels: [number, number][];
  showCloudLayer: boolean;
  activeChannel: ChannelSelection;
  showPvLayer: boolean;
  /**
   * The satellite fetch/decode pipeline's own status, lifted out of `map.tsx`'s local state by
   * the Phase 6 followup (Track I) so `map-layer-controls.tsx` — mounted in the consolidated
   * top-right panel, not inside `map.tsx` any more — can show the spinner and the error text
   * without `map.tsx` rendering anything itself. `map.tsx` still owns writing these; it is the
   * only thing holding the live Mapbox instance the fetch pipeline needs.
   */
  isSatelliteLoading: boolean;
  satelliteError: string | null;
  /**
   * The floating chart's per-mode size overrides — Phase 6 followup, OPEN 5. `CHART_SPLIT` in
   * `geometry.ts` is the seed each `ChartMode` starts from; once the user drags a mode to a
   * size, that size lives here and the seed is never read again for that mode. A mode absent
   * from this object has not been resized. Write it through `setChartSplitOverride`, never
   * directly — that is what keeps the cookie in step.
   */
  chartSplitOverrides: Partial<Record<ChartMode, ChartSplitPercent>>;
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
// focused country has no boundaries to draw or timezone to render in. Fall back rather than
// trust it.
const getValidatedFocusedCountry = (): string => {
  const stored = getSettingFromCookieStorage<string>(CookieStorageKeys.COUNTRY);
  const code = normaliseCountryCode(stored);
  return getCountryConfig(code) ? code : DEFAULT_COUNTRY_CODE;
};

/**
 * The enabled set from the cookie, forced to satisfy both invariants before anything reads it.
 *
 * Same shape of check again: drop anything this build has no registry entry for (no
 * boundaries to draw, no timezone to render in), fall back to the default set if that leaves
 * nothing, and make sure the focused country is in it. A cookie written by an older build,
 * by hand, or by a user whose entitlement has since been revoked can say anything; none of
 * it may reach the map.
 *
 * Entitlement is deliberately *not* applied here. The claim arrives asynchronously with the
 * Auth0 user and does not exist on the tenant yet (`lib/api/auth/entitlement.ts`), so
 * filtering on it at init would empty the set for every user in production today. The
 * entitlement gate lives where it can wait for the claim: the toggle, which will not enable
 * a country the user has no access to, and `useEnabledCountryListings`, which intersects
 * before fanning out.
 */
const getValidatedEnabledCountries = (focused: string): string[] => {
  const stored = getArraySettingFromCookieStorage<string>(CookieStorageKeys.ENABLED_COUNTRIES);
  const configured = normaliseCountryCodes(stored).filter((code) => getCountryConfig(code));
  const enabled = configured.length > 0 ? configured : [...DEFAULT_ENABLED_COUNTRY_CODES];
  return enabled.includes(focused) ? enabled : [focused, ...enabled];
};

const INITIAL_FOCUSED_COUNTRY = getValidatedFocusedCountry();
const INITIAL_ENABLED_COUNTRIES = getValidatedEnabledCountries(INITIAL_FOCUSED_COUNTRY);
// `getCursorNow` reads focus off global state, which does not exist yet at this point — so
// the initial cursor takes the same grid from the country being installed as focused.
const INITIAL_CURSOR = cursorNow(cursorCadenceMinutes(INITIAL_FOCUSED_COUNTRY));

export const { useGlobalState, getGlobalState, setGlobalState } =
  createGlobalState<GlobalStateType>({
    ...initialCountryKeyedState(),
    focusedCountry: INITIAL_FOCUSED_COUNTRY,
    enabledCountries: INITIAL_ENABLED_COUNTRIES,
    comparison: null,
    activeUnit: ActiveUnit.percentage,
    selectedISOTime: INITIAL_CURSOR,
    timeNow: INITIAL_CURSOR,
    intervals: [],
    forecastCreationTime: undefined,
    isSitesChart: false,
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
    playbackSpeed: 1,
    globalChartIsZooming: false,
    globalChartIsZoomed: false,
    globalZoomArea: { x1: "", x2: "" },
    showSiteCount: undefined,
    sortBy: SORT_BY.CAPACITY,
    showNHourView: getBooleanSettingFromCookieStorage(CookieStorageKeys.N_HOUR_VIEW, true),
    showConstraints: getBooleanSettingFromCookieStorage(CookieStorageKeys.CONSTRAINTS),
    dashboardMode: getBooleanSettingFromCookieStorage(CookieStorageKeys.DASHBOARD_MODE),
    sitesLoadingState: {
      initialLoadComplete: false,
      showMessage: false,
      message: "Loading data"
    },
    nHourForecast: 4,
    pLevels: getValidatedPLevels(),
    showCloudLayer: false,
    activeChannel: "COMPOSITE_VISIBLE",
    showPvLayer: true,
    isSatelliteLoading: false,
    satelliteError: null,
    chartSplitOverrides:
      getSettingFromCookieStorage<Partial<Record<ChartMode, ChartSplitPercent>>>(
        CookieStorageKeys.CHART_SPLIT_OVERRIDES
      ) || {}
  });

/**
 * `useGlobalState` for a country-scoped key: reads and writes the focused country's slice.
 *
 * The tuple is deliberately identical in shape to `useGlobalState`'s — value plus setter,
 * setter accepting a value or an updater — so a call site changes only in which hook it
 * names. Everything else about it, including the render granularity, is unchanged.
 */
export function useCountryState<K extends CountryScopedKey>(
  key: K
): [CountryScopedStateType[K], (update: CountryScopedUpdate<K>) => void] {
  const [focusedCountry] = useGlobalState("focusedCountry");
  // `GlobalStateType` is an intersection, and indexing one with a *generic* key collapses
  // to the union of every member's value type — TypeScript cannot carry the correlation
  // between `K` and the record's value through it. The cast restores what the mapped type
  // in `CountryKeyedState` already guarantees; `K` is still checked at the call site.
  const [record, setRecord] = useGlobalState(key) as unknown as CountryRecordTuple<K>;

  const value = readCountryScoped(record, focusedCountry, key);

  const setValue = useCallback(
    (update: CountryScopedUpdate<K>) => {
      // Resolved against the record inside the updater rather than the `value` closed over
      // above, so two writes in one tick (the map writes lng/lat/zoom on every pan) cannot
      // clobber each other with a stale slice.
      setRecord((previous) => {
        const current = readCountryScoped(previous, focusedCountry, key);
        const next = isUpdater(update) ? update(current) : update;
        return writeCountryScoped(previous, focusedCountry, next);
      });
    },
    [setRecord, focusedCountry, key]
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
  country: string = getGlobalState("focusedCountry")
): CountryScopedStateType[K] =>
  readCountryScoped(getGlobalState(key) as unknown as CountryRecord<K>, country, key);

/** Imperative write of a country-scoped key, outside React. Mirrors `setGlobalState`. */
export const setCountryState = <K extends CountryScopedKey>(
  key: K,
  value: CountryScopedStateType[K],
  country: string = getGlobalState("focusedCountry")
): void => {
  const setRecord = ((update) =>
    setGlobalState(key, update as GlobalStateType[K])) as CountryRecordTuple<K>[1];
  setRecord((previous) => writeCountryScoped(previous, country, value));
};

/**
 * Drop a country's region selection, leaving where it was looking alone.
 *
 * Called when a country stops being the chart's country — focus moving away, or the country
 * being disabled. See `SELECTION_SCOPED_KEYS` for why the viewport and level are exempt.
 */
const clearCountrySelection = (country: string): void => {
  for (const key of SELECTION_SCOPED_KEYS) {
    // Each key's record has a different value type, which one loop cannot express; the
    // written value is `undefined` for all three, which every one of them accepts.
    setCountryState(key as "selectedMapRegionIds", undefined, country);
  }
};

/**
 * Put the cursor back on the grid after the enabled set changed it.
 *
 * The cursor runs on the finest enabled country's cadence, so disabling the fine-grained
 * country coarsens the grid under a value already on it — NL switched off with the cursor at
 * 16:15 leaves an instant GB never publishes, and every lookup at it comes back empty.
 * Enabling one only ever refines the grid, which no existing value can be off, so this is a
 * no-op in that direction.
 *
 * `timeNow` is re-derived rather than snapped: it means "now", and the two 60-second timers
 * would otherwise leave it a slot stale until the next tick.
 */
const resnapCursorToGrid = (country: string | null | undefined): void => {
  const cadence = cursorCadenceMinutes(country);
  const selected = getGlobalState("selectedISOTime");
  if (selected) setGlobalState("selectedISOTime", snapToCadence(selected, cadence));
  setGlobalState("timeNow", cursorNow(cadence));
};

/** State plus cookie, so the two can never be written apart. */
const writeEnabledCountries = (codes: string[]): void => {
  setGlobalState("enabledCountries", codes);
  setSettingInCookieStorage(CookieStorageKeys.ENABLED_COUNTRIES, codes);
  // No resnap: the grid follows the *focused* country now, and enabling or disabling another
  // country does not change it. `setEnabledCountries` resnaps only in the case where dropping
  // a country also moves focus.
};

/**
 * Move focus — the chart, the capacity figure, the level selector, the formatting.
 *
 * Focusing a country enables it if it was not already: you cannot read a chart for a country
 * that is not on the map, and this is what makes "clicking a region focuses its country" a
 * single gesture rather than two.
 *
 * The *outgoing* country's region selection is cleared. Its viewport and aggregation level
 * are not — switching away and back still restores what the user was looking at, which is
 * why these keys are country-keyed in the first place.
 */
export const setFocusedCountry = (code: string): void => {
  const country = normaliseCountryCode(code);
  const previous = getGlobalState("focusedCountry");
  if (previous === country) return;

  clearCountrySelection(previous);

  const enabled = getGlobalState("enabledCountries");
  if (!enabled.includes(country)) writeEnabledCountries([...enabled, country]);

  setGlobalState("focusedCountry", country);
  // Persisted here rather than in the toggle so any future caller gets persistence for
  // free; `getValidatedFocusedCountry` above is what makes a stale value harmless on read.
  setSettingInCookieStorage(CookieStorageKeys.COUNTRY, country);
  // The cursor grid is this country's cadence, so focusing a country with a different one
  // moves the grid under the current cursor. Snapping up keeps the invariant every lookup
  // depends on — the cursor always sits on a slot the focused country actually publishes.
  resnapCursorToGrid(country);
};

/**
 * Replace the enabled set — which countries draw on the map.
 *
 * Enforces both invariants rather than trusting the caller:
 *
 * - **Never empty.** An empty set is a blank map with no way back, so a request to disable
 *   the last country is ignored. The toggle disables the affordance too; this is the
 *   backstop, not the message.
 * - **Focus stays inside the set.** Disabling the focused country hands focus to the first
 *   remaining member, with the same selection-clearing that any focus change does.
 *
 * Every country dropped from the set loses its region selection, for the same reason a
 * country losing focus does: its regions are no longer drawn, so a selection naming them
 * would come back stale on re-enable.
 *
 * Unconfigured codes are dropped, matching `getValidatedEnabledCountries`.
 */
export const setEnabledCountries = (codes: readonly string[]): void => {
  const next = normaliseCountryCodes(codes).filter((code) => getCountryConfig(code));
  if (next.length === 0) return;

  const previous = getGlobalState("enabledCountries");
  const focused = getGlobalState("focusedCountry");

  writeEnabledCountries(next);

  for (const code of previous) {
    if (!next.includes(code) && code !== focused) clearCountrySelection(code);
  }

  // Last, so the focus change sees the new set and does not re-add the country it is
  // leaving. `setFocusedCountry` clears the outgoing selection, which covers the case the
  // loop above skips.
  if (!next.includes(focused)) setFocusedCountry(next[0]);
};

/**
 * Turn one country on or off, keeping everything else enabled.
 *
 * The header toggle's whole write path, and it touches *only* the map's set. Enabling a
 * country deliberately does **not** focus it: enabling is "draw this", focusing is "read
 * this", and since Phase 6 those live in two different controls precisely so one gesture
 * cannot quietly do both. Disabling still moves focus when it has to — that is the
 * invariant, not a choice — and `setEnabledCountries` owns it.
 */
export const toggleCountryEnabled = (code: string): void => {
  const country = normaliseCountryCode(code);
  const enabled = getGlobalState("enabledCountries");
  if (enabled.includes(country)) {
    setEnabledCountries(enabled.filter((entry) => entry !== country));
  } else {
    setEnabledCountries([...enabled, country]);
  }
};

/**
 * Choose what the map's colour means — the dashboard's one mode axis since Phase 6 §2.
 *
 * `null` is the plain forecast, an id is a comparison preset. Both the map's fill and the
 * chart's extra series follow from it, and so does the chart's default split: a comparison
 * shrinks the chart because the difference is a *spatial* question.
 *
 * Through Wave 3 this also wrote `view` in lockstep, because a dozen components still read
 * it. Wave 4 migrated every one of them onto `comparison` (and, for the sites/dashboard
 * split, `isSitesChart`), so this is a plain `setGlobalState` again.
 */
export const setComparison = (id: ComparisonSelection): void => {
  // Installed capacity has no delta, so "Capacity" is not a unit a comparison can be shown in.
  // It used to fall through to megawatts, which put the map back in the state that started this
  // whole thread: a control reading one unit while the map painted another.
  //
  // Enforced here rather than in the toggle's click handler because this is the one chokepoint
  // every comparison change goes through — a deep link, restored state or any future caller
  // gets the invariant too, instead of it holding only for the path through the button.
  //
  // Percentage rather than megawatts: it is the delta scale that works for both countries (the
  // MW buckets leave 96% of GB's GSPs in the neutral bucket — see `DELTA_PERCENTAGE_EDGES`).
  //
  // Deliberately not restored on the way back to the forecast view. `activeUnit` is one shared
  // setting, and remembering what we switched away from means the unit can also change under
  // the user when they return — Brad's call: not worth the extra state.
  if (id !== null && getGlobalState("activeUnit") === ActiveUnit.capacity) {
    setGlobalState("activeUnit", ActiveUnit.percentage);
  }
  setGlobalState("comparison", id);
};

/**
 * Store, or clear, a mode's floating-chart size override.
 *
 * `split: null` clears the mode's entry rather than storing it — the reset affordance
 * (`chart-resize-handle.tsx`'s double-click/Enter) returns a mode to its `CHART_SPLIT` seed by
 * removing the override rather than writing the seed's numbers back as an override, so a later
 * change to the seed in `geometry.ts` still reaches a user who has reset.
 *
 * Persisted alongside `visibleLines` and `dashboardMode` — same cookie-plus-state pattern, so
 * "state and cookie can never be written apart" holds here too.
 */
export const setChartSplitOverride = (
  mode: ChartMode,
  split: ChartSplitPercent | null,
  { persist = true }: { persist?: boolean } = {}
): void => {
  const previous = getGlobalState("chartSplitOverrides");
  const next = { ...previous };
  if (split) {
    next[mode] = split;
  } else {
    delete next[mode];
  }
  setGlobalState("chartSplitOverrides", next);
  // `persist: false` is the in-drag frame — state moves, the cookie does not. A resize fires
  // one of these per animation frame, and `Cookies.set` is a `JSON.stringify` plus a
  // synchronous `document.cookie` write, so persisting each frame put ~60 cookie-jar writes a
  // second on the critical path of a direct manipulation. Only the size the gesture *ends* on
  // is worth remembering, and `use-resizable-chart-split` guarantees a `transient: false` call
  // at the end of every gesture — so "state and cookie can never be written apart" still holds
  // for every value a reload could observe.
  if (persist) setSettingInCookieStorage(CookieStorageKeys.CHART_SPLIT_OVERRIDES, next);
};

/**
 * Select regions, focusing the country they belong to. **The map click path.**
 *
 * Contract §1: "Selection sets focus. Clicking a region focuses its country." That is what
 * makes "multi-region selection is same-country only" structurally impossible to violate
 * rather than a rule something has to police — a selection is always made *through* focus.
 *
 * It exists as one function because the order is a trap. `setFocusedCountry` clears the
 * outgoing country's selection, so the obvious spelling
 *
 *     setSelectedMapRegionIds(ids);   // ← wiped a moment later
 *     setFocusedCountry(country);
 *
 * silently drops the click, on the cross-country case only, in a way that looks like a
 * missed event rather than an ordering bug. Focus first, then select, always.
 */
export const focusAndSelectRegions = (country: string, regionIds: string[]): void => {
  const code = normaliseCountryCode(country);
  setFocusedCountry(code);
  setCountryState("selectedMapRegionIds", regionIds, code);
};

export default useGlobalState;
