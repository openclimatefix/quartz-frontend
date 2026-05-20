import React, { useMemo } from "react";
import RemixLine, { ChartData } from "./remix-line";
import { CombinedData, V1ForecastResponse, V1GenerationResponse } from "../types";
import useGlobalState, { get30MinNow, getNext30MinSlot } from "../helpers/globalState";
import {
  formatISODateString,
  KWtoGW,
  calculateChartYMax,
  convertISODateStringToLondonTime,
  formatISODateAsLondonTime
} from "../helpers/utils";
import { getTicks } from "../helpers/chartUtils";
import { Y_MAX_TICKS, V1_API_PREFIX } from "../../constant";
import { ForecastHeadlineFigure } from "./forecast-header/ui";
import { useStopAndResetTime } from "../hooks/use-and-update-selected-time";
import { CloseButtonIcon } from "../icons/icons";
import { useLoadDataFromApi } from "../hooks/useLoadDataFromApi";
import { DateTime } from "luxon";

const NLRegionalChart: React.FC<{
  combinedData: CombinedData;
  regionName: string;
  onClose: () => void;
  className?: string;
}> = ({ combinedData, regionName, onClose, className }) => {
  const [selectedISOTime, setSelectedISOTime] = useGlobalState("selectedISOTime");
  const [timeNow] = useGlobalState("timeNow");
  const [visibleLines] = useGlobalState("visibleLines");
  const { stopTime, resetTime } = useStopAndResetTime();

  const selectedTime = formatISODateString(selectedISOTime || new Date().toISOString());
  const setSelectedTime = (time: string) => {
    stopTime();
    setSelectedISOTime(time + ":00.000Z");
  };

  const now = DateTime.now().startOf("hour");
  const startUtc = encodeURIComponent(
    now
      .minus({ days: 2, hours: now.hour % 6 })
      .toUTC()
      .toISO() || ""
  );

  const { data: blendForecastData } = useLoadDataFromApi<V1ForecastResponse>(
    regionName
      ? `${V1_API_PREFIX}/NL/solar/regions/${encodeURIComponent(
          regionName
        )}/forecast?start_utc=${startUtc}`
      : null
  );

  const { data: uncurtailedForecastData } = useLoadDataFromApi<V1ForecastResponse>(
    regionName
      ? `${V1_API_PREFIX}/NL/solar/regions/${encodeURIComponent(
          regionName
        )}/forecast?model=ecmwf_mo_sat_uncurtailed&start_utc=${startUtc}`
      : null
  );

  const { data: actualData } = useLoadDataFromApi<V1GenerationResponse>(
    regionName
      ? `${V1_API_PREFIX}/NL/solar/regions/${encodeURIComponent(
          regionName
        )}/generation?start_utc=${startUtc}&observer=ned_nl`
      : null
  );

  const maxGenerationGW = (blendForecastData?.capacity_kW || 1) / 1_000_000;

  const chartData: ChartData[] = useMemo(() => {
    const timeNowFormatted = formatISODateString(get30MinNow());
    const chartMap: Record<string, ChartData> = {};

    actualData?.values.forEach((av) => {
      chartMap[av.time_utc] = {
        ...chartMap[av.time_utc],
        formattedDate: formatISODateString(av.time_utc) || "",
        GENERATION_UPDATED: av.power_kW / 1000
      };
    });

    blendForecastData?.values.forEach((fv) => {
      const isAfterNow = fv.time_utc.slice(0, 16) >= (timeNowFormatted || "");
      chartMap[fv.time_utc] = {
        ...chartMap[fv.time_utc],
        formattedDate: formatISODateString(fv.time_utc) || "",
        [isAfterNow ? "FORECAST" : "PAST_FORECAST"]: fv.power_kW / 1000
      };
    });

    uncurtailedForecastData?.values.forEach((fv) => {
      const isAfterNow = fv.time_utc.slice(0, 16) >= (timeNowFormatted || "");
      chartMap[fv.time_utc] = {
        ...chartMap[fv.time_utc],
        formattedDate: formatISODateString(fv.time_utc) || "",
        [isAfterNow ? "NL_UNCURTAILED" : "PAST_NL_UNCURTAILED"]: fv.power_kW / 1000
      };
    });

    return Object.values(chartMap).sort((a, b) => a.formattedDate.localeCompare(b.formattedDate));
  }, [blendForecastData, uncurtailedForecastData, actualData]);

  const timeNowFormatted = formatISODateString(get30MinNow());
  const yMax = useMemo(
    () => calculateChartYMax(chartData, maxGenerationGW),
    [chartData, maxGenerationGW]
  );

  const {
    currentActualGW,
    currentActualTime,
    currentForecastGW,
    nextForecastGW,
    nextForecastTime
  } = useMemo(() => {
    const sorted = [...(actualData?.values || [])].sort(
      (a, b) => new Date(b.time_utc).getTime() - new Date(a.time_utc).getTime()
    );
    const latestActual = sorted[0];
    const latestISO = latestActual?.time_utc || null;
    const latestFormatted = latestISO ? formatISODateString(latestISO) : timeNowFormatted;

    const nextSlot = latestISO ? getNext30MinSlot(new Date(latestISO)) : null;
    const nextSlotFormatted = nextSlot ? formatISODateString(nextSlot.toISOString()) : null;

    const currentFv = blendForecastData?.values.find(
      (f) => f.time_utc.slice(0, 16) === latestFormatted
    );
    const nextFv = nextSlotFormatted
      ? blendForecastData?.values.find((f) => f.time_utc.slice(0, 16) === nextSlotFormatted)
      : undefined;

    return {
      currentActualGW: latestActual ? KWtoGW(latestActual.power_kW) : "–",
      currentActualTime: latestISO
        ? convertISODateStringToLondonTime(latestISO, "Europe/Amsterdam") || ""
        : "",
      currentForecastGW: currentFv ? KWtoGW(currentFv.power_kW) : "–",
      nextForecastGW: nextFv ? KWtoGW(nextFv.power_kW) : "–",
      nextForecastTime: nextSlot ? formatISODateAsLondonTime(nextSlot, "Europe/Amsterdam") : ""
    };
  }, [blendForecastData, actualData, timeNowFormatted]);

  return (
    <div className={`flex flex-col flex-1 ${className || ""}`}>
      <div
        data-test="nl-regional-chart-header"
        className="flex flex-initial content-between bg-ocf-gray-800 h-auto mb-4"
      >
        <div className="dash:xl:text-2xl dash:2xl:text-3xl dash:3xl:text-4xl text-white lg:text-xl md:text-lg text-lg font-black m-auto ml-5 flex justify-evenly">
          {regionName}
        </div>
        <div className="flex justify-between flex-2 my-2 dash:3xl:my-3 px-2 lg:px-4 3xl:px-6">
          <div className="pr-4 lg:pr-4 3xl:pr-6">
            <ForecastHeadlineFigure
              gsp={true}
              tip="PV Live / OCF Forecast"
              time={currentActualTime}
              color="ocf-yellow"
            >
              <span className="text-black">{currentActualGW}</span>
              <span className="text-ocf-gray-300 mx-1"> / </span>
              {currentForecastGW}
            </ForecastHeadlineFigure>
          </div>
          <div>
            <ForecastHeadlineFigure
              gsp={true}
              tip="Next OCF Forecast"
              time={nextForecastTime}
              color="ocf-yellow"
            >
              {nextForecastGW}
            </ForecastHeadlineFigure>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="font-bold items-center p-2 text-2xl border-ocf-gray-800 text-white bg-ocf-gray-800 hover:bg-ocf-gray-700 focus:z-10 focus:text-white h-auto"
        >
          <CloseButtonIcon />
        </button>
      </div>
      <div className="flex-1 relative">
        <RemixLine
          timeNow={formatISODateString(timeNow)}
          timeOfInterest={selectedTime || ""}
          setTimeOfInterest={setSelectedTime}
          data={chartData}
          yMax={yMax}
          yTicks={getTicks(yMax, Y_MAX_TICKS)}
          visibleLines={visibleLines}
          resetTime={resetTime}
          timezone="Europe/Amsterdam"
          lineLabels={{
            GENERATION_UPDATED: "NED NL",
            GENERATION: "NED NL",
            NL_UNCURTAILED: "Uncurtailed",
            PAST_NL_UNCURTAILED: "Uncurtailed"
          }}
        />
      </div>
    </div>
  );
};

export default NLRegionalChart;
