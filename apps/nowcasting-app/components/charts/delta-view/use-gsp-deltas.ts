import { useMemo } from "react";

import {
  useCurrentCountry,
  useForecastPeriod,
  useGenerationPeriod,
  useRegions
} from "../../../hooks/data";
import type { Scope } from "../../../lib/domain/types";
import type { PeriodWindow } from "../../../lib/api/v1/queries";
import useGlobalState from "../../helpers/globalState";
import {
  buildRegionBridge,
  buildRegionValues,
  getEarliestForecastTimestamp,
  getFurthestForecastTimestamp
} from "../../helpers/data";
import { DELTA_BUCKET } from "../../../constant";
import { GspDeltaValue } from "../../types";

/** GSP-level, matching the delta map — `period` 400s on `region_type=national`. */
const DELTA_REGION_TYPE = "gsp";
const SOURCE = "solar";

export type GspDeltasResult = {
  gspDeltas: Map<string, GspDeltaValue>;
  isLoading: boolean;
  error: unknown;
  /**
   * The scope and window this hook fetched with, so a caller feeding `useLoadingState` can
   * pass it the identical `regionScope`/`periodWindow` and have the indicator's own request
   * dedupe onto this hook's, per the contract's "same scope, window, model and observers"
   * rule.
   */
  scope: Scope;
  window: PeriodWindow;
};

/**
 * The GSP delta list and buckets, in one hook.
 *
 * Reuses the same seam Track A built for the delta map: `useForecastPeriod` +
 * `useGenerationPeriod` + `useRegions` over the GSP region type, and the same
 * `buildRegionValues` join that computes `hasDelta` / `delta` / `deltaBucket` for the map's
 * `MapFeatureState`. SWR dedupes on the cache key, so the map and this hook asking for the
 * same window is one request, not two — and the delta math (rounding, bucketing, the
 * "future slot has no delta" rule) is computed exactly once, here and in the map, never
 * twice with different rules.
 *
 * `hasDelta === false` (a future slot, or a region where either side has not published)
 * is **dropped from the map entirely** rather than folded into the zero bucket — the same
 * "draws nothing" treatment the delta map gives those regions. A genuine near-zero delta
 * still lands in `DELTA_BUCKET.ZERO`; an incomparable region does not land anywhere.
 */
export const useGspDeltas = (targetTime: string): GspDeltasResult => {
  const country = useCurrentCountry();
  const [timeNow] = useGlobalState("timeNow");

  const scope: Scope = useMemo(
    () => ({ country, source: SOURCE, regionType: DELTA_REGION_TYPE }),
    [country]
  );

  // Same window as `useMapRegionValues`: floored/ceiled to a 6-hour UTC boundary, so the SWR
  // key — and therefore the request — is shared with the delta map, not duplicated.
  const window = { start: getEarliestForecastTimestamp(), end: getFurthestForecastTimestamp() };

  const regions = useRegions(scope);
  const forecast = useForecastPeriod(scope, window);
  const generation = useGenerationPeriod(scope, window);

  const gspDeltas = useMemo(() => {
    const bridge = buildRegionBridge(regions.data);
    const values = buildRegionValues({
      regions: regions.data,
      forecast: forecast.data,
      generation: generation.data,
      targetTime,
      timeNow
    });

    const result = new Map<string, GspDeltaValue>();
    values.forEach((value, regionName) => {
      if (!value.hasDelta) return;

      const gspId = bridge.gspIdFor(regionName);
      if (gspId === undefined) return;

      const deltaBucket = value.deltaBucket as DELTA_BUCKET;
      const deltaNormalized = value.capacity > 0 ? value.delta / value.capacity : 0;
      const forecastMw = value.power;
      const currentYield = value.actual ?? 0;

      result.set(regionName, {
        gspId,
        gspRegion: value.label,
        gspInstalledCapacity: value.capacity,
        currentYield,
        forecast: forecastMw,
        delta: value.delta,
        deltaBucket,
        deltaBucketKey: DELTA_BUCKET[deltaBucket],
        deltaColor: "",
        dataKey: DELTA_BUCKET[deltaBucket],
        deltaPercentage: forecastMw !== 0 ? String((currentYield / forecastMw) * 100) : "0",
        deltaNormalized: String(deltaNormalized)
      });
    });
    return result;
  }, [regions.data, forecast.data, generation.data, targetTime, timeNow]);

  return {
    gspDeltas,
    isLoading: regions.isLoading || forecast.isLoading || generation.isLoading,
    error: forecast.error ?? generation.error ?? regions.error,
    scope,
    window
  };
};

export default useGspDeltas;
