import RemixLine from "../remix-line";
import useFormatChartData from "../use-format-chart-data";
import {
  formatISODateString,
  formatISODateStringAsZonedTime,
  getRoundedTickBoundary
} from "../../helpers/utils";
import { useCountryFormatting } from "../../../hooks/data/use-country-format";
import ForecastHeaderGSP from "./forecast-header-gsp";
import { useGspAggregateData, useGspRegionData } from "./use-gsp-region-data";
import useGlobalState, {
  useCountryState,
  get30MinNow,
  getNext30MinSlot
} from "../../helpers/globalState";
import Spinner from "../../icons/spinner";
import React, { FC, useMemo } from "react";
import { NationalAggregation } from "../../map/types";
import { getTicks } from "../../helpers/chartUtils";
import { Y_MAX_TICKS } from "../../../constant";
import { groupGspIds } from "../../helpers/data";
import type { TimeSeries } from "../../../lib/domain/types";

/**
 * The latest point that actually carries a reading. Mirrors `forecast-header/index.tsx`'s
 * `latestReading` (not imported: that file is owned by another track, and this is six lines).
 */
const latestReading = (series?: TimeSeries) => {
  if (!series) return undefined;
  for (let i = series.values.length - 1; i >= 0; i -= 1) {
    if (typeof series.values[i].powerMw === "number") return series.values[i];
  }
  return undefined;
};

