import { FC, useMemo, useState } from "react";
import RemixLine from "./remix-line";
import Line from "./remix-line";
import useSWR from "swr";
import { API_PREFIX } from "../../constant";
import ForecastHeader from "./forecast-header";
import useGlobalState from "../helpers/globalState";
import useFormatChartData from "./use-format-chart-data";
import { axiosFetcher, getRounded4HoursAgoString, formatISODateString } from "../helpers/utils";
import GspPvRemixChart from "./gsp-pv-remix-chart";
import { useStopAndResetTime } from "../hooks/use-and-update-selected-time";
import Spinner from "../icons/spinner";
import { MAX_NATIONAL_GENERATION_MW } from "../../constant";
import useHotKeyControlChart from "../hooks/use-hot-key-control-chart";
import { InfoIcon, LegendLineGraphIcon } from "../icons/icons";
import { ForecastData, ForecastValue } from "../types";

const LegendItem: FC<{
  iconClasses: string;
  label: string;
  dashed?: boolean;
  dataKey: string;
}> = ({ iconClasses, label, dashed, dataKey }) => {
  const [visibleLines, setVisibleLines] = useGlobalState("visibleLines");
  const isVisible = visibleLines.includes(dataKey);

  const toggleLineVisibility = () => {
    if (isVisible) {
      setVisibleLines(visibleLines.filter((line) => line !== dataKey));
    } else {
      setVisibleLines([...visibleLines, dataKey]);
    }
  };

  return (
    <div className="flex items-center">
      <LegendLineGraphIcon className={iconClasses} dashed={dashed} />
      <button className="text-left pl-1 max-w-full w-44" onClick={toggleLineVisibility}>
        <span className={`uppercase pl-1${isVisible ? " font-extrabold" : ""}`}>{label}</span>
      </button>
    </div>
  );
};

const PvRemixChart: FC<{ date?: string; className?: string }> = ({ className }) => {
  const [clickedGspId, setClickedGspId] = useGlobalState("clickedGspId");
  const [visibleLines] = useGlobalState("visibleLines");
  const [selectedISOTime, setSelectedISOTime] = useGlobalState("selectedISOTime");
  const [timeNow] = useGlobalState("timeNow");
  const [forecastCreationTime] = useGlobalState("forecastCreationTime");
  const { stopTime, resetTime } = useStopAndResetTime();
  const selectedTime = formatISODateString(selectedISOTime || new Date().toISOString());
  const { data: nationalForecastData, error } = useSWR<ForecastData>(
    `${API_PREFIX}/solar/GB/national/forecast?historic=false&only_forecast_values=true`,
    axiosFetcher,
    {
      refreshInterval: 60 * 1000 * 5 // 5min
    }
  );

  const chartLimits = useMemo(
    () =>
      nationalForecastData && {
        start: nationalForecastData[0].targetTime,
        end: nationalForecastData[nationalForecastData.length - 1].targetTime
      },
    [nationalForecastData]
  );
  useHotKeyControlChart(chartLimits);

  const { data: pvRealDayInData, error: error2 } = useSWR<
    {
      datetimeUtc: string;
      solarGenerationKw: number;
    }[]
  >(`${API_PREFIX}/solar/GB/national/pvlive?regime=in-day`, axiosFetcher, {
    refreshInterval: 60 * 1000 * 5 // 5min
  });

  const { data: pvRealDayAfterData, error: error3 } = useSWR<
    {
      datetimeUtc: string;
      solarGenerationKw: number;
    }[]
  >(`${API_PREFIX}/solar/GB/national/pvlive?regime=day-after`, axiosFetcher, {
    refreshInterval: 60 * 1000 * 5 // 5min
  });

  const { data: national4HourData, error: pv4HourError } = useSWR<ForecastValue[]>(
    `${API_PREFIX}/solar/GB/national/forecast?forecast_horizon_minutes=240&historic=true&only_forecast_values=true`,
    axiosFetcher,
    {
      refreshInterval: 60 * 1000 * 5 // 5min
    }
  );

  const chartData = useFormatChartData({
    forecastData: nationalForecastData,
    fourHourData: national4HourData,
    pvRealDayInData,
    pvRealDayAfterData,
    timeTrigger: selectedTime
  });

  if (error || error2 || error3 || pv4HourError) return <div>failed to load</div>;
  if (!nationalForecastData || !pvRealDayInData || !pvRealDayAfterData || !national4HourData)
    return (
      <div className="h-full flex">
        <Spinner></Spinner>
      </div>
    );

  const setSelectedTime = (time: string) => {
    stopTime();
    setSelectedISOTime(time + ":00.000Z");
  };
  const fourHoursAgo = getRounded4HoursAgoString();
  return (
    <div className={`flex flex-col flex-1 mb-1 ${className || ""}`}>
      <div className="flex-grow mb-7">
        <ForecastHeader
          pvForecastData={nationalForecastData}
          pvLiveData={pvRealDayInData}
        ></ForecastHeader>

        <div className="h-60 mt-4 mb-10">
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
      <div className="flex flex-row justify-between px-8 text-xs tracking-wider text-ocf-gray-300 py-2 bg-mapbox-black-500 overflow-x-scroll">
        <div className="flex-0 flex-col">
          <LegendItem
            iconClasses={"text-ocf-black"}
            dashed
            label={"PV live initial estimate"}
            dataKey={`GENERATION`}
          />
          <LegendItem
            iconClasses={"text-ocf-black"}
            label={"PV live updated"}
            dataKey={`GENERATION_UPDATED`}
          />
        </div>
        <div className="flex-0 flex-col">
          <LegendItem
            iconClasses={"text-ocf-yellow"}
            dashed
            label={"OCF Forecast"}
            dataKey={`FORECAST`}
          />
          <LegendItem
            iconClasses={"text-ocf-yellow"}
            label={"OCF Final Forecast"}
            dataKey={`PAST_FORECAST`}
          />
        </div>
        <div className="flex-0 flex-col">
          <LegendItem
            iconClasses={"text-ocf-orange"}
            dashed
            label={`OCF ${fourHoursAgo} Forecast`}
            dataKey={`4HR_FORECAST`}
          />
          <LegendItem
            iconClasses={"text-ocf-orange"}
            label={"OCF 4hr Forecast"}
            dataKey={`4HR_PAST_FORECAST`}
          />
        </div>
        <div className="flex-0 flex-col flex-start">
          <InfoIcon />
        </div>
      </div>
    </div>
  );
};

export default PvRemixChart;
