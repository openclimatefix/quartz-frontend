import { FC, useEffect, useMemo } from "react";
import RemixLine from "./remix-line";
import ForecastHeader from "./forecast-header";
import useGlobalState, {
  useCountryState,
  getCursorCadenceMinutes,
  getCursorNow
} from "../helpers/globalState";
import { snapToCadence } from "../../lib/time/cursor";
import useFormatChartData, { type ChartSeriesInput } from "./use-format-chart-data";
import { formatISODateString } from "../helpers/utils";
import GspPvRemixChart from "./gsp-pv-remix-chart";
import { useStopAndResetTime } from "../hooks/use-and-update-selected-time";
import Spinner from "../icons/spinner";
import { MAX_NATIONAL_GENERATION_MW, Y_MAX_TICKS, VIEWS } from "../../constant";
import useHotKeyControlChart from "../hooks/use-hot-key-control-chart";
import { ChartLegend } from "./ChartLegend";
import DataLoadingChartStatus from "./DataLoadingChartStatus";
import { calculateChartYMax } from "../helpers/utils";
import { getTicks } from "../helpers/chartUtils";
import {
  NATIONAL_REGION_TYPE,
  useFocusedCountry,
  useGenerationSources,
  useLoadingState,
  useNationalForecast,
  useNationalGeneration
} from "../../hooks/data";
import type { Scope } from "../../lib/domain/types";
import { forecastSeriesModel, getCountryConfig } from "../../config/countries";
import { getEarliestForecastTimestamp } from "../helpers/data";

/**
 * The `ChartData` keys the observed-generation lines are written under, in manifest observer
 * order. **Positional, not name-based** — GB's `pvlive_in_day`/`pvlive_day_after` land on
 * `GENERATION`/`GENERATION_UPDATED`, and NL's single `ned_nl` lands on `GENERATION` alone.
 * A country with a third observer would need a third key here and a third `<Line>`; nothing
 * assumes index 1 exists.
 */
export const GENERATION_CHART_KEYS = ["GENERATION", "GENERATION_UPDATED"] as const;

/**
 * How many forecast lines the chart can draw. GB uses six, NL one.
 *
 * The hook calls below are unrolled to this length rather than mapped over the country's
 * series list, because the rules of hooks require a constant call count and the list length
 * is a country fact that changes when the user switches country. An unused slot is passed a
 * `null` scope, which the data layer turns into a disabled query: no request, no data, and
 * `isLoading: false`.
 */
const MAX_FORECAST_SERIES = 8;

