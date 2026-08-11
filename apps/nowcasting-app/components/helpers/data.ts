import { FeatureCollection } from "geojson";
import { DateTime } from "luxon";
import { getDeltaBucket } from "./utils";
import { DELTA_BUCKET } from "../../constant";
import { regionSnapshotState } from "../../hooks/data";
import type { RegionSnapshotState } from "../../hooks/data";
import type { AggregationLevel } from "./aggregationLevels";
import type { GeoJoinTransform } from "../../config/countries";
import { geoAliasesFor, isLegacyRegion } from "../../config/geo-aliases";
import type {
  Region,
  RegionSeries,
  RegionSeriesValues,
  RegionSnapshot,
  RegionSnapshotValue,
  TimeSeries,
  TimeSeriesPoint,
  UtcInstant
} from "../../lib/domain/types";

/*
 * The `memoise`/`require` block that used to sit here is GONE (Phase 5, Track D).
 *
 * It lazily `require`d seven `data/*.json` files — ~36 MB of GeoJSON — and, because the
 * paths were static literals, webpack put every byte of them in the client bundle whether
 * or not a map ever rendered. That was the single largest line item in the 11.6 MB First
 * Load JS on `/` and in the 4.83 MB floor paid by pages that draw no map at all.
 *
 * Everything below is now **pure**: geometry arrives as an argument. `lib/geo/assets.ts`
 * fetches it from `public/geo/{country}/` and `hooks/data/use-map-geometry.ts` decides
 * which URLs a level needs. Nothing in this file loads anything, and no `data/*.json`
 * path is named here any more — deliberately, so the bundle cannot regress by accident.
 */

/**
 * Rounds a DateTime down to the 6-hour boundary at or before it (00:00, 06:00, 12:00, 18:00 UTC).
 * Idempotent on a boundary.
 */
const floorToSixHoursUtc = (dt: DateTime<true>): DateTime<true> => {
  const utc = dt.toUTC();
  return utc.startOf("hour").minus({ hours: utc.hour % 6 }) as DateTime<true>;
};

/**
 * Calculates the earliest forecast timestamp based on the default behavior of the Quartz Solar API.
 *
 * Two days prior to now, rounded *down* to the nearest 6-hour interval (00:00, 06:00, 12:00,
 * 18:00) in UTC, returned as an ISO-8601 UTC string.
 *
 * B2: this used to round in the *viewer's* local timezone before converting to UTC, so a viewer
 * in Los Angeles or Sydney asked the API for a different window than a viewer in the UK for the
 * same instant. The API works entirely in UTC, so the rounding does too now, and every viewer
 * gets the same window.
 *
 * @returns {string} The earliest forecast timestamp in UTC as an ISO-8601 string.
 *
 * @example
 * // Assuming the current time is 2025-12-07T14:45:00Z:
 * const result = getEarliestForecastTimestamp();
 * console.log(result); // Output: "2025-12-05T12:00:00.000Z"
 */
export const getEarliestForecastTimestamp = (): string => {
  return floorToSixHoursUtc(DateTime.now().toUTC().minus({ days: 2 })).toISO();
};

/*
 * `getFurthestForecastTimestamp` used to live here — now +1 day, ceiled to a 6-hour boundary.
 * Deleted in Phase 4 wave 4 along with `ceilToSixHoursUtc`, its only caller.
 *
 * Nothing should pin the END of a forecast window. The horizon is a per-country fact — GB
 * publishes 36 hours ahead, NL 48 — so a single constant truncates somebody, and this one
 * truncated everybody: `+1 day` was inherited verbatim from v0, where the variable was even
 * named `twoDaysFromNowLocal` while adding one day. B2 fixed its broken round-up and its
 * local-timezone rounding but left the horizon alone, so it shipped clipping 6–12h off GB and
 * 18–24h off NL. Take whatever the API has: omit `end_utc` and let the documented default
 * (+48h on `/regions/{region}/forecast`, +2 days on the `period` endpoints) apply.
 */

