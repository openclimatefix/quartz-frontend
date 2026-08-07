import { FeatureCollection } from "geojson";
import { NationalAggregation } from "../map/types";
import { DateTime } from "luxon";
import { getDeltaBucket } from "./utils";
import { DELTA_BUCKET } from "../../constant";
import { regionSnapshotState } from "../../hooks/data";
import type { RegionSnapshotState } from "../../hooks/data";
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

/**
 * Boundary geometry, loaded on first use rather than at module load.
 *
 * These seven files are ~36MB of GeoJSON between them. Importing them at the top of the
 * module made every consumer — including the pure value-join unit tests, which touch no
 * geometry at all — pay the parse. `require` inside a memoised getter keeps webpack's
 * static analysis (the path is still a literal) while deferring the parse to the first
 * caller that actually renders a map at that aggregation level.
 *
 * Phase 5 replaces these bundled files with fetches from `public/geo/{country}/`, at which
 * point this whole block goes away. It is deliberately the only place they are named.
 */
const memoise = <T>(load: () => T): (() => T) => {
  let value: T | undefined;
  return () => (value ??= load());
};
const gspShapeData = memoise(() => require("../../data/GSP_regions_4326_20250109.json"));
const dnoShapeData = memoise(() => require("../../data/dno_regions_lat_long_converted.json"));
const nationalShapeData = memoise(() => require("../../data/national_gsp_shape.json"));
const ngZones = memoise(() => require("../../data/ng_zones.json"));
const ngGSPZoneGroupings = memoise(() => require("../../data/ng_gsp_zone_groupings.json"));
const dnoGspGroupings = memoise(() => require("../../data/dno_gsp_groupings.json"));
const nationalGspZone = memoise(() => require("../../data/national_gsp_zone.json"));

/**
 * Rounds a DateTime down to the 6-hour boundary at or before it (00:00, 06:00, 12:00, 18:00 UTC).
 * Idempotent on a boundary.
 */
const floorToSixHoursUtc = (dt: DateTime<true>): DateTime<true> => {
  const utc = dt.toUTC();
  return utc.startOf("hour").minus({ hours: utc.hour % 6 }) as DateTime<true>;
};

/**
 * Rounds a DateTime up to the 6-hour boundary at or after it. Idempotent on a boundary.
 */
