// The canonical internal model.
//
// Everything the app renders speaks these types, never the v1 wire shapes. Two
// conversions happen once, at the normalise boundary, and nowhere else:
//
//   kW -> MW        because MAX_NATIONAL_GENERATION_MW, Y_MAX_TICKS, the CSV export
//                   and every chart already assume MW.
//   columnar -> keyed  because the wire returns `times_utc[] + regions[].power_kW[]`,
//                   while the map and charts want a lookup by region name.
//
// Region identity is `regionName: string` throughout. `gspId: number` does not exist
// here by design: a numeric GSP id means nothing outside GB, a region name is portable.

import type { CountryConfig } from "../../config/countries";

/** An ISO-8601 instant in UTC, canonicalised to `YYYY-MM-DDTHH:mm:ssZ`. */
export type UtcInstant = string;

/** Power in MW. `null` means "no reading", which is distinct from a genuine 0. */
export type PowerMw = number | null;

/** Probabilistic levels keyed by the wire's plevel name (`"10"`, `"90"`, …), in MW. */
export type PlevelsMw = Record<string, PowerMw>;

/**
 * What to fetch. Explicit on every data hook — there is no ambient country inside the
 * fetching layer, so N-country fanout for the map costs nothing extra.
 */
export type Scope = {
  /** Country code as the API spells it, e.g. `"GB"`. */
  country: string;
  /** Generation source, e.g. `"solar"`. */
  source: string;
  /** Region type from the manifest, e.g. `"national"`, `"gsp"`, `"province"`. */
  regionType: string;
  /** A single region name within `regionType`. Omitted for whole-region-type queries. */
  region?: string;
};

/** Provenance shared by forecast responses. */
export type ForecastMeta = {
  modelName: string | null;
  modelVersion: string | null;
  lastUpdatedUtc: UtcInstant | null;
  latestInitUtc: UtcInstant | null;
};

/** One region, over time. From `/regions/{region}/forecast` and `/regions/{region}/generation`. */
export type TimeSeries = {
  regionName: string;
  capacityMw: number | null;
  values: TimeSeriesPoint[];
  /** Present on forecasts. */
  forecast?: ForecastMeta & { horizonMinutes: number | null };
  /** Present on generation. */
  observerName?: string | null;
};

export type TimeSeriesPoint = {
  timeUtc: UtcInstant;
  powerMw: PowerMw;
  plevelsMw?: PlevelsMw;
};

/** One region's values along a shared time axis. Index-aligned with `RegionSeries.times`. */
export type RegionSeriesValues = {
  regionName: string;
  capacityMw: number | null;
  powerMw: PowerMw[];
  plevelsMw?: Record<string, PowerMw[]>;
};

/**
 * Many regions over one time axis. From `/forecasts/period` and `/generation/period` —
 * the endpoints that delete the old incremental historic/future stitching.
 */
export type RegionSeries = {
  times: UtcInstant[];
  /** Keyed by region name, so a map lookup is O(1) rather than a scan. */
  regions: Record<string, RegionSeriesValues>;
  cacheUpdatedUtc: UtcInstant | null;
  forecast?: ForecastMeta;
  observerName?: string | null;
};

/** One region's value at a single instant. */
export type RegionSnapshotValue = {
  regionName: string;
  capacityMw: number | null;
  powerMw: PowerMw;
  plevelsMw?: PlevelsMw;
};

/**
 * Every region at one instant. From `/forecasts/snapshot` and `/generation/snapshot` —
 * one value per region name, replacing the O(n×m) joins over all-region payloads.
 */
export type RegionSnapshot = {
  timeUtc: UtcInstant;
  regions: Record<string, RegionSnapshotValue>;
  forecast?: ForecastMeta;
  observerName?: string | null;
};

export type ForecastModel = {
  name: string;
  label: string;
};

export type RegionTypeCapability = {
  /** Path segment, e.g. `"gsp"`. */
  type: string;
  label: string;
  /** Hierarchy depth. Sparse (0 national, 10 gsp) leaving room for GB's derived levels. */
  level: number;
  /** Models are per region type, not per country: GB national has 12, GB gsp has 3. */
  forecastModels: ForecastModel[];
  defaultModel: string | null;
};

export type GenerationSourceCapability = {
  /** The generation source this observer belongs to, e.g. `"solar"`. */
  source: string;
  /** Observer key used as the `observer` query param, e.g. `"pvlive_in_day"`, `"ned_nl"`. */
  name: string;
  label: string;
};

/**
 * A country as the API describes it — `GET /countries`. Everything here is dynamic and
 * must never be hardcoded; the static half (timezone, geo assets, map view) lives in
 * `config/countries.ts` instead.
 */
export type CountryCapability = {
  code: string;
  name: string;
  capacityMw: number | null;
  centroid: { lat: number; lng: number } | null;
  regionTypes: RegionTypeCapability[];
  generationSources: GenerationSourceCapability[];
};

/**
 * A country as the app sees it: the manifest's dynamic half, joined to the static registry
 * entry and to entitlement.
 *
 * `config` is optional and `configured` exists because `/countries` returns every country
 * the API serves, not just the ones this build knows about. A country with no registry
 * entry is still listed — discoverable and flagged — rather than dropped, so a backend that
 * adds a country ahead of the frontend degrades to "visible but not configurable".
 */
export type CountryListing = CountryCapability & {
  /** Static registry entry, or `undefined` when this build has none for `code`. */
  config?: CountryConfig;
  /** `true` when a registry entry exists — i.e. the country can actually be rendered. */
  configured: boolean;
  /** Intersection with the Auth0 country claim. Always `true` in dev mode. */
  entitled: boolean;
};

/** A region as the API describes it — `GET /regions`. */
export type Region = {
  /** The key used in every other response and as a path segment. */
  name: string;
  /** Human label. Raw codes like `citr_1` must not reach users. */
  label: string;
  regionType: string | null;
  capacityMw: number | null;
  centroid: { lat: number; lng: number } | null;
  metadata: Record<string, unknown>;
};
