import React, { useMemo } from "react";
import RemixLine, { ChartData } from "./remix-line";
import { CombinedData } from "../types";
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

const NL_NATIONAL_Y_MAX = 20000;

// Sites API returns datetimes as epoch seconds, epoch ms, or ISO strings depending on endpoint.
// Normalise all three to ISO string before any date processing.
const toISO = (dt: string): string => {
  if (/^\d+$/.test(dt)) {
    const ms = dt.length <= 11 ? Number(dt) * 1000 : Number(dt);
    return new Date(ms).toISOString();
  }
  return dt;
};

const NlNationalChart: React.FC<{
  combinedData: CombinedData;
  className?: string;
}> = ({ combinedData, className }) => {
  const [selectedISOTime, setSelectedISOTime] = useGlobalState("selectedISOTime");
  const [timeNow] = useGlobalState("timeNow");
  const [visibleLines] = useGlobalState("visibleLines");
  const { stopTime, resetTime } = useStopAndResetTime();

  const nlForecastData = combinedData?.nlForecastData;
  const nlActualData = combinedData?.nlActualData;

  const selectedTime = formatISODateString(selectedISOTime || new Date().toISOString());

  const setSelectedTime = (time: string) => {
    stopTime();
    setSelectedISOTime(time + ":00.000Z");
  };

  const chartData: ChartData[] = useMemo(() => {
    const timeNowFormatted = formatISODateString(get30MinNow());
    const chartMap: Record<string, ChartData> = {};
    // NL data is 5-minutely; keep only half-hour slots to match RemixLine's interval=11 assumption
    const is30MinSlot = (iso: string) => {
      const mins = new Date(iso).getUTCMinutes();
      return mins === 0 || mins === 30;
    };

    nlActualData?.pv_actual_values.forEach((av) => {
      const iso = toISO(av.datetime_utc);
      if (!is30MinSlot(iso)) return;
      chartMap[iso] = {
        ...chartMap[iso],
        formattedDate: formatISODateString(iso) || "",
        GENERATION_UPDATED: av.actual_generation_kw / 1000
      };
    });

    nlForecastData?.forecast_values.forEach((fv) => {
      const iso = toISO(fv.target_datetime_utc);
      if (!is30MinSlot(iso)) return;
      const isAfterNow = iso.slice(0, 16) >= (timeNowFormatted || "");
      chartMap[iso] = {
        ...chartMap[iso],
        formattedDate: formatISODateString(iso) || "",
        [isAfterNow ? "FORECAST" : "PAST_FORECAST"]: fv.expected_generation_kw / 1000
      };
    });

    return Object.values(chartMap).sort((a, b) => a.formattedDate.localeCompare(b.formattedDate));
  }, [nlForecastData, nlActualData]);

  const timeNowFormatted = formatISODateString(get30MinNow());

  const yMax = useMemo(() => calculateChartYMax(chartData, NL_NATIONAL_Y_MAX), [chartData]);

  const {
    currentActualGW,
    currentActualTime,
    currentForecastGW,
    nextForecastGW,
    nextForecastTime
  } = useMemo(() => {
    const sorted = [...(nlActualData?.pv_actual_values || [])].sort(
      (a, b) =>
        new Date(toISO(b.datetime_utc)).getTime() - new Date(toISO(a.datetime_utc)).getTime()
    );
    const latestActual = sorted[0];
    const latestISO = latestActual ? toISO(latestActual.datetime_utc) : null;
    const latestFormatted = latestISO ? formatISODateString(latestISO) : timeNowFormatted;

    const nextSlot = latestISO ? getNext30MinSlot(new Date(latestISO)) : null;
    const nextSlotFormatted = nextSlot ? formatISODateString(nextSlot.toISOString()) : null;

    const currentFv = nlForecastData?.forecast_values.find(
      (f) => toISO(f.target_datetime_utc).slice(0, 16) === latestFormatted
    );
    const nextFv = nextSlotFormatted
      ? nlForecastData?.forecast_values.find(
          (f) => toISO(f.target_datetime_utc).slice(0, 16) === nextSlotFormatted
        )
      : undefined;

    return {
      currentActualGW: latestActual ? KWtoGW(latestActual.actual_generation_kw) : "–",
      currentActualTime: latestISO ? convertISODateStringToLondonTime(latestISO) || "" : "",
      currentForecastGW: currentFv ? KWtoGW(currentFv.expected_generation_kw) : "–",
      nextForecastGW: nextFv ? KWtoGW(nextFv.expected_generation_kw) : "–",
      nextForecastTime: nextSlot ? formatISODateAsLondonTime(nextSlot) : ""
    };
  }, [nlForecastData, nlActualData, timeNowFormatted]);

  return (
    <div className={`flex flex-col flex-1 ${className || ""}`}>
      <div
        data-test="nl-national-chart-header"
        className="flex flex-initial content-between bg-ocf-gray-800 h-auto mb-4"
      >
        <div className="text-white dash:3xl:text-5xl dash:2xl:text-4xl dash:xl:text-3xl dash:tracking-wide lg:text-2xl md:text-lg text-base font-black m-auto ml-5 flex justify-evenly">
          Netherlands
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
        />
      </div>
    </div>
  );
};

export default NlNationalChart;
