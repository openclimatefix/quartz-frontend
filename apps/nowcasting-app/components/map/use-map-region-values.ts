import { useMemo } from "react";

import {
  useCurrentCountry,
  useForecastPeriod,
  useGenerationPeriod,
  useRegions
} from "../../hooks/data";
import type { Scope } from "../../lib/domain/types";
import useGlobalState from "../helpers/globalState";
import {
  buildMapFeatureStates,
  buildMapGeometry,
  getEarliestForecastTimestamp,
  getFurthestForecastTimestamp,
  type MapFeatureState
} from "../helpers/data";
import { NationalAggregation } from "./types";

/**
 * The map's value pipeline, in one hook.
 *
 * Three things it deliberately does *not* do, each of which was costing the old map a
 * measurable amount of the felt lag:
 *
 * 1. **It does not refetch when the user scrubs.** The window is `getEarliestForecastTimestamp`
 *    to `getFurthestForecastTimestamp`, both floored/ceiled to a 6-hour boundary, so the SWR
 *    key is stable for six hours and `selectedISOTime` never reaches the network. The v0
 *    `useGetGspForecast(selectedTime)` set `start == end == targetTime` and issued a fresh
 *    request on every tick of the scrubber.
 * 2. **It does not rebuild geometry when the numbers move.** `geometry` depends only on the
 *    aggregation level and the region list; values leave via `featureStates` and are applied
 *    with `setFeatureState`.
 * 3. **It does not flatten the three snapshot states.** See `MapFeatureState.dataState`.
 *
 * Every hook it calls is keyed, so the forecast map and the delta map calling this at the
 * same time is one set of requests, not two.
 */
export type MapRegionValues = {
  featureStates: Map<string | number, MapFeatureState>;
  geometry: GeoJSON.FeatureCollection;
  /** `{ published, expected, isPartial }` — a partial newest slot is normal, not a fault. */
  coverage: { published: number; expected: number; isPartial: boolean };
  /**
   * Total installed capacity in MW. Summed over the API's regions, which *are* a partition —
   * unlike GB's DNO groupings, where 15 GSP ids appear twice (see `rollUpRegionValues`).
   */
  nationalCapacityMw: number;
  isLoading: boolean;
  error: unknown;
};

/** The map is sub-national by definition; `period` 400s on `region_type=national`. */
const MAP_REGION_TYPE = "gsp";
const SOURCE = "solar";

export const useMapRegionValues = (
  aggregation: NationalAggregation,
  targetTime: string
): MapRegionValues => {
  const country = useCurrentCountry();
  const [timeNow] = useGlobalState("timeNow");

  const scope: Scope = useMemo(
    () => ({ country, source: SOURCE, regionType: MAP_REGION_TYPE }),
    [country]
  );

  // Recomputed per render but constant within a 6-hour boundary, so `queryKey` — which is
  // what SWR actually dedupes on — does not move while the user scrubs.
  const window = { start: getEarliestForecastTimestamp(), end: getFurthestForecastTimestamp() };

  const regions = useRegions(scope);
  const forecast = useForecastPeriod(scope, window);
  const generation = useGenerationPeriod(scope, window);

  const geometry = useMemo(
    () => buildMapGeometry(aggregation, regions.data),
    [aggregation, regions.data]
  );

  const featureStates = useMemo(
    () =>
      buildMapFeatureStates(aggregation, {
        regions: regions.data,
        forecast: forecast.data,
        generation: generation.data,
        targetTime,
        timeNow
      }),
    [aggregation, regions.data, forecast.data, generation.data, targetTime, timeNow]
  );

  const coverage = useMemo(() => {
    const expected = regions.data?.map((region) => region.name) ?? [];
    const published = expected.filter((name) => forecast.data?.regions[name] !== undefined).length;
    return { published, expected: expected.length, isPartial: expected.length > published };
  }, [regions.data, forecast.data]);

  const nationalCapacityMw = useMemo(
    () => (regions.data ?? []).reduce((total, region) => total + (region.capacityMw ?? 0), 0),
    [regions.data]
  );

  return {
    featureStates,
    geometry,
    coverage,
    nationalCapacityMw,
    isLoading: regions.isLoading || forecast.isLoading || generation.isLoading,
    error: forecast.error ?? generation.error ?? regions.error
  };
};

export default useMapRegionValues;