// =========================================================================================
// The v1 value pipeline
//
// The v0 pipeline that used to sit above this line is gone (Phase 4, wave 4): it rebuilt the
// whole FeatureCollection on every scrub tick and joined values onto it with a `.find()` per
// region, and its last caller went with `pages/index.tsx`'s `/gsp/forecast/all` fetch.
// `generateGeoJsonForecastData`, `mapGspFeatures`/`mapZoneFeatures`, `setFeatureObjectProps`
// and the `filterCompact*`/`getOldestTimestamp*` family are all deleted along with the
// `data.geo.test.ts` characterisation suite that pinned them.
//
// What replaces it:
//
//   geometry  — built once per aggregation level, never rebuilt when only the numbers move.
//   values    — an O(1) lookup by region name into `RegionSeries.regions`, applied to the map
//               with `setFeatureState` rather than `setData`.
//
// Everything here is MW: `normalise.ts` converted at the boundary, and nothing re-scales.
// =========================================================================================

/**
 * The Mapbox feature-state a map region carries. Values must be primitives — Mapbox stores
 * feature state as a flat JSON object and expressions read one key at a time.
 *
 * `dataState` is the whole point of the shape: `unpublished`, `no-data` and `value` are three
 * different things and the map renders each differently. A region with `power: 0` and
 * `dataState: "value"` is overnight solar and must show as a real (faint) value, not as a
 * hole — that is audit B8's bug class, fixed rather than pinned.
 */
export type MapFeatureState = {
  dataState: RegionSnapshotState;
  /** Forecast power in MW. Meaningless unless `dataState === "value"`. */
  power: number;
  /** Forecast power as a fraction of installed capacity, 0..1. */
  normalized: number;
  /** Installed capacity in MW. Known independently of whether a value has published. */
  capacity: number;
  /** Observed generation in MW, or `null` when it has not published / reported. */
  actual: number | null;
  /** Observed minus forecast, in MW. `0` when no delta is computable — see `hasDelta`. */
  delta: number;
  deltaBucket: number;
  /** False when the delta is not computable (future slot, or either side missing). */
  hasDelta: boolean;
  /** Human label — `Region.label` ("City Road"), never the raw `citr_1`. */
  label: string;
  /**
   * Whether this feature belongs to a client-side rollup level (GB's DNO / NG zone), whose MW
   * opacity bands are ten times the region-level ones.
   *
   * Not written here — the value join has no opinion about how a level is drawn. It is
   * stamped per country by `namespaceFeatureStates` (`components/map/country-features.ts`),
   * because since Phase 6 the map draws several countries at once and each picks its own
   * aggregation level: GB can be on its DNO rollup while NL is on provinces in the same
   * frame. `fillOpacityExpression` reads the flag rather than taking an argument, which is
   * what lets one paint expression serve both. Absent means false, i.e. region-level bands.
   */
  grouped?: boolean;
};

/** One region's joined values, before it is flattened to feature state. */
export type MapRegionValue = MapFeatureState & {
  /** Mapbox feature id: the numeric GSP id at GSP level, the grouping name above it. */
  featureId: string | number;
  /** The v1 key, e.g. `citr_1`. */
  regionName: string;
};

/**
 * Minute-precision UTC key, the join key between a selected time and a `RegionSeries` axis.
 *
 * Parsed as UTC when the string carries no offset. `selectedISOTime` is written by
 * `getCursorNow`, which is UTC throughout, and `RegionSeries.times` is canonicalised to
 * `…Z` — so both sides land on the same key without a timezone ever entering it.
 */
export const utcMinuteKey = (instant: string): string => {
  const parsed = DateTime.fromISO(instant, { zone: "utc" });
  return parsed.isValid ? parsed.toUTC().toFormat("yyyy-MM-dd'T'HH:mm") : "";
};

