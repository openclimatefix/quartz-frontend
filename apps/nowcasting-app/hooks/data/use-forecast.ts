import * as queries from "../../lib/api/v1/queries";
import type {
  ForecastSnapshotOptions,
  ForecastWindow,
  PeriodWindow
} from "../../lib/api/v1/queries";
import {
  normaliseForecast,
  normaliseForecastMatrix,
  normaliseForecastSnapshot
} from "../../lib/domain/normalise";
import { toUtcInstant } from "../../lib/domain/time";
import type {
  RegionSeries,
  RegionSnapshot,
  Scope,
  TimeSeries,
  UtcInstant
} from "../../lib/domain/types";
import { useApiQuery, type DataResult } from "./query";
import { isFetchableScope, toRegionScope } from "./scope";

/**
 * Forecast hooks. One per endpoint, each taking an explicit `Scope`, each returning SWR's
 * own record. See `docs/phase4-contract.md` for the full signature list.
 *
 * **Model selection is national-only**, confirmed against the code being replaced: every
 * `model_name` in `pages/index.tsx` is on `/solar/GB/national/forecast`, and no regional
 * view offers a model picker. That matters because `period` takes no `model` parameter
 * while `snapshot` does — so a regional *time series* is pinned to the region type's default
 * model, and only the map's snapshot can vary it. No view needs more than that today.
 *
 * **Models are per region type, not per country** (GB national 12, GB gsp 3; defaults
 * `blend_adjust` and `blend` respectively), so a model picker must read
 * `useRegionTypes(scope)` and filter on the region type it is picking for.
 *
 * None of these hooks defaults `model` from the manifest. Omitting the parameter makes the
 * API apply the region type's default server-side, which is the same answer without a
 * manifest round trip in the critical path — and without the cache key changing from
 * "no model" to "blend_adjust" mid-flight and fetching twice.
 */

/**
 * `/{country}/{source}/regions/{region}/forecast` — one region's forecast over time.
 *
 * The region comes from `scope.region`; a national scope needs none (see `resolveRegionName`).
 * `window.model` selects the forecast model, `window.horizonMinutes` pins the lead time (the
 * N-hour view), `window.creationLimit` asks for the forecast "as it was" at that time.
 */
export const useRegionForecast = (
  scope: Scope | null | undefined,
  window: ForecastWindow = {}
): DataResult<TimeSeries> => {
  const regionScope = toRegionScope(scope);
  return useApiQuery(
    regionScope === null ? null : queries.forecast(regionScope, window),
    normaliseForecast
  );
};

/**
 * The national chart's forecast. `useRegionForecast` under a name that says what it is for.
 *
 * National correctly uses this rather than `/forecasts/period`: `period` rejects
 * `region_type=national` with a 400 ("only sub-national region types are pre-warmed"), takes
 * no `model` parameter, and has no request storm to collapse for a single region.
 */
export const useNationalForecast = (
  scope: Scope | null | undefined,
  window: ForecastWindow = {}
): DataResult<TimeSeries> => useRegionForecast(scope, window);

/**
 * `/{country}/{source}/forecasts/period` — every region of `scope.regionType` over one shared
 * time axis, in a single request. This is what deletes the old incremental historic/future
 * stitching and its races.
 *
 * Served from a pre-warmed cache, so it can answer 503 while cold; retried silently.
 * Takes **no** `model` parameter — the region type's default is what is pre-warmed.
 * Rejects `region_type=national` with a 400; use `useNationalForecast` for that.
 */
export const useForecastPeriod = (
  scope: Scope | null | undefined,
  window: PeriodWindow = {}
): DataResult<RegionSeries> =>
  useApiQuery(
    isFetchableScope(scope) ? queries.forecastPeriod(scope, window) : null,
    normaliseForecastMatrix
  );

/**
 * `/{country}/{source}/forecasts/snapshot` — one forecast value per region at one instant.
 * The map's data source, replacing the O(n×m) joins over all-region payloads.
 *
 * Unlike `period`, this **does** take a model (`options.modelName`).
 *
 * Three region states are distinct in the result and must stay distinct in the UI:
 * a region **absent** from `data.regions` has not published yet, a region present with
 * `powerMw: null` has no reading, and `powerMw: 0` is a genuine zero. See
 * `regionSnapshotState` in `snapshot-state.ts`.
 */
export const useForecastSnapshot = (
  scope: Scope | null | undefined,
  options: ForecastSnapshotOptions = {}
): DataResult<RegionSnapshot> =>
  useApiQuery(
    isFetchableScope(scope) ? queries.forecastSnapshot(scope, options) : null,
    normaliseForecastSnapshot
  );

/**
 * `/{country}/{source}/regions/{region}/forecast/last-updated` — the freshness indicator.
 *
 * Returns a bare ISO instant, canonicalised the same way every other timestamp is.
 * The region comes from `scope.region` (national scopes need none), the optional `model`
 * asks about a specific model rather than the region type's default.
 */
export const useForecastLastUpdated = (
  scope: Scope | null | undefined,
  model?: string
): DataResult<UtcInstant> => {
  const regionScope = toRegionScope(scope);
  return useApiQuery(
    regionScope === null ? null : queries.forecastLastUpdated(regionScope, model),
    toUtcInstant
  );
};
