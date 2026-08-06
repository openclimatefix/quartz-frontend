import { FC, useEffect, useMemo } from "react";
import RemixLine from "./remix-line";
import ForecastHeader from "./forecast-header";
import useGlobalState, { useCountryState, get30MinNow } from "../helpers/globalState";
import useFormatChartData, { type ChartSeriesInput } from "./use-format-chart-data";
import { formatISODateString } from "../helpers/utils";
import GspPvRemixChart from "./gsp-pv-remix-chart";
import { useStopAndResetTime } from "../hooks/use-and-update-selected-time";
import Spinner from "../icons/spinner";
import { MAX_NATIONAL_GENERATION_MW, Y_MAX_TICKS, VIEWS } from "../../constant";
import useHotKeyControlChart from "../hooks/use-hot-key-control-chart";
import { CombinedData, CombinedErrors } from "../types";
import { ChartLegend } from "./ChartLegend";
import DataLoadingChartStatus from "./DataLoadingChartStatus";
import { calculateChartYMax } from "../helpers/utils";
import { getTicks } from "../helpers/chartUtils";
import {
  NATIONAL_REGION_TYPE,
  useCurrentCountry,
  useGenerationSources,
  useLoadingState,
  useNationalForecast,
  useNationalGeneration
} from "../../hooks/data";
import type { Scope } from "../../lib/domain/types";
import { forecastSeriesModel, getCountryConfig } from "../../config/countries";

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
  // `combinedData` and `combinedErrors` are still passed by `pages/index.tsx` and are
  // deliberately no longer read: the chart fetches what it needs itself now. The props stay
  // in the signature until index.tsx is decomposed, which is a separate step.
  combinedData?: CombinedData;
  combinedErrors?: CombinedErrors;
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

  const currentCountry = useCurrentCountry();
  const countryConfig = getCountryConfig(currentCountry);
  const seriesConfig = useMemo(
    () => (countryConfig?.nationalChartSeries ?? []).slice(0, MAX_FORECAST_SERIES),
    [countryConfig]
  );

  const scope: Scope | null = currentCountry
    ? { country: currentCountry, source: "solar", regionType: NATIONAL_REGION_TYPE }
    : null;

  // A slot with no configured series is disabled; a configured one asks for its model, or for
  // no `model` parameter at all when the country wants the region type's default.
  const slotScope = (index: number) => (seriesConfig[index] ? scope : null);
  const slotModel = (index: number) =>
    seriesConfig[index] ? forecastSeriesModel(seriesConfig[index]) : undefined;

  const forecast0 = useNationalForecast(slotScope(0), { model: slotModel(0) });
  const forecast1 = useNationalForecast(slotScope(1), { model: slotModel(1) });
  const forecast2 = useNationalForecast(slotScope(2), { model: slotModel(2) });
  const forecast3 = useNationalForecast(slotScope(3), { model: slotModel(3) });
  const forecast4 = useNationalForecast(slotScope(4), { model: slotModel(4) });
  const forecast5 = useNationalForecast(slotScope(5), { model: slotModel(5) });
  const forecast6 = useNationalForecast(slotScope(6), { model: slotModel(6) });
  const forecast7 = useNationalForecast(slotScope(7), { model: slotModel(7) });
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
    observer: observers[0]
  });
  const generation1 = useNationalGeneration(observers[1] === undefined ? null : scope, {
    observer: observers[1]
  });
  const generationResults = [generation0, generation1];

  const nHourHorizonMinutes = showNHourView ? nHourForecast * 60 : undefined;
  const nHour = useNationalForecast(nHourHorizonMinutes === undefined ? null : scope, {
    horizonMinutes: nHourHorizonMinutes
  });

  // The staleness indicator calls these same hooks again. SWR dedupes on the cache key, so it
  // costs nothing — PROVIDED the arguments match exactly. Scope, model, observers and the
  // N-hour horizon are all passed straight through from the values used above for that reason.
  const loadingState = useLoadingState({
    scope: slotScope(0),
    model: slotModel(0),
    observers,
    nHourHorizonMinutes
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

  const setSelectedTime = (time: string) => {
    stopTime();
    setSelectedISOTime(time + ":00.000Z");
  };

  let selectedRegions: string[] = [];
  if (selectedMapRegionIds && selectedMapRegionIds.length > 0) {
    selectedRegions = selectedMapRegionIds.map((id) => String(id));
  }

  const [view] = useGlobalState("view");
  useEffect(() => {
    if (view === VIEWS.FORECAST && chartData?.length) {
      if (!chartData.some((d: any) => d.formattedDate === selectedTime)) {
        setSelectedISOTime(get30MinNow());
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
