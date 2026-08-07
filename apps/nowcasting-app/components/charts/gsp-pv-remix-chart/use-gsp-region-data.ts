import { useMemo } from "react";
import {
  useCurrentCountry,
  useForecastPeriod,
  useGenerationPeriod,
  useGenerationSources,
  useRegionForecast,
  useRegionGeneration,
  useRegions
} from "../../../hooks/data";
import type { Region, RegionSeries, Scope, TimeSeries } from "../../../lib/domain/types";
import type { ChartSeriesInput } from "../use-format-chart-data";
import { buildRegionBridge, rollUpRegionSeries } from "../../helpers/data";

const GSP_REGION_TYPE = "gsp";
const SOURCE = "solar";

/**
 * `pv-remix-chart.tsx`'s `GENERATION_CHART_KEYS`, duplicated rather than imported: that file
 * imports `GspPvRemixChart` (this component's `index.tsx`), so importing back from it would
 * be a circular module dependency. Both must move together if a country ever needs a third
 * observer key.
 */
const GENERATION_CHART_KEYS = ["GENERATION", "GENERATION_UPDATED"] as const;

export type GspRegionData = {
  /** The resolved v1 scope, or `null` while disabled/unresolved. */
  scope: Scope | null;
  /** The selected GSP's `Region` — `label` for display, `capacityMw` for the y-axis. */
  region: Region | undefined;
  forecast: TimeSeries | undefined;
  nHour: TimeSeries | undefined;
  /** The country's observed-generation series, keyed the same way the national chart keys them. */
  generationSeries: ChartSeriesInput[];
  /** The first observer's series — what the header's "latest actual" reads, same as national. */
  primaryGeneration: TimeSeries | undefined;
  isLoading: boolean;
  hasError: boolean;
};

/**
 * v1 data for exactly one selected GSP.
 *
 * The common case — an ordinary map click — takes the cheap path: one region-scoped request
 * per series via `useRegionForecast`/`useRegionGeneration`, rather than fetching every GSP's
 * period and rolling up a group of one. Multi-select, DNO, NG-zone and national aggregation
 * go through `useGspAggregateData` below instead, which rolls a `RegionSeries` up with
 * `rollUpRegionSeries`.
 *
 * `enabled` (the caller's "exactly one GSP is selected" test) gates the query, but every hook
 * below still runs on every render — rules of hooks need a constant call count, so "disabled"
 * means "called with a `null` scope", never "not called".
 */
