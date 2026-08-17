import { useMemo } from "react";
import {
  useFocusedCountry,
  useForecastPeriod,
  useGenerationPeriod,
  useGenerationSources,
  useRegionForecast,
  useRegionGeneration,
  useRegions
} from "../../../hooks/data";
import { useCurrentAggregationLevel } from "../../../hooks/data/use-aggregation-levels";
import { getCountryConfig } from "../../../config/countries";
import { valueRegionTypeFor } from "../../helpers/aggregationLevels";
import type { Region, RegionSeries, Scope, TimeSeries } from "../../../lib/domain/types";
import type { ChartSeriesInput } from "../use-format-chart-data";
import { buildRegionBridge, rollUpRegionSeries } from "../../helpers/data";

const GSP_REGION_TYPE = "gsp";
const SOURCE = "solar";

/**
 * The region type the *selected* regions belong to, for the focused country.
 *
 * `GSP_REGION_TYPE` is still right for `useGspRegionData`, which only runs when the level
 * genuinely is GB's GSP level (its caller gates on that, and it resolves regions by the
 * GB-only `gsp_id` bridge). It was wrong everywhere else: selecting an NL province asked the
 * API for `region_type=gsp`, which NL does not have, and the request 400d. A derived level
 * resolves to the finer type it groups — see `valueRegionTypeFor`.
 */
const useSelectionRegionType = (country: string | null): string | null => {
  const level = useCurrentAggregationLevel(country ?? undefined);
  return useMemo(() => valueRegionTypeFor(level, getCountryConfig(country)), [level, country]);
};

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
  const country = useFocusedCountry();

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

  // No window: `queries.forecast`/`queries.generation` apply the shared history default for
  // every region time-series (`lib/api/v1/series-window.ts`). This path used to pass `{}` and
  // get the endpoint's own now-→-+48h default, which is why the selected-GSP chart drew no
  // forecast history while its PV Live line had a day of it.
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
   * request. A name with no matching region falls back to the name itself rather than being
   * dropped, so the tooltip's length always matches the selection's.
   */
  memberLabels: string[];
  isLoading: boolean;
  hasError: boolean;
};

/**
 * Resolve Mapbox GSP feature ids to v1 region names.
 *
 * The map's feature id at GSP level is the numeric `gsp_id` — `use-update-map-state-on-click.ts`
 * coerces clicks with `Number()` and stores them as strings — while every v1 payload is keyed
 * by region name (`"citr_1"`). This is the one hop between the two, and it lives here because
 * the region list it needs is already fetched by the hook below; SWR's key dedupes the two
 * calls into a single request.
 *
 * `null` in, `null` out, and `null` while the region list is still loading: an empty or
 * unresolvable selection must disable the caller, not produce a group whose rollup is a
 * series of zeroes.
 */
export const useGspRegionNames = (gspIds: string[] | null): string[] | null => {
  const country = useFocusedCountry();
  const regionType = useSelectionRegionType(country);
  const scope: Scope | null =
    country && regionType && gspIds && gspIds.length > 0
      ? { country, source: SOURCE, regionType }
      : null;
  const regionsResult = useRegions(scope);

  return useMemo(() => {
    if (!gspIds || gspIds.length === 0) return null;
    const bridge = buildRegionBridge(regionsResult.data);
    // Two id shapes, because the map's feature ids are the country's, not one scheme. GB's GSP
    // features are numeric `gsp_id`s and need the bridge; a country whose regions have no
    // `gsp_id` at all (NL's provinces) carries the region name itself. Try the numeric bridge
    // first and fall back to a name match — never assume the GB shape, which is what made
    // selecting an NL province resolve to nothing.
    const names = gspIds
      .map((id) => bridge.byGspId.get(Number(id))?.name ?? bridge.byName.get(String(id))?.name)
      .filter((name): name is string => name !== undefined);
    return names.length > 0 ? names : null;
  }, [gspIds, regionsResult.data]);
};

/**
 * v1 data for a *group* of regions — a multi-select (shift-click), or one DNO / NG-zone
 * selection — summed at every timestamp with `rollUpRegionSeries`.
 *
 * Unlike `useGspRegionData`, this fetches every GSP of the region type over the shared window
 * (`forecasts/period` / `generation/period`, the same primitive `useMapRegionValues` uses) and
 * sums client-side, because there is no v1 endpoint that aggregates a chart's worth of a time
 * series server-side. No window is sent, so the request carries no timestamp and does not
 * refire as the user scrubs; the API defaults to 2 days either side, floored to 6 hours.
 *
 * `regionNames` is the flat list of v1 region names to sum — the caller resolves it, whether
 * from a multi-select (via `useGspRegionNames`) or from `groupRegionNames(groupings, name)`.
 * Phase 5 re-keyed the shipped grouping assets by name, so no numeric id reaches this hook
 * any more and the `RegionBridge` hop it used to make is gone. `null`/empty disables every
 * hook's *scope* (never the call itself — see `useGspRegionData`'s note on rules of hooks).
 * `groupName` becomes the rolled-up series' `regionName`; it is not displayed (the caller
 * titles the chart itself).
 *
 * **Reproduces the DNO double-count exactly** when `regionNames` came from a DNO grouping —
 * see `rollUpRegionSeries`'s doc comment in `helpers/data.ts`. Not this hook's job to fix.
 */
export const useGspAggregateData = (
  regionNames: string[] | null,
  groupName: string | null
): GspAggregateData => {
  const country = useFocusedCountry();
  const regionType = useSelectionRegionType(country);
  const enabled =
    !!country && !!regionType && !!regionNames && regionNames.length > 0 && !!groupName;

  const regionsScope: Scope | null =
    enabled && country && regionType ? { country, source: SOURCE, regionType } : null;

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
    enabled && regionNames && groupName
      ? rollUpRegionSeries(series, regionNames, groupName)
      : undefined;

  const forecast = useMemo(
    () => rollUp(forecastPeriod.data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, regionNames, groupName, forecastPeriod.data]
  );

  const generationSeries: ChartSeriesInput[] = useMemo(
    () =>
      observers.slice(0, GENERATION_CHART_KEYS.length).map((_, index) => ({
        key: GENERATION_CHART_KEYS[index],
        series: rollUp(generationResults[index].data)
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, regionNames, groupName, observers, generation0.data, generation1.data]
  );

  // Labels ("City Road"), never the raw region names. A name with no region behind it falls
  // back to the name itself rather than being dropped, so the tooltip's length always matches
  // the selection's.
  const memberLabels = useMemo(() => {
    if (!enabled || !regionNames) return [];
    const bridge = buildRegionBridge(regionsResult.data);
    return regionNames.map((name) => bridge.byName.get(name)?.label ?? name);
  }, [enabled, regionNames, regionsResult.data]);

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