const PvRemixChart: FC<{
  date?: string;
  className?: string;
}> = ({ className }) => {
  const [selectedMapRegionIds, setSelectedMapRegionIds] = useCountryState("selectedMapRegionIds");
  const [visibleLines] = useGlobalState("visibleLines");
  const [selectedISOTime, setSelectedISOTime] = useGlobalState("selectedISOTime");
  const [timeNow] = useGlobalState("timeNow");
  const [showNHourView] = useGlobalState("showNHourView");
  const [nHourForecast] = useGlobalState("nHourForecast");
  const { stopTime, resetTime } = useStopAndResetTime();
  const selectedTime = formatISODateString(selectedISOTime || new Date().toISOString());

  const focusedCountry = useFocusedCountry();
  const countryConfig = getCountryConfig(focusedCountry);
  const seriesConfig = useMemo(
    () => (countryConfig?.nationalChartSeries ?? []).slice(0, MAX_FORECAST_SERIES),
    [countryConfig]
  );

  const scope: Scope | null = focusedCountry
    ? { country: focusedCountry, source: "solar", regionType: NATIONAL_REGION_TYPE }
    : null;

  // Only `start` is pinned. `/regions/{region}/forecast` defaults its window to **now → +48h**
  // and `/generation` to the **last 24h**, so without a start the chart has no past at all.
  // The END is deliberately left to the API: its default is +48h for the forecast and "now"
  // for generation, both of which are what the chart wants. Pinning it to
  // `getFurthestForecastTimestamp()` (now +1 day, i.e. +24–30h) is what the sub-national views
  // do, and doing the same here silently CLIPPED the forward horizon from 48h to ~26h.
  // Floored to a 6-hour boundary, so the SWR key is stable across scrub ticks.
  const nationalWindow = useMemo(() => ({ start: getEarliestForecastTimestamp() }), []);

  // A slot with no configured series is disabled; a configured one asks for its model, or for
  // no `model` parameter at all when the country wants the region type's default.
  const slotScope = (index: number) => (seriesConfig[index] ? scope : null);
  const slotModel = (index: number) =>
    seriesConfig[index] ? forecastSeriesModel(seriesConfig[index]) : undefined;

  const forecast0 = useNationalForecast(slotScope(0), { ...nationalWindow, model: slotModel(0) });
  const forecast1 = useNationalForecast(slotScope(1), { ...nationalWindow, model: slotModel(1) });
  const forecast2 = useNationalForecast(slotScope(2), { ...nationalWindow, model: slotModel(2) });
  const forecast3 = useNationalForecast(slotScope(3), { ...nationalWindow, model: slotModel(3) });
  const forecast4 = useNationalForecast(slotScope(4), { ...nationalWindow, model: slotModel(4) });
  const forecast5 = useNationalForecast(slotScope(5), { ...nationalWindow, model: slotModel(5) });
  const forecast6 = useNationalForecast(slotScope(6), { ...nationalWindow, model: slotModel(6) });
  const forecast7 = useNationalForecast(slotScope(7), { ...nationalWindow, model: slotModel(7) });
  const forecastResults = [
    forecast0,
    forecast1,
    forecast2,
    forecast3,
    forecast4,
    forecast5,
    forecast6,
    forecast7
  ];

  // Observers come from the manifest, never from a hardcoded pair. `useGenerationSources`
  // is a slice of the hourly `/countries` response the header already fetches, so this
  // costs no request.
  const generationSources = useGenerationSources(scope);
  const observers = useMemo(
    () => (generationSources.data ?? []).map((source) => source.name),
    [generationSources.data]
  );

  const generation0 = useNationalGeneration(observers[0] === undefined ? null : scope, {
    ...nationalWindow,
    observer: observers[0]
  });
  const generation1 = useNationalGeneration(observers[1] === undefined ? null : scope, {
    ...nationalWindow,
    observer: observers[1]
  });
  const generationResults = [generation0, generation1];

  const nHourHorizonMinutes = showNHourView ? nHourForecast * 60 : undefined;
  const nHour = useNationalForecast(nHourHorizonMinutes === undefined ? null : scope, {
    ...nationalWindow,
    horizonMinutes: nHourHorizonMinutes
  });

  // The staleness indicator calls these same hooks again. SWR dedupes on the cache key, so it
  // costs nothing — PROVIDED the arguments match exactly. Scope, model, observers and the
  // N-hour horizon are all passed straight through from the values used above for that reason.
  const loadingState = useLoadingState({
    scope: slotScope(0),
    model: slotModel(0),
    observers,
    nHourHorizonMinutes,
    nationalWindow
  });

  const forecastSeries = forecast0.data;
  const modelSeries: ChartSeriesInput[] = useMemo(
    () =>
      seriesConfig
        .slice(1)
        .map((series, index) => ({ key: series.key, series: forecastResults[index + 1].data })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      seriesConfig,
      forecast1.data,
      forecast2.data,
      forecast3.data,
      forecast4.data,
      forecast5.data,
      forecast6.data,
      forecast7.data
    ]
  );
  const generationSeries: ChartSeriesInput[] = useMemo(
    () =>
      observers.slice(0, GENERATION_CHART_KEYS.length).map((_, index) => ({
        key: GENERATION_CHART_KEYS[index],
        series: generationResults[index].data
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [observers, generation0.data, generation1.data]
  );

  const chartLimits = useMemo(() => {
    const values = forecastSeries?.values;
    return (
      values?.length && {
        start: values[0].timeUtc,
        end: values[values.length - 1].timeUtc
      }
    );
  }, [forecastSeries]);
  useHotKeyControlChart(chartLimits || undefined);

  const chartData = useFormatChartData({
    forecastSeries,
    modelSeries,
    nHourSeries: nHour.data,
    generationSeries,
    timeTrigger: selectedTime
  });

  const yMax = useMemo(() => {
    return calculateChartYMax(chartData, MAX_NATIONAL_GENERATION_MW);
  }, [chartData]);

  const hasError = [...forecastResults, ...generationResults, nHour].some(
    (result) => !!result.error
  );
  const waitingForData =
    !forecastSeries || generationSeries.some((series) => series.series === undefined);

  // Click-to-set-time. The label comes off this country's axis, so it may sit between two
  // slots of the shared cursor grid when a finer country is enabled — snap it, so the chart
  // and the map are never a slot apart. On a single-cadence session this is a no-op.
  const setSelectedTime = (time: string) => {
    stopTime();
    setSelectedISOTime(snapToCadence(`${time}:00.000Z`, getCursorCadenceMinutes()));
  };

  let selectedRegions: string[] = [];
  if (selectedMapRegionIds && selectedMapRegionIds.length > 0) {
    selectedRegions = selectedMapRegionIds.map((id) => String(id));
  }

  const [view] = useGlobalState("view");
  useEffect(() => {
    if (view === VIEWS.FORECAST && chartData?.length) {
      if (!chartData.some((d: any) => d.formattedDate === selectedTime)) {
        setSelectedISOTime(getCursorNow());
      }
    }
  }, [view, chartData, selectedTime, setSelectedISOTime]);

  return (
    <>
      <div className={`flex flex-col flex-auto ${className || ""}`}>
        <div className="flex flex-col flex-1 dash:h-auto">
          <ForecastHeader
            forecastSeries={forecastSeries}
            generationSeries={generation0.data}
            deltaView={false}
          ></ForecastHeader>
          {waitingForData && !hasError && (
            <div
              className={`h-full absolute flex pb-7 items-center justify-center inset-0 z-30 ${className}`}
            >
              <Spinner></Spinner>
            </div>
          )}
          <div className="flex-1 relative">
            <DataLoadingChartStatus loadingState={loadingState} />
            <RemixLine
              resetTime={resetTime}
              timeNow={formatISODateString(timeNow)}
              timeOfInterest={selectedTime}
              setTimeOfInterest={setSelectedTime}
              data={chartData}
              yMax={yMax}
              visibleLines={visibleLines}
              yTicks={getTicks(yMax, Y_MAX_TICKS)}
            />
          </div>
        </div>
        {selectedRegions && selectedRegions.length > 0 && (
          <div className="flex-1 flex flex-col relative dash:h-auto">
            <GspPvRemixChart
              close={() => {
                setSelectedMapRegionIds([]);
              }}
              setTimeOfInterest={setSelectedTime}
              selectedTime={selectedTime}
              selectedRegions={selectedRegions}
              timeNow={formatISODateString(timeNow)}
              resetTime={resetTime}
              visibleLines={visibleLines}
            ></GspPvRemixChart>
          </div>
        )}
      </div>
      {!className?.includes("hidden") && <ChartLegend />}
    </>
  );
};

export default PvRemixChart;
