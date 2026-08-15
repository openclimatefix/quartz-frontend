// The v1 wire shape -> canonical domain model boundary. See `./types.ts` for the target
// shapes and the rationale for the two conversions that happen here and nowhere else:
// kW -> MW, and columnar -> keyed. Pure functions only — no fetching, no React, no SWR.

import { components } from "../api/v1/schema";
import { toUtcInstant, toUtcInstantOrNull } from "./time";
import {
  CountryCapability,
  ForecastModel,
  GenerationSourceCapability,
  PlevelsMw,
  PowerMw,
  Region,
  RegionSeries,
  RegionSeriesValues,
  RegionSnapshot,
  RegionSnapshotValue,
  RegionTypeCapability,
  TimeSeries,
  TimeSeriesPoint
} from "./types";

type CountryDetail = components["schemas"]["CountryDetail"];
type RegionDetail = components["schemas"]["RegionDetail"];
type ForecastResponse = components["schemas"]["ForecastResponse"];
type GenerationResponse = components["schemas"]["GenerationResponse"];
type RegionForecastMatrix = components["schemas"]["RegionForecastMatrix"];
type RegionGenerationMatrix = components["schemas"]["RegionGenerationMatrix"];
type ForecastSnapshot = components["schemas"]["ForecastSnapshot"];
type GenerationSnapshot = components["schemas"]["GenerationSnapshot"];

// --- kW -> MW -------------------------------------------------------------------------

/**
 * kW -> MW, preserving the null/undefined vs. genuine-0 distinction.
 *
 * `null / 1000 === 0` is exactly the bug B8 in the Phase 1 audit: a missing reading
 * silently became a plotted zero. A nullish check (not a truthiness check) is the only
 * way to keep a real `0 kW` overnight reading alive while still mapping "no data" to
 * `null` rather than `NaN` (which is what `undefined / 1000` produces).
 */
const kwToMw = (kw: number | null | undefined): PowerMw =>
  kw === null || kw === undefined ? null : kw / 1000;

/**
 * Strips v1's `p` prefix from a plevel key: `p10` -> `10`, `p2` -> `2`.
 *
 * Anchored and requiring a digit after the `p`, so it only ever removes the wire's prefix and
 * could not eat the first character of some other key shape.
 */
const PLEVEL_PREFIX = /^p(?=\d)/;

/**
 * The canonical plevel key for a wire key. Used by **both** plevel normalisers below.
 *
 * Shared rather than written twice on purpose: `plevels_kW` appears in three schemas
 * (`ForecastValue`, `RegionForecast`, `RegionForecastValue`) and each has its own normaliser
 * here. Two of them keying the same field differently is the trap that produced the original
 * bug one level up, and it would be invisible until an endpoint that currently returns an empty
 * plevels object started returning a populated one.
 */
const plevelKey = (wireKey: string): string => wireKey.replace(PLEVEL_PREFIX, "");

/**
 * **The wire says `p10`; the canonical model says `10`** — see `PlevelsMw`, which documents the
 * key as "the wire's plevel name" and means the bare level. This is where the two are reconciled,
 * and it was missing: keys went through untouched, so every consumer looked up a key that was
 * never there.
 *
 * It failed silently in both places that read them, because both are written to tolerate a
 * partial payload — an absent band is a legitimate state (`getAvailablePLevels` filters to the
 * pairs actually present, and the CSV writes `null` for a missing one), so "every band absent"
 * looked exactly like "this forecast has no plevels" rather than like a bug. The chart drew no
 * confidence bands however they were toggled, and the CSV's p-level columns came out empty.
 *
 * The unit tests could not catch it: they build `plevelsMw` by hand in the shape the consumers
 * assume, so they agreed with each other about a spelling neither had checked against a real
 * payload. `normalise.fixtures.test.ts` is where that gap is now closed, against the captured
 * `gb-national-forecast.json`.
 *
 * Both spellings are accepted rather than only the current one: a bare-numeric key passes
 * through unchanged, so this stays correct if the API drops the prefix later.
 *
 * As `kwToMw` otherwise — `undefined` in -> `undefined` out, so an absent `plevels_kW` stays
 * absent rather than becoming `{}`.
 */
const normalisePlevels = (
  plevels: Record<string, number> | null | undefined
): PlevelsMw | undefined => {
  if (plevels === null || plevels === undefined) return undefined;
  const out: PlevelsMw = {};
  for (const [key, value] of Object.entries(plevels)) {
    out[plevelKey(key)] = kwToMw(value);
  }
  return out;
};

// --- array alignment (matrix shapes) --------------------------------------------------