/**
 * Index of `targetTime` on a `RegionSeries` time axis, or `-1`.
 *
 * This is the whole of the join that `mapZoneFeatures` used to do with a full-array `.find()`
 * *inside* the per-region loop — hundreds of scans and thousands of redundant date formats per
 * render, for a predicate that never depended on the region.
 */
export const timeIndexOf = (times: UtcInstant[] | undefined, targetTime: string): number => {
  if (!times || times.length === 0 || !targetTime) return -1;
  const key = utcMinuteKey(targetTime);
  if (!key) return -1;
  for (let i = 0; i < times.length; i++) {
    if (times[i].slice(0, 16) === key) return i;
  }
  return -1;
};

/**
 * One slice of a `RegionSeries` as a `RegionSnapshot`, so `regionSnapshotState` applies to
 * period data verbatim rather than being reimplemented against a different shape.
 *
 * A region absent from `series.regions`, or whose axis has no entry at this index, stays
 * **absent** from the result — "has not published" is not "reported null", and neither is
 * zero. When `targetTime` falls outside the fetched window every region is absent, which is
 * the correct reading: nothing has been published for a slot we did not ask for.
 */
export const regionSeriesSnapshotAt = (
  series: RegionSeries | undefined,
  targetTime: string
): RegionSnapshot | undefined => {
  if (!series) return undefined;
  const index = timeIndexOf(series.times, targetTime);
  const regions: Record<string, RegionSnapshotValue> = {};
  if (index >= 0) {
    for (const name of Object.keys(series.regions)) {
      const values = series.regions[name];
      const powerMw = values.powerMw[index];
      if (powerMw === undefined) continue;
      regions[name] = { regionName: name, capacityMw: values.capacityMw, powerMw };
    }
  }
  return {
    timeUtc: series.times[index] ?? utcMinuteKey(targetTime),
    regions,
    forecast: series.forecast,
    observerName: series.observerName
  };
};

/**
 * ------------------------------------------------------------------------------------
 * THE NUMERIC-ID BRIDGE — the one place a numeric GSP id meets a region name.
 * ------------------------------------------------------------------------------------
 *
 * v1 keys every region by name (`citr_1`); GB's boundary file keys by the uppercase GSP
 * code in `properties.GSPs`. `Region.metadata.gsp_id` reconciles those to the numeric id
 * the rest of the app still speaks.
 *
 * **Phase 5 checked whether this could go, and it cannot.** The contract's condition was
 * "survives only if something other than the groupings still needs the id". Two things do:
 *
 *  - `use-update-map-state-on-click.ts` coerces the clicked feature's `properties.id` with
 *    `Number()` whenever the region type is `gsp`, and `gsp-pv-remix-chart` passes the
 *    resulting selection to `useGspAggregateData` as `number[]`. A name-keyed GSP feature
 *    id would silently become `NaN` there — no type error, no runtime throw, just an empty
 *    chart. So GSP-level Mapbox feature ids stay numeric.
 *  - `components/charts/delta-view/use-gsp-deltas.ts` publishes `gspId` on every
 *    `GspDeltaValue`.
 *
 * What DID go is `byGspCode`: the geometry join no longer goes through the bridge. It is
 * now a name join driven by the registry's `joinProperty`/`joinTransform` plus
 * `config/geo-aliases.ts`, which is what makes it work for a country that has no such
 * thing as a GSP. The remaining fields are id translation and nothing else.
 */
export type RegionBridge = {
  byName: Map<string, Region>;
  byGspId: Map<number, Region>;
  gspIdFor: (regionName: string) => number | undefined;
};

export const buildRegionBridge = (regions: Region[] | undefined): RegionBridge => {
  const byName = new Map<string, Region>();
  const byGspId = new Map<number, Region>();
  for (const region of regions ?? []) {
    byName.set(region.name, region);
    const gspId = region.metadata?.gsp_id;
    if (typeof gspId === "number") byGspId.set(gspId, region);
  }
  return {
    byName,
    byGspId,
    gspIdFor: (regionName) => {
      const gspId = byName.get(regionName)?.metadata?.gsp_id;
      return typeof gspId === "number" ? gspId : undefined;
    }
  };
};

