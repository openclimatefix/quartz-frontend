import type { paths } from "./schema";
import type { Scope } from "../../domain/types";
import { toUtcInstant } from "../../domain/time";
import { resolveSeriesWindow, type SeriesWindow } from "./series-window";

// Pure Scope -> request descriptor. No fetching, no React, no business rules about which
// window to request (the caller supplies it) — Phase 4's hooks build on top of this.
//
// Every function's descriptor is typed against `paths` (generated from v1-api.json), so a
// path or param-name change in the spec fails `tsc`, not a live request.

/**
 * The country/source/region path params (and the enum-valued query params like
 * `region_type`) are typed in `schema.d.ts` as narrow literal unions of the country codes
 * the spec currently documents, because openapi-typescript generates them straight from
 * the spec's current examples.
 * `Scope.country`/`Scope.source` are plain `string` — they come from `/countries` and
 * `/sources` at runtime, not from a compile-time-known set — so a real value can never
 * structurally satisfy those literals. `Widen` recursively relaxes every string-literal
 * leaf of a generated params type to `string`, keeping the rest of the shape (which
 * params exist, whether they're optional, arrays vs scalars) intact. That preserves the
 * thing we actually want type safety for — a typo'd or removed param/path fails to
 * compile — without demanding the impossible (a literal check on a runtime value).
 */
type Widen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
  ? Widen<U>[]
  : T extends object
  ? { [K in keyof T]: Widen<T[K]> }
  : T;

/** Every operation in this API is a GET; extract its params, defaulting to `{}` for the
 *  couple of endpoints (`/sources`, `/countries`) that take none. */
type OpParams<P extends keyof paths> = paths[P]["get"] extends { parameters: infer Params }
  ? Params
  : Record<string, never>;

/** Shaped so `client.GET(descriptor.path, { params: descriptor.params })` passes straight
 *  through — see `lib/api/v1/client.ts`. */
export type RequestDescriptor<P extends keyof paths> = {
  path: P;
  params: Widen<OpParams<P>>;
};

/** Drop keys whose value is `undefined`, so optional query params are omitted from the
 *  wire request rather than serialised as the literal string `"undefined"`. */
const omitUndefined = <T extends Record<string, unknown>>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

/** Normalise an optional datetime through `toUtcInstant`, passing `undefined` through
 *  unchanged (as opposed to `toUtcInstantOrNull`, which would turn it into `null` — and
 *  an explicit `null` is a value that still gets serialised, not omitted). */
const optionalUtcInstant = (value: Date | string | undefined): string | undefined =>
  value === undefined ? undefined : toUtcInstant(value);

type CountrySource = Pick<Scope, "country" | "source">;
type CountrySourceRegion = CountrySource & { region: string };

// ---- Discovery ------------------------------------------------------------------------

export const sources = (): RequestDescriptor<"/sources"> => ({
  path: "/sources",
  params: {}
});

export const countries = (): RequestDescriptor<"/countries"> => ({
  path: "/countries",
  params: {}
});

export const regionTypes = ({
  country,
  source
}: CountrySource): RequestDescriptor<"/{country}/{source}/region-types"> => ({
  path: "/{country}/{source}/region-types",
  params: { path: { country, source } }
});

export const generationSources = ({
  country,
  source
}: CountrySource): RequestDescriptor<"/{country}/{source}/generation-sources"> => ({
  path: "/{country}/{source}/generation-sources",
  params: { path: { country, source } }
});

export type RegionsFilter = {
  regionType?: string;
  parent?: string;
  name?: string;
};

export const regions = (
  { country, source }: CountrySource,
  filter: RegionsFilter = {}
): RequestDescriptor<"/{country}/{source}/regions"> => ({
  path: "/{country}/{source}/regions",
  params: {
    path: { country, source },
    query: omitUndefined({
      region_type: filter.regionType,
      parent: filter.parent,
      name: filter.name
    })
  }
});

export const region = ({
  country,
  source,
  region: regionName
}: CountrySourceRegion): RequestDescriptor<"/{country}/{source}/regions/{region}"> => ({
  path: "/{country}/{source}/regions/{region}",
  params: { path: { country, source, region: regionName } }
});

/**
 * `start_utc`/`end_utc` for a **region time-series** request, with the shared history default
 * applied. See `series-window.ts` for what it defaults and why the `period` endpoints below
 * deliberately do not use it.
 */
const seriesQuery = (window: SeriesWindow) => {
  const resolved = resolveSeriesWindow(window);
  return {
    start_utc: optionalUtcInstant(resolved.start),
    end_utc: optionalUtcInstant(resolved.end)
  };
};

// ---- Forecasts --------------------------------------------------------------------------

export type ForecastWindow = {
  start?: Date | string;
  end?: Date | string;
  /** Retrieve the forecast 'as it was' at this creation time. */
  creationLimit?: Date | string;
  horizonMinutes?: number;
  model?: string;
};

export const forecast = (
  { country, source, region: regionName }: CountrySourceRegion,
  window: ForecastWindow = {}
): RequestDescriptor<"/{country}/{source}/regions/{region}/forecast"> => ({
  path: "/{country}/{source}/regions/{region}/forecast",
  params: {
    path: { country, source, region: regionName },
    // `resolveSeriesWindow`, not the raw window: this endpoint defaults to **now → +48h**
    // server-side, so a caller passing nothing gets a forecast with no history. Defaulting here
    // rather than at each call site is what stops that being rediscovered — see
    // `series-window.ts`. An explicit `start` from the caller still wins.
    query: omitUndefined({
      ...seriesQuery(window),
      creation_limit_utc: optionalUtcInstant(window.creationLimit),
      horizon_minutes: window.horizonMinutes,
      model: window.model
    })
  }
});

