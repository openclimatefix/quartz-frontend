import { FC, useMemo, useState } from "react";
import RemixLine from "./remix-line";
import Line from "./remix-line";
import useSWR from "swr";
import { API_PREFIX } from "../../constant";
import ForecastHeader from "./forecast-header";
import useGlobalState from "../helpers/globalState";
import useFormatChartData from "./use-format-chart-data";
import {
  getRounded4HoursAgoString,
  formatISODateString,
  axiosFetcherAuth,
  convertISODateStringToLondonTime
} from "../helpers/utils";
import GspPvRemixChart from "./gsp-pv-remix-chart";
import { useStopAndResetTime } from "../hooks/use-and-update-selected-time";
import Spinner from "../icons/spinner";
import { MAX_NATIONAL_GENERATION_MW } from "../../constant";
import useHotKeyControlChart from "../hooks/use-hot-key-control-chart";
import { InfoIcon, LegendLineGraphIcon } from "../icons/icons";
import { CombinedData, CombinedErrors, ForecastData, ForecastValue } from "../types";
import Tooltip from "../tooltip";
import { ChartInfo } from "../../ChartInfo";
import { ChartLegend } from "./ChartLegend";

const PvRemixChart: FC<{
  combinedData: CombinedData;
  combinedErrors: CombinedErrors;
  date?: string;
  className?: string;
}> = ({ combinedData, combinedErrors, className }) => {
  const [clickedGspId, setClickedGspId] = useGlobalState("clickedGspId");
  const [visibleLines] = useGlobalState("visibleLines");
  const [selectedISOTime, setSelectedISOTime] = useGlobalState("selectedISOTime");
  const [timeNow] = useGlobalState("timeNow");
  const [forecastCreationTime] = useGlobalState("forecastCreationTime");
  const { stopTime, resetTime } = useStopAndResetTime();
  const selectedTime = formatISODateString(selectedISOTime || new Date().toISOString());

  const {
    nationalForecastData,
    pvRealDayInData,
    pvRealDayAfterData,
    national4HourData,
    allGspForecastData,
    allGspRealData,
    gspDeltas
  } = combinedData;
  const {
    nationalForecastError,
    pvRealDayInError,
    pvRealDayAfterError,
    national4HourError,
    allGspForecastError
  } = combinedErrors;

  const chartLimits = useMemo(
    () =>
      nationalForecastData?.[0] && {
        start: nationalForecastData[0].targetTime,
        end: nationalForecastData[nationalForecastData.length - 1].targetTime
      },

    [nationalForecastData]
  );
  useHotKeyControlChart(chartLimits);

  const chartData = useFormatChartData({
    forecastData: nationalForecastData,
    probabilisticRangeData: nationalForecastData,
    fourHourData: national4HourData,
    pvRealDayInData,
    pvRealDayAfterData,
    timeTrigger: selectedTime
  });

  if (
    nationalForecastError ||
    pvRealDayInError ||
    pvRealDayAfterError ||
    national4HourError ||
    allGspForecastError
  )
    return <div className={`${className}`}>failed to load</div>;

  const setSelectedTime = (time: string) => {
    stopTime();
    setSelectedISOTime(time + ":00.000Z");
  };

  return (
    <div className={`flex flex-col flex-1 mb-1 ${className || ""}`}>
      <div className="flex flex-col flex-auto">
        <ForecastHeader
          pvForecastData={nationalForecastData || []}
          pvLiveData={pvRealDayInData || []}
          deltaView={false}
        ></ForecastHeader>

        <div className="flex-1 relative h-60 dash:h-auto mt-4">
          {(!nationalForecastData || !pvRealDayInData || !pvRealDayAfterData) && (
            <div
              className={`h-full absolute flex pb-7 items-center justify-center inset-0 z-30 ${className}`}
            >
              <Spinner></Spinner>
            </div>
          )}
          <RemixLine
            resetTime={resetTime}
            timeNow={formatISODateString(timeNow)}
            timeOfInterest={selectedTime}
            setTimeOfInterest={setSelectedTime}
            data={chartData}
            yMax={MAX_NATIONAL_GENERATION_MW}
            visibleLines={visibleLines}
          />
        </div>
        <div className="flex-1 flex flex-col relative h-60 dash:h-auto">
          {clickedGspId && (
            <GspPvRemixChart
              close={() => {
                setClickedGspId(undefined);
              }}
              setTimeOfInterest={setSelectedTime}
              selectedTime={selectedTime}
              gspId={clickedGspId}
              timeNow={formatISODateString(timeNow)}
              resetTime={resetTime}
              visibleLines={visibleLines}
            ></GspPvRemixChart>
          )}
        </div>
      </div>
      <ChartLegend />
    </div>
  );
};

export default PvRemixChart;