/**
 * The Mapbox feature id a region is drawn under.
 *
 * The numeric `gsp_id` where the region has one, the region name where it does not (NL's
 * provinces, and any future country the API does not assign numeric ids to). See
 * `RegionBridge` above for who depends on the GSP case staying numeric.
 */
const featureIdFor = (region: Region): string | number => {
  const gspId = region.metadata?.gsp_id;
  return typeof gspId === "number" ? gspId : region.name;
};

const EMPTY_VALUE: MapFeatureState = {
  dataState: "unpublished",
  power: 0,
  normalized: 0,
  capacity: 0,
  actual: null,
  delta: 0,
  deltaBucket: DELTA_BUCKET.ZERO,
  hasDelta: false,
  label: ""
};

export type RegionValueInputs = {
  regions: Region[] | undefined;
  /** Forecast for every region of the type, over the whole window. Fetched once. */
  forecast: RegionSeries | undefined;
  /** Observed generation for every region, over the whole window. Fetched once. */
  generation: RegionSeries | undefined;
  /** The scrub position. Only this changes as the user drags — no refetch. */
  targetTime: string;
  /** "Now", rounded to the current half-hour slot. Slots at or after it have no delta. */
  timeNow: string;
};

/**
 * Join forecast, generation and capacity onto every region, keyed by region name.
 *
 * O(regions), not O(regions x times x regions): the time index is resolved once for each
 * series and `RegionSeries.regions` is a name-keyed record, so each region costs two hash
 * lookups. This is the function that replaces `mapGspFeatures`' 349 x ~350 scan.
 */
export const buildRegionValues = ({
  regions,
  forecast,
  generation,
  targetTime,
  timeNow
}: RegionValueInputs): Map<string, MapRegionValue> => {
  const forecastSnapshot = regionSeriesSnapshotAt(forecast, targetTime);
  const generationSnapshot = regionSeriesSnapshotAt(generation, targetTime);
  // A slot at or after "now" has no observation to compare against, so it has no delta —
  // it is not a delta of zero. `hasDelta` keeps the two apart; the v0 code collapsed them.
  const isFutureSlot = utcMinuteKey(targetTime) >= utcMinuteKey(timeNow);

  const values = new Map<string, MapRegionValue>();
  for (const region of regions ?? []) {
    const name = region.name;
    const forecastState = regionSnapshotState(forecastSnapshot, name);
    const generationState = regionSnapshotState(generationSnapshot, name);
    const forecastMw = forecastState === "value" ? forecastSnapshot!.regions[name].powerMw! : null;
    const generationMw =
      generationState === "value" ? generationSnapshot!.regions[name].powerMw! : null;
    const capacityMw = region.capacityMw ?? 0;

    // A genuine 0 is a delta input like any other. The v0 path treated `!currentYield.yield`
    // as "no reading" and forced the delta to 0, which silently erased every real overnight
    // and heavily-clipped reading. B8's bug class again.
    const hasDelta = !isFutureSlot && forecastMw !== null && generationMw !== null;
    const delta = hasDelta ? generationMw! - forecastMw! : 0;

    values.set(name, {
      featureId: name,
      regionName: name,
      dataState: forecastState,
      power: forecastMw ?? 0,
      normalized: forecastMw !== null && capacityMw > 0 ? forecastMw / capacityMw : 0,
      capacity: capacityMw,
      actual: generationMw,
      delta,
      deltaBucket: hasDelta ? getDeltaBucket(delta) : DELTA_BUCKET.ZERO,
      hasDelta,
      label: region.label
    });
  }
  return values;
};

