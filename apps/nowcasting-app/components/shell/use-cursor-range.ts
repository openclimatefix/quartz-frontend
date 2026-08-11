import { useMemo } from "react";

import { NATIONAL_REGION_TYPE, useFocusedCountry, useNationalForecast } from "../../hooks/data";
import type { Scope } from "../../lib/domain/types";
import { forecastSeriesModel, getCountryConfig } from "../../config/countries";
import { getEarliestForecastTimestamp } from "../helpers/data";
import type { CursorRange } from "./scrub-scale";

/**
 * The window the scrub track spans — **derived, never invented**.
 *
 * The contract is explicit that the time *range* is unchanged for Europe v1 (§4: "no range
 * picker, no date picker — the window we already show"), so the track must not introduce one.
 * The window the app already shows is the focused country's national forecast axis, and this
 * reads exactly that: the same query `pv-remix-chart.tsx` runs for its first series, whose
 * first and last `timeUtc` are already the arrow keys' limits (`chartLimits`) and the play
 * button's wrap point (`forecastEndTime`). Deriving it this way is what makes the four inputs
 * agree about where the ends are, rather than three agreeing and the new one being close.
 *
 * It costs no request. SWR dedupes on the cache key, and every argument here is the same one
 * the chart passes:
 *
 * - the scope is the focused country's national scope;
 * - the model is `nationalChartSeries[0]`'s, because that is the series the chart's limits come
 *   off — a country whose first series names no model asks for the region type's default, as
 *   there;
 * - the window pins `start` only. The end is the API's default (+48h), deliberately: pinning it
 *   is what silently clipped GB's horizon from 48h to ~26h before Phase 4 (see the note in
 *   `components/helpers/data.ts`), and a scrub track that stops 22 hours short of the forecast
 *   would look completely reasonable.
 *
 * `getEarliestForecastTimestamp()` floors to a 6-hour boundary, so this and the chart compute
 * the same string for any pair of mounts inside the same 6-hour block — which, since both are
 * memoised on mount and the shell mounts them together, is every session. If they ever did
 * diverge the cost is one extra cached request, not a wrong range.
 *
 * Returns `null` until values arrive. The caller draws an inert track rather than guessing a
 * horizon; there is no defensible default for "how far ahead does this country forecast".
 */
export const useCursorRange = (): CursorRange | null => {
  const focusedCountry = useFocusedCountry();
  const countryConfig = getCountryConfig(focusedCountry);

  const scope: Scope | null = focusedCountry
    ? { country: focusedCountry, source: "solar", regionType: NATIONAL_REGION_TYPE }
    : null;

  const primarySeries = countryConfig?.nationalChartSeries?.[0];
  // Memoised on mount for the same reason the chart memoises it: the value moves every 6 hours
  // and an unstable SWR key would refetch the whole window on every scrub tick.
  const start = useMemo(() => getEarliestForecastTimestamp(), []);

  const forecast = useNationalForecast(primarySeries ? scope : null, {
    start,
    model: primarySeries ? forecastSeriesModel(primarySeries) : undefined
  });

  return useMemo(() => {
    const values = forecast.data?.values;
    if (!values?.length) return null;
    const first = values[0]?.timeUtc;
    const last = values[values.length - 1]?.timeUtc;
    return first && last ? { start: first, end: last } : null;
  }, [forecast.data]);
};

export default useCursorRange;