/**
 * `times_utc[]` and a region's `power_kW[]` (or a plevel array) are index-aligned by
 * contract. Reality can still violate that contract, so this is defensive:
 *
 *  - shorter than `length`: pad the tail with `null` ("no reading" for those instants) —
 *    the rest of the region's data is still usable, so we don't want to discard it.
 *  - longer than `length`: truncate to `length`. A response returning more values than
 *    timestamps is a backend contract violation, but throwing here would take down an
 *    entire page (map + every chart on it) over one bad region in one payload; silently
 *    dropping the unaddressable tail values is the safer failure mode. This is a
 *    deliberate choice, not an oversight — see the length-mismatch tests below.
 */
const alignToLength = (values: number[], length: number): (number | null)[] => {
  if (values.length === length) return values;
  if (values.length < length) {
    return [...values, ...new Array<null>(length - values.length).fill(null)];
  }
  return values.slice(0, length);
};

const alignAndConvert = (values: number[], length: number): PowerMw[] =>
  alignToLength(values, length).map(kwToMw);

/**
 * The matrix shape's plevels: one array per level rather than one number.
 *
 * Keyed through `plevelKey` like the scalar case, so `RegionSeries` and `TimeSeries` agree on
 * what a plevel is called. Every recorded matrix payload currently carries `plevels_kW: {}` —
 * GSP forecasts publish no bands — so nothing is reading these yet and the alignment below is
 * untested against real values. That is exactly why the key rule is shared rather than
 * reimplemented: the day the endpoint starts populating them, it must not be a second
 * discovery of the same bug.
 */
const alignPlevels = (
  plevels: Record<string, number[]> | null | undefined,
  length: number
): Record<string, PowerMw[]> | undefined => {
  if (plevels === null || plevels === undefined) return undefined;
  const out: Record<string, PowerMw[]> = {};
  for (const [key, values] of Object.entries(plevels)) {
    out[plevelKey(key)] = alignAndConvert(values, length);
  }
  return out;
};

// --- /countries -------------------------------------------------------------------------

export const normaliseCountries = (countries: CountryDetail[]): CountryCapability[] =>
  countries.map(normaliseCountry);

const normaliseCountry = (country: CountryDetail): CountryCapability => ({
  code: country.country,
  name: country.name,
  capacityMw: kwToMw(country.capacity_kW),
  centroid: country.centroid ?? null,
  regionTypes: (country.region_types ?? []).map(normaliseRegionType),
  generationSources: (country.generation_sources ?? []).map(normaliseGenerationSource)
});

const normaliseRegionType = (
  regionType: components["schemas"]["RegionType"]
): RegionTypeCapability => ({
  type: regionType.type,
  label: regionType.label,
  level: regionType.level,
  forecastModels: (regionType.forecast_models ?? []).map(normaliseForecastModel),
  defaultModel: regionType.default_model ?? null
});

const normaliseForecastModel = (model: components["schemas"]["ForecastModel"]): ForecastModel => ({
  name: model.name,
  label: model.label
});

const normaliseGenerationSource = (
  source: components["schemas"]["GenerationSource"]
): GenerationSourceCapability => ({
  source: source.source,
  name: source.name,
  label: source.label
});

// --- /regions -----------------------------------------------------------------------

export const normaliseRegions = (regions: RegionDetail[]): Region[] => regions.map(normaliseRegion);

/**
 * `metadata.full_name` is the human label ("City Road" for `citr_1`); fall back to the
 * raw code `name` only when it is absent, so `Region.label` is always populated and a
 * raw code never reaches the UI unlabelled.
 */
const normaliseRegion = (region: RegionDetail): Region => {
  const fullName = region.metadata?.["full_name"];
  return {
    name: region.name,
    label: typeof fullName === "string" && fullName.length > 0 ? fullName : region.name,
    regionType: region.type ?? null,
    capacityMw: kwToMw(region.capacity_kW),
    centroid: region.centroid ?? null,
    metadata: region.metadata ?? {}
  };
};

// --- /regions/{region}/forecast and /generation --------------------------------------

export const normaliseForecast = (forecast: ForecastResponse): TimeSeries => ({
  regionName: forecast.region_name,
  capacityMw: kwToMw(forecast.capacity_kW),
  values: forecast.values.map(
    (value): TimeSeriesPoint => ({
      timeUtc: toUtcInstant(value.time_utc),
      powerMw: kwToMw(value.power_kW),
      plevelsMw: normalisePlevels(value.plevels_kW)
    })
  ),
  forecast: {
    modelName: forecast.model_name ?? null,
    modelVersion: forecast.model_version ?? null,
    lastUpdatedUtc: toUtcInstantOrNull(forecast.last_updated_utc),
    latestInitUtc: toUtcInstantOrNull(forecast.latest_init_utc),
    horizonMinutes: forecast.horizon_minutes ?? null
  }
});