/**
 * Sum region values into a client-side grouping (GB's DNO and NG-zone levels).
 *
 * **The DNO groupings are not a partition.** 15 GSP ids appear in two groupings each, so a
 * DNO total double-counts them — both the power and the capacity. That is a property of
 * `data/dno_gsp_groupings.json`, not of this function, and Phase 5 owns regenerating those
 * files by region name. It is left visible here rather than papered over: silently
 * de-duplicating would change published DNO numbers without anyone deciding to.
 *
 * A group's `dataState` is `"value"` when at least one member published, so a partially
 * filled newest slot renders as a (low) real total rather than a hole. `no-data` is reserved
 * for a group whose members all reported nothing.
 */
export const rollUpRegionValues = (
  values: Map<string, MapRegionValue>,
  groupings: Record<string, string[]>
): Map<string, MapRegionValue> => {
  const rolled = new Map<string, MapRegionValue>();
  for (const groupName of Object.keys(groupings)) {
    let power = 0;
    let capacity = 0;
    let actual: number | null = null;
    let delta = 0;
    let published = 0;
    let reportedNothing = 0;
    let hasDelta = false;

    for (const regionName of groupings[groupName]) {
      const value = values.get(regionName);
      if (!value) continue;
      capacity += value.capacity;
      if (value.dataState === "value") {
        published += 1;
        power += value.power;
      } else if (value.dataState === "no-data") {
        reportedNothing += 1;
      }
      if (value.actual !== null) actual = (actual ?? 0) + value.actual;
      if (value.hasDelta) {
        hasDelta = true;
        delta += value.delta;
      }
    }

    const dataState: RegionSnapshotState =
      published > 0 ? "value" : reportedNothing > 0 ? "no-data" : "unpublished";
    rolled.set(groupName, {
      ...EMPTY_VALUE,
      featureId: groupName,
      regionName: groupName,
      dataState,
      power,
      normalized: capacity > 0 ? power / capacity : 0,
      capacity,
      actual,
      delta,
      deltaBucket: hasDelta ? getDeltaBucket(delta) : DELTA_BUCKET.ZERO,
      hasDelta,
      label: groupName
    });
  }
  return rolled;
};

/**
 * The v1 region names behind one named group of a client-side aggregation level (a DNO, an
 * NG zone) — `undefined` for an unrecognised group name, or when the grouping file for the
 * level has not been fetched yet.
 *
 * Replaces `groupGspIds`, which resolved a `NationalAggregation` member against a table of
 * `require`d grouping files. Both halves of that are gone: the level is now an
 * `AggregationLevel` the caller already holds, and the grouping file is fetched by
 * `useMapGeometry`, so it arrives as an argument rather than being looked up. The values are
 * v1 region names (`"citr_1"`), not numeric gsp_ids — `scripts/build-geo-assets.mjs` re-keyed
 * the shipped assets in Phase 5, which is what removed the `RegionBridge` hop.
 *
 * `undefined` and `[]` are different: the first means "no such group / not loaded", the
 * second means "a group with no members", and only the first should disable a caller.
 */
export const groupRegionNames = (
  groupings: Record<string, string[]> | undefined,
  groupName: string
): string[] | undefined => groupings?.[groupName];

/**
 * Time-series equivalent of `rollUpRegionValues`: sums a `RegionSeries` across a grouping's
 * member GSP ids at EVERY timestamp, rather than at one instant — the primitive the GSP
 * chart's DNO / NG-zone / multi-select paths need to plot a rolled-up series instead of being
 * pinned to a single region.
 *
 * Follows `rollUpRegionValues`'s published/reportedNothing convention, applied once per
 * timestamp: a member present in `series.regions` with a number contributes to `published` and
 * to the sum; present with `null` contributes to `reportedNothing` alone; absent from
 * `series.regions` entirely (the region was never in the fetched payload) contributes to
 * neither. At each timestamp `powerMw` is the sum when at least one member published, and
 * `null` otherwise. Unlike `RegionSnapshot`, `TimeSeriesPoint` carries no third state to keep
 * "unplublished" distinct from "no-data" at a single instant — and it does not need to here,
 * because `use-format-chart-data.tsx`'s `fromTimeSeries` already drops every `null` point
 * regardless of which of the two it was, the same collapse the v0 dialect it replaces made.
 *
 * **The DNO groupings are not a partition — this function does NOT fix that, on purpose.**
 * 15 GSPs appear in two DNO groupings each (see `rollUpRegionValues`'s comment, verbatim), so
 * a DNO-level series double-counts their power at every timestamp it is used for. Phase 5
 * regenerated the grouping assets name-keyed and **deliberately reproduced the duplication**:
 * the question put to the API owner — whether a GSP feeding two licence areas is legitimately
 * counted in both, or whether its capacity should be apportioned — is still unanswered, so
 * there is no basis for choosing a number. Do not deduplicate, do not apportion.
 * `data.reconciliation.test.ts` keeps documenting the excess and must not be flipped to an
 * equality assertion until that answer arrives.
 */
