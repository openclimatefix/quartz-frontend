import { useMemo } from "react";

import type {
  EndpointState,
  LoadingState,
  NationalEndpointKeysType,
  NationalEndpointStates
} from "../../components/types.d";
import { NationalEndpointLabel } from "../../components/endpoint-labels";
import type { ForecastWindow, PeriodWindow } from "../../lib/api/v1/queries";
import type { RegionSeries, Scope, TimeSeries } from "../../lib/domain/types";
import type { DataResult } from "./query";
import { useNationalForecast } from "./use-forecast";
import { useForecastPeriod } from "./use-forecast";
import { useGenerationPeriod } from "./use-generation";
import { useNationalGeneration } from "./use-generation";

/**
 * The global "is anything stale" indicator — the one legitimately cross-cutting concern.
 *
 * It is cross-cutting because it reports on every request the dashboard makes at once, which
 * is precisely why it must not be fed by drilled props: the `computeLoadingState` it replaced
 * took four parallel god-objects (`CombinedLoading`, `CombinedValidating`, `CombinedErrors`,
 * `CombinedData`) assembled in `pages/index.tsx` and passed down. This hook calls the same
 * small hooks the views call instead. SWR dedupes on the cache key, so calling them again
 * costs nothing — no request, no second copy of the data — provided the arguments produce the
 * same key. That is the one thing a caller has to get right: **pass the indicator the same
 * scope, window, model and observers the views are using.**
 *
 * The output is byte-for-byte the shape `computeLoadingState` produced, so
 * `DataLoadingChartStatus` renders unchanged. Both it and the dead `loadingState` global it
 * used to be written into were deleted in Phase 4 wave 4; this hook is the only source now.
 */

/**
 * The row labels the status message is built from.
 *
 * These come from `components/endpoint-labels.ts` — a real module, not `types.d.ts`. They used
 * to be duplicated here because the enum was declared in a `.d.ts`, which TypeScript treats as
 * ambient and ts-jest therefore leaves `undefined` at runtime. Phase 4 wave 4 moved the enum;
 * the copy is gone.
 */
const ENDPOINT_LABEL: Record<NationalEndpointKeysType, string> = NationalEndpointLabel;

/**
 * What the dashboard is asking for. Arguments, not data — the hook fetches nothing new.
 *
 * `observers` must come from `useGenerationSources(scope)`, never from hardcoded names: NL
 * has one observer where GB has two, and the second entry simply does not exist there. A
 * missing observer drops its row from the indicator rather than showing a permanently
 * failing one.
 */
export type NationalLoadingQueries = {
  /** The national scope: `{ country, source, regionType: "national" }`. */
  scope: Scope | null | undefined;
  /**
   * The sub-national scope the `period` queries use (GB `gsp`, NL `province`). Omit or pass
   * `null` on a view that does not load them, and their rows disappear from the indicator.
   */
  regionScope?: Scope | null;
  /** The window the views pass to `useForecastPeriod`/`useGenerationPeriod`. */
  periodWindow?: PeriodWindow;
  /** The model the national chart is showing, if it is not on the region type's default. */
  model?: string;
  /** Observer names in manifest order. `[0]` is the estimate line, `[1]` the updated line. */
  observers?: string[];
  /** Lead time for the N-hour forecast row. Omit to drop the row. */
  nHourHorizonMinutes?: number;
  /** Window shared by the national forecast/generation series, if the views pin one. */
  nationalWindow?: Pick<ForecastWindow, "start" | "end">;
};

const timeSeriesHasData = (result: DataResult<TimeSeries>): boolean =>
  (result.data?.values.length ?? 0) > 0;

const regionSeriesHasData = (result: DataResult<RegionSeries>): boolean =>
  Object.keys(result.data?.regions ?? {}).length > 0;

const toEndpointState = (result: DataResult<unknown>, hasData: boolean): EndpointState => ({
  loading: result.isLoading,
  validating: result.isValidating,
  error: result.error,
  hasData
});

