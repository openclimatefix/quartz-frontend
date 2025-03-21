import { FC, useEffect, useMemo, useState } from "react";
import RemixLine from "./remix-line";
import ForecastHeader from "./forecast-header";
import useGlobalState from "../helpers/globalState";
import useFormatChartData from "./use-format-chart-data";
import { formatISODateString } from "../helpers/utils";
import GspPvRemixChart from "./gsp-pv-remix-chart";
import { useStopAndResetTime } from "../hooks/use-and-update-selected-time";
import Spinner from "../icons/spinner";
import { MAX_NATIONAL_GENERATION_MW } from "../../constant";
import useHotKeyControlChart from "../hooks/use-hot-key-control-chart";
import { CombinedData, CombinedErrors } from "../types";
import { ChartLegend } from "./ChartLegend";
import DataLoadingChartStatus from "./DataLoadingChartStatus";
import { calculateChartYMax } from "../helpers/utils";

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
  const [loadingState] = useGlobalState("loadingState");
  const [globalZoomArea] = useGlobalState("globalZoomArea");

  const {
    nationalForecastData,
    pvRealDayInData,
    pvRealDayAfterData,
    nationalNHourData,
    allGspForecastData,
    allGspRealData,
    allGspSystemData,
    gspDeltas
  } = combinedData;
  const {
    nationalForecastError,
    pvRealDayInError,
    pvRealDayAfterError,
    nationalNHourError,
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
    fourHourData: nationalNHourData,
    pvRealDayInData,
    pvRealDayAfterData,
    timeTrigger: selectedTime
  });

  const yMax = useMemo(() => {
    return calculateChartYMax(chartData, MAX_NATIONAL_GENERATION_MW);
  }, [chartData]);

  if (
    nationalForecastError ||
    pvRealDayInError ||
    pvRealDayAfterError ||
    nationalNHourError ||
    allGspForecastError
  )
    return <div className={`${className}`}>failed to load</div>;

  const setSelectedTime = (time: string) => {
    stopTime();
    setSelectedISOTime(time + ":00.000Z");
  };

  return (
    <>
      <div className={`flex flex-col flex-auto ${className || ""}`}>
        <div className="flex flex-col flex-1 dash:h-auto">
          <ForecastHeader
            pvForecastData={nationalForecastData || []}
            pvLiveData={pvRealDayInData || []}
            deltaView={false}
          ></ForecastHeader>
          {(!nationalForecastData || !pvRealDayInData || !pvRealDayAfterData) && (
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
            />
          </div>
        </div>
        {clickedGspId && (
          <div className="flex-1 flex flex-col relative dash:h-auto">
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
          </div>
        )}
      </div>
      {!className?.includes("hidden") && <ChartLegend />}
    </>
  );
};

export default PvRemixChart;