export const rollUpRegionSeries = (
  series: RegionSeries | undefined,
  regionNames: string[],
  groupName: string
): TimeSeries | undefined => {
  if (!series) return undefined;

  const members: RegionSeriesValues[] = [];
  for (const regionName of regionNames) {
    const values = series.regions[regionName];
    if (values) members.push(values);
  }

  const capacityMw = members.reduce((total, member) => total + (member.capacityMw ?? 0), 0);

  const values: TimeSeriesPoint[] = series.times.map((timeUtc, index) => {
    let power = 0;
    let published = 0;
    for (const member of members) {
      const powerMw = member.powerMw[index];
      if (powerMw === undefined || powerMw === null) continue;
      published += 1;
      power += powerMw;
    }
    return { timeUtc, powerMw: published > 0 ? power : null };
  });

  return {
    regionName: groupName,
    capacityMw: members.length > 0 ? capacityMw : null,
    values,
    // `RegionSeries.forecast` (from `forecasts/period`) carries no per-region horizon; `null`
    // rather than omitting the field, matching `TimeSeries`'s "no reading" convention.
    forecast: series.forecast ? { ...series.forecast, horizonMinutes: null } : undefined,
    observerName: series.observerName
  };
};

/**
 * Region values keyed by **Mapbox feature id** for the given aggregation level.
 *
 * A derived level (GB's DNO / NG zone) keys by the grouping name, which is what the
 * derived level's own polygons carry in their join property. A non-derived level keys by
 * `featureIdFor` — the numeric `gsp_id` where there is one, the region name otherwise.
 *
 * **A `LEGACY_REGIONS` region never gets a feature state.** It has no polygon in the
 * definitive boundary file by definition, so a state keyed on it could only ever land on
 * somebody else's ground; skipping it here means `applyFeatureStates` cannot paint one by
 * accident if a future asset rebuild introduces a colliding key. Groupings exclude them
 * already (`scripts/build-geo-assets.mjs` reports them as "regions in no group"), so the
 * derived path needs no equivalent filter.
 */
export const buildMapFeatureStates = (
  level: AggregationLevel | undefined,
  inputs: RegionValueInputs,
  options: { groupings?: Record<string, string[]>; country?: string | null } = {}
): Map<string | number, MapFeatureState> => {
  const byRegionName = buildRegionValues(inputs);

  if (level?.derived) {
    // No grouping file yet means no rollup is computable — an empty map, not a map of
    // zeroes. The map draws its polygons unstyled until the asset lands.
    return new Map<string | number, MapFeatureState>(
      rollUpRegionValues(byRegionName, options.groupings ?? {})
    );
  }

  const byFeatureId = new Map<string | number, MapFeatureState>();
  for (const region of inputs.regions ?? []) {
    if (isLegacyRegion(options.country, region.name)) continue;
    const value = byRegionName.get(region.name);
    if (!value) continue;
    byFeatureId.set(featureIdFor(region), value);
  }
  return byFeatureId;
};