const ceilToSixHoursUtc = (dt: DateTime<true>): DateTime<true> => {
  const utc = dt.toUTC();
  const floored = floorToSixHoursUtc(utc);
  return (+floored === +utc ? floored : floored.plus({ hours: 6 })) as DateTime<true>;
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

/**
 * One day from now, rounded *up* to the nearest 6-hour interval in UTC.
 *
 * B2: two bugs here. The round-up added `hour % 6` rather than `(6 - hour % 6) % 6`, so 14:00
 * became 16:00 — not a 6-hour boundary at all — and the window ended before the data the caller
 * wanted. And, as above, it rounded in the viewer's local timezone against a UTC API.
 *
 * @returns {string} The furthest forecast timestamp in UTC as an ISO-8601 string.
 */
export const getFurthestForecastTimestamp = (): string => {
  return ceilToSixHoursUtc(DateTime.now().toUTC().plus({ days: 1 })).toISO();
};

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
 * `get30MinNow`, which is UTC throughout, and `RegionSeries.times` is canonicalised to
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
 * THE INTERIM NUMERIC-ID BRIDGE — the one place a numeric GSP id meets a region name.
 * ------------------------------------------------------------------------------------
 *
 * v1 keys every region by name (`citr_1`); the bundled GB boundary files key by the
 * uppercase GSP code in `properties.GSPs`, and the DNO / NG-zone grouping files key by
 * *numeric* `gsp_id`. `Region.metadata.gsp_id` is the only thing that reconciles them.
 *
 * Two distinct joins come out of it and they are not interchangeable:
 *  - `byGspCode`  — `lowercase(properties.GSPs) === Region.name`. Matches 345 of the 349
 *    bundled features whole-string (the four misses are `Off_NETS` placeholders with no
 *    region behind them), so no pipe-splitting and no fuzzy matching. This is what
 *    `config/countries.ts` describes as `joinTransform: "lowercase"`.
 *  - `byGspId`    — for the grouping files only, which Phase 5 regenerates by name.
 *
 * A numeric GSP id means nothing outside GB, which is why it exists here and nowhere in
 * `lib/domain`. Phase 5 replaces this function with name-keyed geometry and deletes it.
 */
export type RegionBridge = {
  byName: Map<string, Region>;
  byGspId: Map<number, Region>;
  byGspCode: (gspCode: unknown) => Region | undefined;
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
    byGspCode: (gspCode) =>
      typeof gspCode === "string" ? byName.get(gspCode.toLowerCase()) : undefined,
    gspIdFor: (regionName) => {
      const gspId = byName.get(regionName)?.metadata?.gsp_id;
      return typeof gspId === "number" ? gspId : undefined;
    }
  };
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
  groupings: Record<string, number[]>,
  bridge: RegionBridge
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

    for (const gspId of groupings[groupName]) {
      const region = bridge.byGspId.get(gspId);
      const value = region && values.get(region.name);
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

/** The grouping file and feature id property backing each client-side aggregation level. */
const AGGREGATION_GROUPINGS: Partial<
  Record<NationalAggregation, { groupings: () => Record<string, number[]>; idProperty: string }>
> = {
  [NationalAggregation.zone]: { groupings: ngGSPZoneGroupings, idProperty: "id" },
  [NationalAggregation.DNO]: { groupings: dnoGspGroupings, idProperty: "LongName" },
  [NationalAggregation.national]: { groupings: nationalGspZone, idProperty: "id" }
};

/**
 * The numeric GSP ids behind one named group at a client-side aggregation level (a DNO, an NG
 * zone, or the single national grouping) — `undefined` for `NationalAggregation.GSP` (no
 * grouping file backs it; a GSP multi-select is a bare id list the caller already has) or an
 * unrecognised group name.
 */
export const groupGspIds = (
  aggregation: NationalAggregation,
  groupName: string
): number[] | undefined => AGGREGATION_GROUPINGS[aggregation]?.groupings()[groupName];

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
 * 15 GSP ids appear in two DNO groupings each (see `rollUpRegionValues`'s comment, verbatim),
 * so a DNO-level series double-counts those ids' power at every timestamp it is used for. Do
 * not deduplicate, do not apportion: Phase 5 owns the fix once the groupings are regenerated
 * name-keyed, and `data.reconciliation.test.ts` is the tripwire that will flip from documenting
 * this bug to proving the fix.
 */
export const rollUpRegionSeries = (
  series: RegionSeries | undefined,
  gspIds: number[],
  bridge: RegionBridge,
  groupName: string
): TimeSeries | undefined => {
  if (!series) return undefined;

  const members: RegionSeriesValues[] = [];
  for (const gspId of gspIds) {
    const region = bridge.byGspId.get(gspId);
    const values = region && series.regions[region.name];
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
 * At GSP level the feature id is the numeric `gsp_id` (see `buildRegionBridge` for why, and
 * `use-update-map-state-on-click.ts` for who depends on it being numeric). Above it, the id
 * is the grouping name, which is already what the boundary files carry.
 */
export const buildMapFeatureStates = (
  aggregation: NationalAggregation,
  inputs: RegionValueInputs
): Map<string | number, MapFeatureState> => {
  const bridge = buildRegionBridge(inputs.regions);
  const byRegionName = buildRegionValues(inputs);

  const grouping = AGGREGATION_GROUPINGS[aggregation];
  if (grouping) {
    const rolled = rollUpRegionValues(byRegionName, grouping.groupings(), bridge);
    return new Map(rolled);
  }

  const byFeatureId = new Map<string | number, MapFeatureState>();
  byRegionName.forEach((value, regionName) => {
    const gspId = bridge.gspIdFor(regionName);
    if (gspId === undefined) return;
    byFeatureId.set(gspId, value);
  });
  return byFeatureId;
};

/**
 * The boundary geometry for an aggregation level, with `properties.id` set and **no values
 * on it**. Built once and handed to `setData` once; from then on only feature state moves.
 *
 * `properties.id` is what the source's `promoteId: "id"` promotes to the feature id, so it
 * has to agree with `buildMapFeatureStates` exactly. The four `Off_NETS` placeholder
 * features have no region behind them and get distinct negative ids — the v0 code gave all
 * four the same id (1000), which feature state cannot tolerate.
 */
export const buildMapGeometry = (
  aggregation: NationalAggregation,
  regions: Region[] | undefined
): FeatureCollection => {
  const grouping = AGGREGATION_GROUPINGS[aggregation];
  if (grouping) {
    const shapes = (
      aggregation === NationalAggregation.zone
        ? ngZones()
        : aggregation === NationalAggregation.DNO
        ? dnoShapeData()
        : nationalShapeData()
    ) as FeatureCollection;
    return {
      type: "FeatureCollection",
      features: shapes.features.map((feature) => {
        const zoneId = feature.properties?.[grouping.idProperty];
        return { ...feature, id: zoneId, properties: { ...feature.properties, id: zoneId } };
      })
    };
  }

  const bridge = buildRegionBridge(regions);
  let unmatched = 0;
  return {
    type: "FeatureCollection",
    features: (gspShapeData() as FeatureCollection).features.map((feature) => {
      const region = bridge.byGspCode(feature.properties?.GSPs);
      const gspId = region && bridge.gspIdFor(region.name);
      const id = gspId ?? --unmatched;
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