export const useLoadingState = (
  options: NationalLoadingQueries
): LoadingState<NationalEndpointStates> => {
  const {
    scope,
    regionScope = null,
    periodWindow = {},
    model,
    observers = [],
    nHourHorizonMinutes,
    nationalWindow = {}
  } = options;

  // Every hook is called unconditionally — a query that is not wanted is disabled by passing
  // a null scope, which is how the rules of hooks are honoured while the row count varies by
  // country. A disabled query reports isLoading: false, so it never blocks the indicator.
  const nationalForecast = useNationalForecast(scope, { ...nationalWindow, model });
  const nationalNHour = useNationalForecast(nHourHorizonMinutes === undefined ? null : scope, {
    ...nationalWindow,
    horizonMinutes: nHourHorizonMinutes
  });
  const generationEstimate = useNationalGeneration(observers[0] === undefined ? null : scope, {
    ...nationalWindow,
    observer: observers[0]
  });
  const generationUpdated = useNationalGeneration(observers[1] === undefined ? null : scope, {
    ...nationalWindow,
    observer: observers[1]
  });
  const forecastPeriod = useForecastPeriod(regionScope, periodWindow);
  // Named observer, and gated on having one: the API defaults this param to `pvlive_in_day`,
  // GB's, so an unnamed region-scoped request 400s for every other country — and this hook's
  // whole purpose is to dedupe onto the *caller's* request, which does name it. Without this
  // the indicator fired a second, different, failing request alongside the working one.
  const generationPeriod = useGenerationPeriod(observers[0] === undefined ? null : regionScope, {
    ...periodWindow,
    observer: observers[0]
  });

  return useMemo(() => {
    // Order is load-bearing: the message names the first validating endpoint and degrades to
    // the generic "Loading latest data" once a second one is also validating. This is the
    // order `computeLoadingState` checked them in.
    const rows: { key: NationalEndpointKeysType; state: EndpointState }[] = [
      {
        key: "nationalForecast",
        state: toEndpointState(nationalForecast, timeSeriesHasData(nationalForecast))
      }
    ];
    if (observers[0] !== undefined) {
      rows.push({
        key: "pvRealDayIn",
        state: toEndpointState(generationEstimate, timeSeriesHasData(generationEstimate))
      });
    }
    if (observers[1] !== undefined) {
      rows.push({
        key: "pvRealDayAfter",
        state: toEndpointState(generationUpdated, timeSeriesHasData(generationUpdated))
      });
    }
    if (nHourHorizonMinutes !== undefined) {
      rows.push({
        key: "nationalNHour",
        state: toEndpointState(nationalNHour, timeSeriesHasData(nationalNHour))
      });
    }
    if (regionScope) {
      rows.push({
        key: "allGspForecast",
        state: toEndpointState(forecastPeriod, regionSeriesHasData(forecastPeriod))
      });
      rows.push({
        key: "allGspReal",
        state: toEndpointState(generationPeriod, regionSeriesHasData(generationPeriod))
      });
    }

    // The N-hour forecast is a long historic query that is slow by nature; it never held up
    // "initial load complete" and still does not.
    const initialLoadComplete = rows.every(
      (row) => row.key === "nationalNHour" || !row.state.loading
    );
    let showMessage = !initialLoadComplete;
    let message = "Loading initial data";

    if (initialLoadComplete) {
      for (const row of rows) {
        if (!row.state.validating) continue;
        message = showMessage ? "Loading latest data" : `Loading latest ${ENDPOINT_LABEL[row.key]}`;
        showMessage = true;
      }
    }

    // An error outranks whatever was loading: the retry is silent (503 backoff), so the
    // indicator is the only place a user learns the data on screen may be behind.
    if (rows.some((row) => !!row.state.error)) {
      message = initialLoadComplete
        ? "Error loading data. Waiting to retry..."
        : "Error loading initial data. Waiting to retry...";
      showMessage = true;
    }

    // Rows absent for this country (NL's second observer) are omitted rather than reported as
    // permanently empty. `NationalEndpointStates` requires every key, but the only consumer
    // iterates `Object.entries`, so a missing key renders as one fewer row — which is the
    // intent. The assertion is the narrow, deliberate part of that.
    const endpointStates = {
      type: "national",
      ...Object.fromEntries(rows.map((row) => [row.key, row.state]))
    } as NationalEndpointStates;

    return { initialLoadComplete, showMessage, message, endpointStates };
  }, [
    nationalForecast,
    nationalNHour,
    generationEstimate,
    generationUpdated,
    forecastPeriod,
    generationPeriod,
    observers,
    nHourHorizonMinutes,
    regionScope
  ]);
};