export const normaliseGeneration = (generation: GenerationResponse): TimeSeries => ({
  regionName: generation.region_name,
  capacityMw: kwToMw(generation.capacity_kW),
  values: generation.values.map(
    (value): TimeSeriesPoint => ({
      timeUtc: toUtcInstant(value.time_utc),
      powerMw: kwToMw(value.power_kW)
    })
  ),
  observerName: generation.observer_name ?? null
});

// --- /forecasts/period and /generation/period -----------------------------------------

/**
 * Builds `RegionSeries.regions` from the wire's `RegionForecast[]`/`RegionGeneration[]`.
 *
 * Duplicate `region_name`s in one response: the keyed shape can only hold one entry per
 * name. This assigns in array order, so a later duplicate overwrites an earlier one
 * (last-wins) — a deliberate, documented choice rather than a silent data loss, and
 * covered by a test below.
 */
const keyByRegionName = <T extends { region_name: string }, V>(
  regions: T[],
  toValue: (region: T) => V
): Record<string, V> => {
  const out: Record<string, V> = {};
  for (const region of regions) {
    out[region.region_name] = toValue(region);
  }
  return out;
};

export const normaliseForecastMatrix = (matrix: RegionForecastMatrix): RegionSeries => {
  const times = matrix.times_utc.map(toUtcInstant);
  return {
    times,
    regions: keyByRegionName(
      matrix.regions,
      (region): RegionSeriesValues => ({
        regionName: region.region_name,
        capacityMw: kwToMw(region.capacity_kW),
        powerMw: alignAndConvert(region.power_kW, times.length),
        plevelsMw: alignPlevels(region.plevels_kW, times.length)
      })
    ),
    cacheUpdatedUtc: toUtcInstantOrNull(matrix.cache_updated_utc),
    forecast: {
      modelName: matrix.model_name ?? null,
      modelVersion: matrix.model_version ?? null,
      lastUpdatedUtc: toUtcInstantOrNull(matrix.last_updated_utc),
      latestInitUtc: toUtcInstantOrNull(matrix.latest_init_utc)
    }
  };
};

export const normaliseGenerationMatrix = (matrix: RegionGenerationMatrix): RegionSeries => {
  const times = matrix.times_utc.map(toUtcInstant);
  return {
    times,
    regions: keyByRegionName(
      matrix.regions,
      (region): RegionSeriesValues => ({
        regionName: region.region_name,
        capacityMw: kwToMw(region.capacity_kW),
        powerMw: alignAndConvert(region.power_kW, times.length)
      })
    ),
    cacheUpdatedUtc: toUtcInstantOrNull(matrix.cache_updated_utc),
    observerName: matrix.observer_name ?? null
  };
};

// --- /forecasts/snapshot and /generation/snapshot -------------------------------------

export const normaliseForecastSnapshot = (snapshot: ForecastSnapshot): RegionSnapshot => ({
  timeUtc: toUtcInstant(snapshot.time_utc),
  regions: keyByRegionName(
    snapshot.values,
    (region): RegionSnapshotValue => ({
      regionName: region.region_name,
      capacityMw: kwToMw(region.capacity_kW),
      powerMw: kwToMw(region.power_kW),
      plevelsMw: normalisePlevels(region.plevels_kW)
    })
  ),
  forecast: {
    modelName: snapshot.model_name ?? null,
    modelVersion: snapshot.model_version ?? null,
    lastUpdatedUtc: toUtcInstantOrNull(snapshot.last_updated_utc),
    latestInitUtc: toUtcInstantOrNull(snapshot.latest_init_utc)
  }
});

export const normaliseGenerationSnapshot = (snapshot: GenerationSnapshot): RegionSnapshot => ({
  timeUtc: toUtcInstant(snapshot.time_utc),
  regions: keyByRegionName(
    snapshot.values,
    (region): RegionSnapshotValue => ({
      regionName: region.region_name,
      capacityMw: kwToMw(region.capacity_kW),
      powerMw: kwToMw(region.power_kW)
    })
  ),
  observerName: snapshot.observer_name ?? null
});

// Exported for the test file only, to exercise the length-mismatch and null-vs-zero
// edge cases directly rather than only through the composed normalise* functions above.
export const __test__ = { kwToMw, alignToLength, normalisePlevels };