/** The registry's join transform, applied to the GeoJSON feature's key. */
const applyJoinTransform = (value: string, transform: GeoJoinTransform | undefined): string =>
  transform === "lowercase"
    ? value.toLowerCase()
    : transform === "uppercase"
    ? value.toUpperCase()
    : value;

export type MapGeometryInputs = {
  level: AggregationLevel;
  /** The fetched boundary file for this level. Never loaded here — see the note at the top. */
  shapes: FeatureCollection;
  /** Name-keyed grouping file. Derived levels only; ignored otherwise. */
  groupings?: Record<string, string[]>;
  regions: Region[] | undefined;
  /** GeoJSON property carrying the region key, from the registry's `GeoLayerConfig`. */
  joinProperty: string;
  joinTransform?: GeoJoinTransform;
  /**
   * Country code, for the alias and legacy tables. Not in the contract's signature; added
   * because `geoAliasesFor`/`isLegacyRegion` are country-keyed and there is nothing else in
   * these arguments that identifies the country.
   */
  country?: string | null;
};

/**
 * The boundary geometry for an aggregation level, with `properties.id` set and **no values
 * on it**. Built once and handed to `setData` once; from then on only feature state moves.
 *
 * `properties.id` is what the source's `promoteId: "id"` promotes to the feature id, so it
 * has to agree with `buildMapFeatureStates` exactly.
 *
 * **The region -> feature mapping is not 1:1 in either direction, and this must not assume
 * it is.**
 *  - One region can draw several features. GB's 362 GSP polygons carry only 335 distinct
 *    keys because a multi-part GSP is legitimately several polygons; and `geoAliasesFor`
 *    can return two feature keys for one region where the API and the boundary file spell
 *    a real region differently. Both cases resolve the same way — several features share
 *    one Mapbox id, and one `setFeatureState` paints all of them.
 *  - Several features have no region at all. `off_nets(unassigned)` (five features, a
 *    placeholder for unassigned network), `grem_p` and `seab1` are the current GB set. They
 *    get **distinct negative ids** so feature state can never collide: the v0 code gave
 *    every unmatched feature the same id (1000), which feature state cannot tolerate.
 *  - A `LEGACY_REGIONS` region draws nothing. It is left out of the join index entirely
 *    rather than being allowed to match: the API serves it only for backward compatibility,
 *    the NESO file does not model it, and drawing it would paint the same ground twice.
 */
export const buildMapGeometry = ({
  level,
  shapes,
  groupings,
  regions,
  joinProperty,
  joinTransform,
  country
}: MapGeometryInputs): FeatureCollection => {
  if (level.derived) {
    // A derived level's polygons ARE its groups: the join property already holds the
    // grouping name (`"UKPN (East)"`, `"NE Scotland"`), so the id is read straight off the
    // feature. `groupings` is not consulted here — it decides the *values*, not the shapes,
    // and a group with no polygon simply has nowhere to draw.
    return {
      type: "FeatureCollection",
      features: shapes.features.map((feature) => {
        const id = feature.properties?.[joinProperty];
        return { ...feature, id, properties: { ...feature.properties, id } };
      })
    };
  }

  const byFeatureKey = new Map<string, Region>();
  for (const region of regions ?? []) {
    if (isLegacyRegion(country, region.name)) continue;
    for (const key of geoAliasesFor(country, region.name)) byFeatureKey.set(key, region);
  }

  let unmatched = 0;
  return {
    type: "FeatureCollection",
    features: shapes.features.map((feature) => {
      const raw = feature.properties?.[joinProperty];
      const key = typeof raw === "string" ? applyJoinTransform(raw, joinTransform) : undefined;
      const region = key === undefined ? undefined : byFeatureKey.get(key);
      const id = region ? featureIdFor(region) : --unmatched;
      return {
        ...feature,
        id,
        properties: {
          ...feature.properties,
          id,
          regionName: region?.name ?? "",
          gspDisplayName: region?.label ?? ""
        }
      };
    })
  };
};
