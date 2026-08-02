import React, { useMemo } from "react";
import RemixLine, { ChartData } from "./remix-line";
import { CombinedData, Country } from "../types";
import useGlobalState, { get30MinNow, getNext30MinSlot } from "../helpers/globalState";
import {
  formatISODateString,
  KWtoGW,
  calculateChartYMax,
  convertISODateStringToLondonTime,
  formatISODateAsLondonTime
} from "../helpers/utils";
import { getTicks } from "../helpers/chartUtils";
import { Y_MAX_TICKS } from "../../constant";
import { ForecastHeadlineFigure } from "./forecast-header/ui";
import { useStopAndResetTime } from "../hooks/use-and-update-selected-time";
import CountryToggle from "./country-toggle";

const NL_NATIONAL_Y_MAX = 20000;

const NLNationalChart: React.FC<{
  combinedData: CombinedData;
  className?: string;
  selectedCountry?: Country;
  setSelectedCountry?: (c: Country) => void;
}> = ({ combinedData, className, selectedCountry, setSelectedCountry }) => {
  const [selectedISOTime, setSelectedISOTime] = useGlobalState("selectedISOTime");
  const [timeNow] = useGlobalState("timeNow");
  const [visibleLines] = useGlobalState("visibleLines");
  const { stopTime, resetTime } = useStopAndResetTime();

  const nlForecastData = combinedData?.nlForecastData;
  const nlUncurtailedForecastData = combinedData?.nlUncurtailedForecastData;
  const nlActualData = combinedData?.nlActualData;

  const selectedTime = formatISODateString(selectedISOTime || new Date().toISOString());

  const setSelectedTime = (time: string) => {
    stopTime();
    setSelectedISOTime(time + ":00.000Z");
  };

  const chartData: ChartData[] = useMemo(() => {
    const timeNowFormatted = formatISODateString(get30MinNow());
    const chartMap: Record<string, ChartData> = {};

    nlActualData?.values.forEach((av) => {
      chartMap[av.time_utc] = {
        ...chartMap[av.time_utc],
        formattedDate: formatISODateString(av.time_utc) || "",
        GENERATION_UPDATED: av.power_kW / 1000
      };
    });

    nlForecastData?.values.forEach((fv) => {
      const isAfterNow = fv.time_utc.slice(0, 16) >= (timeNowFormatted || "");
      const isNow = fv.time_utc.slice(0, 16) === (timeNowFormatted || "");
      chartMap[fv.time_utc] = {
        ...chartMap[fv.time_utc],
        formattedDate: formatISODateString(fv.time_utc) || "",
        [isAfterNow ? "FORECAST" : "PAST_FORECAST"]: fv.power_kW / 1000,
        ...(isNow && { PAST_FORECAST: fv.power_kW / 1000 })
      };
    });

    nlUncurtailedForecastData?.values.forEach((fv) => {
      const isAfterNow = fv.time_utc.slice(0, 16) >= (timeNowFormatted || "");
      const isNow = fv.time_utc.slice(0, 16) === (timeNowFormatted || "");
      chartMap[fv.time_utc] = {
        ...chartMap[fv.time_utc],
        formattedDate: formatISODateString(fv.time_utc) || "",
        [isAfterNow ? "NL_UNCURTAILED" : "PAST_NL_UNCURTAILED"]: fv.power_kW / 1000,
        ...(isNow && { PAST_NL_UNCURTAILED: fv.power_kW / 1000 })
      };
    });

    return Object.values(chartMap).sort((a, b) => a.formattedDate.localeCompare(b.formattedDate));
  }, [nlForecastData, nlUncurtailedForecastData, nlActualData]);

  const timeNowFormatted = formatISODateString(get30MinNow());

  const yMax = useMemo(() => calculateChartYMax(chartData, NL_NATIONAL_Y_MAX), [chartData]);

  const {
    currentActualGW,
    currentActualTime,
    currentForecastGW,
    nextForecastGW,
    nextForecastTime
  } = useMemo(() => {
    const sorted = [...(nlActualData?.values || [])].sort(
      (a, b) => new Date(b.time_utc).getTime() - new Date(a.time_utc).getTime()
    );
    const latestActual = sorted[0];
    const latestISO = latestActual?.time_utc || null;
    const latestFormatted = latestISO ? formatISODateString(latestISO) : timeNowFormatted;

    const nextSlot = latestISO ? getNext30MinSlot(new Date(latestISO)) : null;
    const nextSlotFormatted = nextSlot ? formatISODateString(nextSlot.toISOString()) : null;

    const currentFv = nlForecastData?.values.find(
      (f) => f.time_utc.slice(0, 16) === latestFormatted
    );
    const nextFv = nextSlotFormatted
      ? nlForecastData?.values.find((f) => f.time_utc.slice(0, 16) === nextSlotFormatted)
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
  }, [nlForecastData, nlActualData, timeNowFormatted]);

  return (
    <div className={`flex flex-col flex-1 ${className || ""}`}>
      <div
        data-test="nl-national-chart-header"
        className="flex flex-initial content-between bg-ocf-gray-800 h-auto mb-4"
      >
        <div className="m-auto ml-1 flex items-center">
          {selectedCountry && setSelectedCountry ? (
            <CountryToggle selected={selectedCountry} onChange={setSelectedCountry} size="title" />
          ) : (
            <span className="text-white dash:3xl:text-5xl dash:2xl:text-4xl dash:xl:text-3xl dash:tracking-wide lg:text-2xl md:text-lg text-base font-black">
              Netherlands
            </span>
          )}
        </div>
        <div className="flex justify-between flex-2 my-2 dash:3xl:my-3 px-2 lg:px-4 3xl:px-6">
          <div className="pr-4 lg:pr-4 3xl:pr-6">
            <ForecastHeadlineFigure
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
              tip="Next OCF Forecast"
              time={nextForecastTime}
              color="ocf-yellow"
            >
              {nextForecastGW}
            </ForecastHeadlineFigure>
          </div>
        </div>
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

export default NLNationalChart;