const GspPvRemixChart: FC<{
  selectedRegions: string[];
  selectedTime: string;
  close: () => void;
  setTimeOfInterest: (t: string) => void;
  timeNow: string;
  resetTime: () => void;
  visibleLines: string[];
  deltaView?: boolean;
}> = ({
  selectedRegions,
  selectedTime,
  close,
  setTimeOfInterest,
  timeNow,
  resetTime,
  visibleLines,
  deltaView = false
}) => {
  const [nationalAggregationLevel] = useCountryState("nationalAggregationLevel");
  const { timezone, locale } = useCountryFormatting();
  const [show4hView] = useGlobalState("showNHourView");
  const [nHourForecast] = useGlobalState("nHourForecast");

  // v1 covers every selection. Exactly one selected GSP takes the cheap per-region path
  // (`useGspRegionData`); a multi-select (shift-click) or a DNO/NG-zone/national grouping
  // takes the roll-up path (`useGspAggregateData`), which sums `forecasts/period` /
  // `generation/period` across the group's GSP ids at every timestamp with
  // `rollUpRegionSeries`. The two never overlap and never double-fetch: each hook disables
  // itself (a `null` scope) whenever the other one is the active path.
  const isSingleGsp =
    nationalAggregationLevel === NationalAggregation.GSP && selectedRegions.length === 1;
  const gspId = isSingleGsp ? Number(selectedRegions[0]) : undefined;
  const nMinuteForecast = nHourForecast * 60;
  const gspRegionData = useGspRegionData(gspId, isSingleGsp, {
    show: !!(isSingleGsp && show4hView),
    horizonMinutes: nMinuteForecast
  });

  // Resolves the active *group* selection to a flat GSP id list, whatever aggregation level it
  // came from: a raw multi-select is already ids, DNO/zone/national resolve via the grouping
  // file's own key (the same key the map's boundary features carry as their id, so this needs
  // no separate lookup table). `null` when a group selection isn't the active path.
  const { gspIds, groupName } = useMemo(() => {
    if (isSingleGsp) return { gspIds: null, groupName: null };
    if (nationalAggregationLevel === NationalAggregation.GSP) {
      return selectedRegions.length > 0
        ? { gspIds: selectedRegions.map(Number), groupName: `${selectedRegions.length} GSPs` }
        : { gspIds: null, groupName: null };
    }
    const name = selectedRegions[0];
    if (!name) return { gspIds: null, groupName: null };
    const ids = groupGspIds(nationalAggregationLevel, name);
    return ids ? { gspIds: ids, groupName: name } : { gspIds: null, groupName: null };
  }, [isSingleGsp, nationalAggregationLevel, selectedRegions]);

  const gspAggregateData = useGspAggregateData(gspIds, groupName);

  const now30min = formatISODateString(get30MinNow());

  // The active series, whichever of the two paths is live. Both hooks always run (rules of
  // hooks), so this is just picking which result feeds the chart and the header math below.
  const activeForecast = isSingleGsp ? gspRegionData.forecast : gspAggregateData.forecast;
  const activeGenerationSeries = isSingleGsp
    ? gspRegionData.generationSeries
    : gspAggregateData.generationSeries;
  const activePrimaryGeneration = isSingleGsp
    ? gspRegionData.primaryGeneration
    : gspAggregateData.primaryGeneration;
  const gspInstalledCapacity = isSingleGsp
    ? gspRegionData.region?.capacityMw || 0
    : gspAggregateData.capacityMw || 0;
  const dataMissing = isSingleGsp
    ? gspRegionData.isLoading || gspRegionData.hasError
    : gspAggregateData.isLoading || gspAggregateData.hasError;

  let title: string;
  let selectedGSPNames: string[] = [];
  if (isSingleGsp) {
    title = gspRegionData.region?.label || String(selectedRegions[0]);
  } else if (nationalAggregationLevel === NationalAggregation.GSP && selectedRegions.length > 1) {
    title = `${selectedRegions.length} ${String(nationalAggregationLevel)}s selected`;
    // Per-member display names for the tooltip, resolved inside `useGspAggregateData` from the
    // `useRegions` data it already holds — no extra request. Labels ("City Road"), never the
    // raw region names (`citr_1`).
    selectedGSPNames = gspAggregateData.memberLabels;
  } else if (nationalAggregationLevel === NationalAggregation.national) {
    title = "National GSP Sum";
  } else {
    title = groupName || String(selectedRegions[0] ?? "");
  }

  const latestGeneration = latestReading(activePrimaryGeneration);
  const latestPvActualDatetime = latestGeneration?.timeUtc ?? timeNow;
  const pvForecastDatetime = formatISODateString(latestPvActualDatetime);
  const followingPvForecastDatetime = getNext30MinSlot(new Date(latestPvActualDatetime));
  const followingPvForecastDateString = formatISODateString(
    followingPvForecastDatetime.toISOString()
  );
  const forecastAt = (formattedDate: string) =>
    activeForecast?.values.find((v) => formatISODateString(v.timeUtc) === formattedDate)?.powerMw ??
    0;

  const pvTimeOnly = formatISODateStringAsZonedTime(latestPvActualDatetime, timezone, locale);
  const pvValueMw = latestGeneration?.powerMw ?? 0;
  const forecastPvMw = forecastAt(pvForecastDatetime);
  const forecastNextTimeOnly = formatISODateStringAsZonedTime(
    followingPvForecastDatetime.toISOString(),
    timezone,
    locale
  );
  const forecastNextPvMw = forecastAt(followingPvForecastDateString);
  const forecastAtSelectedTimeMw = forecastAt(now30min);
  const deltaValue = dataMissing ? "---" : (pvValueMw - forecastPvMw).toFixed(1);

  const chartData = useFormatChartData({
    forecastSeries: activeForecast,
    nHourSeries: isSingleGsp && show4hView ? gspRegionData.nHour : undefined,
    generationSeries: activeGenerationSeries,
    timeTrigger: selectedTime,
    delta: deltaView,
    gsp: true
  });

  // set ymax to the installed capacity of the graph
  let yMax = gspInstalledCapacity || 100;
  yMax = getRoundedTickBoundary(yMax, Y_MAX_TICKS);

  // If multiple GSPs are selected, hide the N-hour data, if any
  let filteredLines = visibleLines;
  if (selectedRegions.length > 1) {
    filteredLines = visibleLines.filter((line) => !line.includes("N_HOUR_FORECAST"));
  }

  return (
    <>
      <div className="flex-initial">
        <ForecastHeaderGSP
          onClose={close}
          title={title}
          mwpercent={Math.round((forecastAtSelectedTimeMw / (gspInstalledCapacity || 1)) * 100)}
          pvTimeOnly={pvTimeOnly}
          pvValue={pvValueMw.toFixed(1)}
          forecastPV={forecastPvMw.toFixed(1)}
          forecastNextTimeOnly={forecastNextTimeOnly}
          forecastNextPV={forecastNextPvMw.toFixed(1)}
          deltaValue={deltaValue.toString()}
          deltaView={deltaView}
          titleTooltipText={selectedGSPNames}
        >
          <span className="font-semibold dash:3xl:text-5xl dash:xl:text-4xl xl:text-3xl lg:text-2xl md:text-xl text-lg leading-none text-ocf-yellow-500">
            {Math.round(forecastAtSelectedTimeMw)}
          </span>

          <span className="font-semibold dash:3xl:text-5xl dash:xl:text-4xl xl:text-3xl lg:text-2xl md:text-xl text-lg leading-none text-white">
            {" "}
            / {gspInstalledCapacity}
          </span>
          <span className="text-xs dash:text-2xl text-ocf-gray-300"> MW</span>
        </ForecastHeaderGSP>
      </div>
      <div className="flex-1 relative">
        {!!dataMissing && (
          <div className="h-full absolute flex pb-7 items-center justify-center inset-0 z-30">
            <Spinner />
          </div>
        )}
        <RemixLine
          setTimeOfInterest={setTimeOfInterest}
          timeOfInterest={selectedTime}
          data={chartData}
          yMax={yMax!}
          timeNow={timeNow}
          resetTime={resetTime}
          visibleLines={filteredLines}
          deltaView={deltaView}
          deltaYMaxOverride={Math.ceil(Number(gspInstalledCapacity) / 200) * 100 || 500}
          yTicks={getTicks(yMax, Y_MAX_TICKS)}
        />
      </div>
    </>
  );
};

export default GspPvRemixChart;
