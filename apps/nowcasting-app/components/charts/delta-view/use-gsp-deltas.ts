import { useMemo } from "react";

import {
  useFocusedCountry,
  useForecastPeriod,
  useGenerationPeriod,
  useRegions
} from "../../../hooks/data";
import { useCurrentAggregationLevel } from "../../../hooks/data/use-aggregation-levels";
import { getCountryConfig } from "../../../config/countries";
import { valueRegionTypeFor } from "../../helpers/aggregationLevels";
import type { Scope } from "../../../lib/domain/types";
import type { PeriodWindow } from "../../../lib/api/v1/queries";
import useGlobalState from "../../helpers/globalState";
import { buildRegionBridge, buildRegionValues } from "../../helpers/data";
import { slotForInstant } from "../../../lib/time/cursor";
import { DELTA_BUCKET } from "../../../constant";
import { useMapObserver } from "../../map/map-observer";
import { ActiveUnit } from "../../map/types";
import { GspDeltaValue } from "../../types";

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
   *
   * `null` until the country's region type resolves — a caller must pass it straight through
   * rather than substituting one of its own, or the two stop deduping and the second request
   * is the one that 400s.
   */
  scope: Scope | null;
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
export const useGspDeltas = (cursorTime: string): GspDeltasResult => {
  const country = useFocusedCountry();
  const [cursorNow] = useGlobalState("timeNow");

  // Same resolution the map does, and it has to be the same or the two disagree about which
  // slot a delta belongs to: the cursor is on the finest enabled country's grid, the data is
  // on this country's. See `lib/time/cursor.ts`.
  const targetTime = slotForInstant(cursorTime, country);
  const timeNow = slotForInstant(cursorNow, country);

  // The region type is the focused country's, never a constant. This used to be a hardcoded
  // `"gsp"`, so opening the delta view with NL focused asked for `region_type=gsp` — which NL
  // does not have — and the request 400d. Same fix, same reason, as the selected-region chart's scopes in
  // `gsp-pv-remix-chart/use-gsp-region-data.ts`: a derived level resolves to the finer type it
  // groups, which is what `valueRegionTypeFor` answers.
  const level = useCurrentAggregationLevel(country ?? undefined);
  const regionType = useMemo(
    () => valueRegionTypeFor(level, getCountryConfig(country)),
    [level, country]
  );

  const scope: Scope | null = useMemo(
    () => (country && regionType ? { country, source: SOURCE, regionType } : null),
    [country, regionType]
  );

  // No window at all, deliberately. `/forecasts/period` and `/generation/period` both default
  // to **2 days before → 2 days after now, floored to 6 hours**, and are "served entirely from
  // a pre-warmed cache (one key per region)" — so the default window is the window that is
  // actually warmed, and asking for our own risks missing it as well as truncating.
  //
  // The forecast horizon is a per-country fact (GB publishes 36h ahead, NL 48h), so ANY end we
  // pin is wrong for somebody. Take whatever the API has. The old
  // `{ start: getEarliestForecastTimestamp(), end: getFurthestForecastTimestamp() }` computed a
  // start identical to the default and an end of now +1 day — clipping 6–12h off GB's horizon
  // and 18–24h off NL's. Inherited from v0 with no rationale; see docs/phase4-track-g-notes.md.
  const window = {};

  const regions = useRegions(scope);
  const forecast = useForecastPeriod(scope, window);

  // Name the observer, for the same reason the map's value path does: the API defaults the
  // param to `pvlive_in_day`, which is GB's, so an unnamed request works by luck for GB and
  // 400s for NL ("Observer 'pvlive_in_day' is not available for NL solar"). Hold the request
  // until the manifest names it rather than firing one that is known to fail.
  //
  // Through `useMapObserver`, not `generationSources.data[0]` as this used to: the panel sits
  // beside the delta map and must be reading the *same* observed stream, and "first in the
  // manifest" is not a promise the two would keep. Same resolver, same country registry field.
  const mapObserver = useMapObserver(scope);
  const observer = mapObserver.observer?.name;
  const generation = useGenerationPeriod(observer ? scope : null, { ...window, observer });

  // The map paints percentage-of-capacity buckets when the unit toggle says so; the panel
  // groups by the same buckets and must follow, or its counts describe a different scale from
  // the colours next to them. Capacity folds in with MW — installed capacity has no delta.
  const [activeUnit] = useGlobalState("activeUnit");
  const asPercentage = activeUnit === ActiveUnit.percentage;

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

      // The map's id for this region, which is what a selection is made of. GB's features are
      // keyed by numeric `gsp_id`; a country whose regions have none (NL's provinces) is keyed
      // by region name — `country-features.ts` stamps whichever applies. This used to `return`
      // when there was no `gsp_id`, which silently dropped every NL province before it reached
      // the table: the delta map coloured NL correctly while the list beside it showed nothing.
      const gspId = bridge.gspIdFor(regionName);
      const regionId = gspId === undefined ? regionName : String(gspId);

      // Whichever bucketing the map is painting, so the panel's counts and the map's colours
      // are the same partition of the same regions. They share `buildRegionValues`'s output
      // precisely so they cannot disagree; letting the panel stay on megawatts while the map
      // moved to percentages would have reintroduced that by the back door.
      const deltaBucket = (asPercentage
        ? value.deltaBucketNormalized
        : value.deltaBucket) as DELTA_BUCKET;
      // Off the value join now, rather than recomputed here from `delta / capacity` — one
      // definition, and the panel's percentage and the map's cannot drift apart.
      const deltaNormalized = value.deltaNormalized;
      const forecastMw = value.power;
      const currentYield = value.actual ?? 0;

      result.set(regionName, {
        regionId,
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
  }, [regions.data, forecast.data, generation.data, targetTime, timeNow, asPercentage]);

  return {
    gspDeltas,
    isLoading: regions.isLoading || forecast.isLoading || generation.isLoading,
    error: forecast.error ?? generation.error ?? regions.error,
    scope,
    window
  };
};

export default useGspDeltas;
