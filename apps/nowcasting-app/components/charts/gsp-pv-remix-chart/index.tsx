import RemixLine from "../remix-line";
import useFormatChartData from "../use-format-chart-data";
import {
  formatISODateString,
  formatISODateStringAsZonedTime,
  getRoundedTickBoundary
} from "../../helpers/utils";
import { useCountryFormatting } from "../../../hooks/data/use-country-format";
import ForecastHeaderGSP from "./forecast-header-gsp";
import { useGspAggregateData, useGspRegionData, useGspRegionNames } from "./use-gsp-region-data";
import { useCurrentAggregationLevel } from "../../../hooks/data";
import { useLevelGroupings } from "../../../hooks/data/use-map-geometry";
import { groupRegionNames } from "../../helpers/data";
import useGlobalState, {
  useCountryState,
  get30MinNow,
  getNext30MinSlot
} from "../../helpers/globalState";
import Spinner from "../../icons/spinner";
import React, { FC, useMemo } from "react";
import { getTicks } from "../../helpers/chartUtils";
import { Y_MAX_TICKS } from "../../../constant";
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
  // `nationalAggregationLevel` is a region type name now, not the enum (Phase 5 seam 1). This
  // component is GB's GSP-specific chart — `useGspRegionData` below hardcodes the `"gsp"`
  // region type — so the check is a genuine identity match, not a stand-in for `derived`.
  const isSingleGsp = nationalAggregationLevel === "gsp" && selectedRegions.length === 1;
  const gspId = isSingleGsp ? Number(selectedRegions[0]) : undefined;
  const nMinuteForecast = nHourForecast * 60;
  const gspRegionData = useGspRegionData(gspId, isSingleGsp, {
    show: !!(isSingleGsp && show4hView),
    horizonMinutes: nMinuteForecast
  });

  // Resolves the active *group* selection to a flat list of v1 region names, whatever level
  // it came from. `null` when a group selection isn't the active path.
  //
  // **The branch is on `level.derived`, not on the level's name.** A derived level (GB's DNO
  // and NG zone) selects a *group*, and its Mapbox feature id is that group's key in the
  // grouping file — so one lookup resolves it. A non-derived level selects regions directly,
  // and at GSP level its feature ids are numeric, so they go through `useGspRegionNames`.
  //
  // That distinction is the fix for the regression this path carried through Phase 5. The old
  // code looked the level up in a table keyed by `NationalAggregation`'s capitalised values
  // ("DNO", "Zone"); when Track B changed the stored level to the registry's lowercase region
  // type name ("dno", "zone") every lookup missed, `groupGspIds` returned `undefined`, and the
  // grouped chart silently drew nothing — no error, no type error, just an empty panel. There
  // is now no name-keyed table left to mismatch: `useLevelGroupings` resolves the URL from
  // `config/countries.ts` using the level's own `regionType`, and the group name comes from
  // the asset itself.
  const level = useCurrentAggregationLevel();
  const groupings = useLevelGroupings(level);

  const isGroupSelection = !isSingleGsp && !!level?.derived;
  const groupName = isGroupSelection ? selectedRegions[0] ?? null : null;
  const groupRegions = useMemo(
    () => (groupName ? groupRegionNames(groupings.data, groupName) ?? null : null),
    [groupings.data, groupName]
  );

  // A multi-select at a non-derived level: the feature ids are the map's, numeric at GSP
  // level, so they need translating to region names before anything can be summed.
  const multiSelectIds = useMemo(
    () => (!isSingleGsp && !level?.derived && selectedRegions.length > 0 ? selectedRegions : null),
    [isSingleGsp, level?.derived, selectedRegions]
  );
  const multiSelectNames = useGspRegionNames(multiSelectIds);

  const selection = useMemo(
    () =>
      isGroupSelection
        ? { regionNames: groupRegions, groupName }
        : {
            regionNames: multiSelectNames,
            groupName: multiSelectNames ? `${selectedRegions.length} GSPs` : null
          },
    [isGroupSelection, groupRegions, groupName, multiSelectNames, selectedRegions.length]
  );

  const gspAggregateData = useGspAggregateData(selection.regionNames, selection.groupName);

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
  } else if (nationalAggregationLevel === "gsp" && selectedRegions.length > 1) {
    // Was `${nationalAggregationLevel}s selected` off the enum's "GSP" value ("GSPs
    // selected"); the region-type name is lowercase now, so this is hardcoded to keep the
    // same visible copy rather than silently becoming "gsps selected".
    title = `${selectedRegions.length} GSPs selected`;
    // Per-member display names for the tooltip, resolved inside `useGspAggregateData` from the
    // `useRegions` data it already holds — no extra request. Labels ("City Road"), never the
    // raw region names (`citr_1`).
    selectedGSPNames = gspAggregateData.memberLabels;
  } else if (nationalAggregationLevel === "national") {
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