export const useGspRegionData = (
  gspId: number | undefined,
  enabled: boolean,
  nHour: { show: boolean; horizonMinutes: number }
): GspRegionData => {
  const country = useCurrentCountry();

  const regionsScope: Scope | null =
    enabled && country ? { country, source: SOURCE, regionType: GSP_REGION_TYPE } : null;
  const regionsResult = useRegions(regionsScope);
  const region = useMemo(
    () => regionsResult.data?.find((candidate) => candidate.metadata?.["gsp_id"] === gspId),
    [regionsResult.data, gspId]
  );

  const scope: Scope | null =
    enabled && country && region
      ? { country, source: SOURCE, regionType: GSP_REGION_TYPE, region: region.name }
      : null;

  const forecastResult = useRegionForecast(scope, {});
  const nHourResult = useRegionForecast(nHour.show ? scope : null, {
    horizonMinutes: nHour.horizonMinutes
  });

  // Models are per region type, not per country, and GSP time series are pinned to the
  // region type's default (contract: model selection is national-only) — no `model` is ever
  // passed here.

  const generationSources = useGenerationSources(regionsScope);
  const observers = useMemo(
    () => (generationSources.data ?? []).map((source) => source.name),
    [generationSources.data]
  );
  const generation0 = useRegionGeneration(observers[0] === undefined ? null : scope, {
    observer: observers[0]
  });
  const generation1 = useRegionGeneration(observers[1] === undefined ? null : scope, {
    observer: observers[1]
  });
  const generationResults = [generation0, generation1];

  const generationSeries: ChartSeriesInput[] = useMemo(
    () =>
      observers.slice(0, GENERATION_CHART_KEYS.length).map((_, index) => ({
        key: GENERATION_CHART_KEYS[index],
        series: generationResults[index].data
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [observers, generation0.data, generation1.data]
  );

  const isLoading =
    enabled &&
    (!region ||
      !forecastResult.data ||
      observers
        .slice(0, GENERATION_CHART_KEYS.length)
        .some((_, index) => !generationResults[index].data));
  const hasError = [forecastResult, nHourResult, ...generationResults].some(
    (result) => !!result.error
  );

  return {
    scope,
    region,
    forecast: forecastResult.data,
    nHour: nHourResult.data,
    generationSeries,
    primaryGeneration: generation0.data,
    isLoading: !!isLoading,
    hasError
  };
};

export type GspAggregateData = {
  /** The resolved v1 scope, or `null` while disabled. */
  scope: Scope | null;
  /** Total installed capacity across the group's members, MW. `null` while unresolved. */
  capacityMw: number | null;
  forecast: TimeSeries | undefined;
  generationSeries: ChartSeriesInput[];
  /** The first observer's series — what the header's "latest actual" reads. */
  primaryGeneration: TimeSeries | undefined;
  /**
   * Display labels for the group's members, in the order given, for the header tooltip.
   * Resolved from the `useRegions` data this hook already holds, so it costs no extra
   * request. An id with no matching region falls back to the id itself rather than being
   * dropped, so the tooltip's length always matches the selection's.
   */
  memberLabels: string[];
  isLoading: boolean;
  hasError: boolean;
};

/**
 * v1 data for a *group* of GSPs — a multi-select (shift-click), or one DNO / NG-zone /
 * national selection — summed at every timestamp with `rollUpRegionSeries`.
 *
 * Unlike `useGspRegionData`, this fetches every GSP of the region type over the shared window
 * (`forecasts/period` / `generation/period`, the same primitive `useMapRegionValues` uses) and
 * sums client-side, because there is no v1 endpoint that aggregates a chart's worth of a time
 * series server-side. No window is sent, so the request carries no timestamp and does not
 * refire as the user scrubs; the API defaults to 2 days either side, floored to 6 hours.
 *
 * `gspIds` is the flat list of numeric GSP ids to sum — the caller resolves it, whether from a
 * multi-select's raw ids or from `groupGspIds(aggregation, groupName)`. `null`/empty disables
 * every hook's *scope* (never the call itself — see `useGspRegionData`'s note on rules of
 * hooks). `groupName` becomes the rolled-up series' `regionName`; it is not displayed
 * (the caller titles the chart itself).
 *
 * **Reproduces the DNO double-count exactly** when `gspIds` came from a DNO grouping — see
 * `rollUpRegionSeries`'s doc comment in `helpers/data.ts`. Not this hook's job to fix.
 */
export const useGspAggregateData = (
  gspIds: number[] | null,
  groupName: string | null
): GspAggregateData => {
  const country = useCurrentCountry();
  const enabled = !!country && !!gspIds && gspIds.length > 0 && !!groupName;

  const regionsScope: Scope | null =
    enabled && country ? { country, source: SOURCE, regionType: GSP_REGION_TYPE } : null;

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

  const regionsResult = useRegions(regionsScope);
  const bridge = useMemo(() => buildRegionBridge(regionsResult.data), [regionsResult.data]);

  const forecastPeriod = useForecastPeriod(regionsScope, window);

  const generationSources = useGenerationSources(regionsScope);
  const observers = useMemo(
    () => (generationSources.data ?? []).map((source) => source.name),
    [generationSources.data]
  );
  const generation0 = useGenerationPeriod(observers[0] === undefined ? null : regionsScope, {
    ...window,
    observer: observers[0]
  });
  const generation1 = useGenerationPeriod(observers[1] === undefined ? null : regionsScope, {
    ...window,
    observer: observers[1]
  });
  const generationResults = [generation0, generation1];

  const rollUp = (series: RegionSeries | undefined) =>
    enabled && gspIds && groupName
      ? rollUpRegionSeries(series, gspIds, bridge, groupName)
      : undefined;

  const forecast = useMemo(
    () => rollUp(forecastPeriod.data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, gspIds, groupName, forecastPeriod.data, bridge]
  );

  const generationSeries: ChartSeriesInput[] = useMemo(
    () =>
      observers.slice(0, GENERATION_CHART_KEYS.length).map((_, index) => ({
        key: GENERATION_CHART_KEYS[index],
        series: rollUp(generationResults[index].data)
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, gspIds, groupName, observers, generation0.data, generation1.data, bridge]
  );

  const memberLabels = useMemo(
    () =>
      enabled && gspIds ? gspIds.map((id) => bridge.byGspId.get(id)?.label ?? String(id)) : [],
    [enabled, gspIds, bridge]
  );

  const isLoading =
    enabled &&
    (!regionsResult.data ||
      !forecastPeriod.data ||
      observers
        .slice(0, GENERATION_CHART_KEYS.length)
        .some((_, index) => !generationResults[index].data));
  const hasError = [regionsResult, forecastPeriod, ...generationResults].some(
    (result) => !!result.error
  );

  return {
    scope: regionsScope,
    capacityMw: forecast?.capacityMw ?? null,
    forecast,
    generationSeries,
    primaryGeneration: rollUp(generation0.data),
    memberLabels,
    isLoading: !!isLoading,
    hasError
  };
};
