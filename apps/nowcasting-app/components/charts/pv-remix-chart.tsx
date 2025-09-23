import { FC, useEffect, useMemo, useState } from "react";
import RemixLine from "./remix-line";
import ForecastHeader from "./forecast-header";
import useGlobalState from "../helpers/globalState";
import useFormatChartData from "./use-format-chart-data";
import { formatISODateString } from "../helpers/utils";
import GspPvRemixChart from "./gsp-pv-remix-chart";
import { useStopAndResetTime } from "../hooks/use-and-update-selected-time";
import Spinner from "../icons/spinner";
import { MAX_NATIONAL_GENERATION_MW, Y_MAX_TICKS } from "../../constant";
import useHotKeyControlChart from "../hooks/use-hot-key-control-chart";
import { CombinedData, CombinedErrors } from "../types";
import { ChartLegend } from "./ChartLegend";
import DataLoadingChartStatus from "./DataLoadingChartStatus";
import { calculateChartYMax } from "../helpers/utils";
import { getTicks } from "../helpers/chartUtils";

const PvRemixChart: FC<{
  combinedData: CombinedData;
  combinedErrors: CombinedErrors;
  date?: string;
  className?: string;
}> = ({ combinedData, combinedErrors, className }) => {
  const [selectedMapRegionIds, setSelectedMapRegionIds] = useGlobalState("selectedMapRegionIds");
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

  const hasError = Object.entries(combinedErrors).some(([, value]) => value !== null);

  const setSelectedTime = (time: string) => {
    stopTime();
    setSelectedISOTime(time + ":00.000Z");
  };

  let selectedRegions: string[] = [];
  if (selectedMapRegionIds && selectedMapRegionIds.length > 0) {
    selectedRegions = selectedMapRegionIds.map((id) => String(id));
  }

  return (
    <>
      <div className={`flex flex-col flex-auto ${className || ""}`}>
        <div className="flex flex-col flex-1 dash:h-auto">
          <ForecastHeader
            pvForecastData={nationalForecastData || []}
            pvLiveData={pvRealDayInData || []}
            deltaView={false}
          ></ForecastHeader>
          {(!nationalForecastData || !pvRealDayInData || !pvRealDayAfterData) && !hasError && (
            <div
              className={`h-full absolute flex pb-7 items-center justify-center inset-0 z-30 ${className}`}
            >
              <Spinner></Spinner>
            </div>
          )}
          <div id="PVRemiwChart" className="flex-1 relative">
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