export const forecastLastUpdated = (
  { country, source, region: regionName }: CountrySourceRegion,
  model?: string
): RequestDescriptor<"/{country}/{source}/regions/{region}/forecast/last-updated"> => ({
  path: "/{country}/{source}/regions/{region}/forecast/last-updated",
  params: {
    path: { country, source, region: regionName },
    query: omitUndefined({ model })
  }
});

export type ForecastSnapshotOptions = {
  modelName?: string;
  modelVersion?: string;
  time?: Date | string;
};

export const forecastSnapshot = (
  { country, source, regionType }: Scope,
  options: ForecastSnapshotOptions = {}
): RequestDescriptor<"/{country}/{source}/forecasts/snapshot"> => ({
  path: "/{country}/{source}/forecasts/snapshot",
  params: {
    path: { country, source },
    query: omitUndefined({
      region_type: regionType,
      model_name: options.modelName,
      model_version: options.modelVersion,
      time_utc: optionalUtcInstant(options.time)
    })
  }
});

/**
 * The `period` endpoints' window.
 *
 * **Deliberately not `SeriesWindow`, and deliberately not run through `resolveSeriesWindow`.**
 * These are served entirely from a cache pre-warmed on the API's own default window (±2 days,
 * one key per region), so sending our own start risks missing the warm path as well as
 * truncating the horizon. Every caller passes `{}` on purpose; see `use-map-region-values.ts`.
 */
export type PeriodWindow = {
  start?: Date | string;
  end?: Date | string;
  /** Limit to specific region names. `undefined`/omitted means every region of the type. */
  regionNames?: string[];
};

export const forecastPeriod = (
  { country, source, regionType }: Scope,
  window: PeriodWindow = {}
): RequestDescriptor<"/{country}/{source}/forecasts/period"> => ({
  path: "/{country}/{source}/forecasts/period",
  params: {
    path: { country, source },
    query: omitUndefined({
      region_type: regionType,
      start_utc: optionalUtcInstant(window.start),
      end_utc: optionalUtcInstant(window.end),
      // openapi-fetch@0.9.3's default querySerializer (node_modules/openapi-fetch/src/index.js,
      // serializeArrayParam) uses style "form" + explode: true for array-typed query params,
      // i.e. one repeated `region_names=a&region_names=b` — matching the spec's own example
      // (`?region_names=GSP1&region_names=GSP2`). No custom serializer needed.
      region_names: window.regionNames
    })
  }
});

// ---- Generation -------------------------------------------------------------------------

export type GenerationWindow = {
  observer?: string;
  start?: Date | string;
  end?: Date | string;
};

export const generation = (
  { country, source, region: regionName }: CountrySourceRegion,
  window: GenerationWindow = {}
): RequestDescriptor<"/{country}/{source}/regions/{region}/generation"> => ({
  path: "/{country}/{source}/regions/{region}/generation",
  params: {
    path: { country, source, region: regionName },
    // Same default, different server behaviour to correct for: this endpoint returns the last
    // 24h when given no `start`, where the forecast endpoint returns no past at all. One
    // resolver so the two series a chart plots together cover the same stretch of time.
    query: omitUndefined({
      observer: window.observer,
      ...seriesQuery(window)
    })
  }
});

export type GenerationSnapshotOptions = {
  observer?: string;
  time?: Date | string;
};

export const generationSnapshot = (
  { country, source, regionType }: Scope,
  options: GenerationSnapshotOptions = {}
): RequestDescriptor<"/{country}/{source}/generation/snapshot"> => ({
  path: "/{country}/{source}/generation/snapshot",
  params: {
    path: { country, source },
    query: omitUndefined({
      region_type: regionType,
      observer: options.observer,
      time_utc: optionalUtcInstant(options.time)
    })
  }
});

export type GenerationPeriodWindow = PeriodWindow & { observer?: string };

export const generationPeriod = (
  { country, source, regionType }: Scope,
  window: GenerationPeriodWindow = {}
): RequestDescriptor<"/{country}/{source}/generation/period"> => ({
  path: "/{country}/{source}/generation/period",
  params: {
    path: { country, source },
    query: omitUndefined({
      region_type: regionType,
      observer: window.observer,
      start_utc: optionalUtcInstant(window.start),
      end_utc: optionalUtcInstant(window.end),
      region_names: window.regionNames
    })
  }
});

// ---- Cache key --------------------------------------------------------------------------

/** Deep-sort object keys (arrays keep their element order — for `region_names` that order
 *  is part of the request, not incidental to how the caller happened to build the object)
 *  so two descriptors that mean the same request serialise identically regardless of the
 *  order their params were supplied in. */
const sortKeysDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
};

/**
 * A stable, deterministic SWR cache key for a request descriptor.
 *
 * `path` is the literal template (e.g. `/{country}/{source}/forecasts/period`), which by
 * itself would collide across countries — the actual country only appears inside
 * `params.path.country`. Including the (key-sorted) params in the key is what keeps
 * different countries, sources and windows from colliding.
 */
export const queryKey = <P extends keyof paths>(descriptor: RequestDescriptor<P>): string =>
  JSON.stringify({ path: descriptor.path, params: sortKeysDeep(descriptor.params) });
