import * as queries from "../../lib/api/v1/queries";
import type {
  GenerationPeriodWindow,
  GenerationSnapshotOptions,
  GenerationWindow
} from "../../lib/api/v1/queries";
import {
  normaliseGeneration,
  normaliseGenerationMatrix,
  normaliseGenerationSnapshot
} from "../../lib/domain/normalise";
import type { RegionSeries, RegionSnapshot, Scope, TimeSeries } from "../../lib/domain/types";
import { useApiQuery, type DataResult } from "./query";
import { isFetchableScope, toRegionScope } from "./scope";

/**
 * Observed-generation hooks. Same rules as the forecast family: one hook per endpoint,
 * explicit `Scope`, SWR's own record back.
 *
 * **Observers are per country and there may be one of them.** GB has two
 * (`pvlive_in_day`, `pvlive_day_after`), which is where the two-line GENERATION vs
 * GENERATION_UPDATED chart comes from; NL has exactly one (`ned_nl`). That chart is
 * therefore GB-specific and its series must be driven off `useGenerationSources(scope)`
 * from the manifest — never off a hardcoded pair of observer names, and never off an
 * assumption that index 1 exists.
 *
 * Omitting `observer` lets the API pick the country's default, which is the right thing for
 * a single-observer country and the wrong thing for a two-line chart. Pass it explicitly
 * whenever the identity of the series matters.
 */

/**
 * `/{country}/{source}/regions/{region}/generation` — one region's observed generation over
 * time. The region comes from `scope.region`; a national scope needs none.
 */
export const useRegionGeneration = (
  scope: Scope | null | undefined,
  window: GenerationWindow = {}
): DataResult<TimeSeries> => {
  const regionScope = toRegionScope(scope);
  return useApiQuery(
    regionScope === null ? null : queries.generation(regionScope, window),
    normaliseGeneration
  );
};

/** The national chart's generation line(s). `useRegionGeneration` named for its caller. */
export const useNationalGeneration = (
  scope: Scope | null | undefined,
  window: GenerationWindow = {}
): DataResult<TimeSeries> => useRegionGeneration(scope, window);

/**
 * `/{country}/{source}/generation/period` — every region of `scope.regionType` over one
 * shared time axis. Cache-backed, so a cold 503 is possible and is retried silently; the
 * forecast and generation caches warm independently, so one can be cold while the other is
 * not.
 */
export const useGenerationPeriod = (
  scope: Scope | null | undefined,
  window: GenerationPeriodWindow = {}
): DataResult<RegionSeries> =>
  useApiQuery(
    isFetchableScope(scope) ? queries.generationPeriod(scope, window) : null,
    normaliseGenerationMatrix
  );

/**
 * `/{country}/{source}/generation/snapshot` — one observed value per region at one instant.
 *
 * This is the endpoint where the absent/null/zero distinction is not hypothetical: the
 * newest slot publishes region by region and can be read mid-fill (127 of 336 regions in a
 * recorded fixture, complete 11 minutes later). Regions still to publish are **absent from
 * the payload**, not present with `null`. "Not published yet", "no data" and "zero" are three
 * different things and must render differently. See `regionSnapshotState`.
 */
export const useGenerationSnapshot = (
  scope: Scope | null | undefined,
  options: GenerationSnapshotOptions = {}
): DataResult<RegionSnapshot> =>
  useApiQuery(
    isFetchableScope(scope) ? queries.generationSnapshot(scope, options) : null,
    normaliseGenerationSnapshot
  );
