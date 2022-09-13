import { FC, useMemo } from "react";
import RemixLine from "./remix-line";
import useSWR from "swr";
import { API_PREFIX } from "../../constant";
import ForecastHeader from "./forecast-header";
import useGlobalState from "../globalState";
import useFormatChartData from "./use-format-chart-data";
import { axiosFetcher, convertISODateStringToLondonTime, formatISODateString } from "../utils";
import GspPvRemixChart from "./gsp-pv-remix-chart";
import { useStopAndResetTime } from "../hooks/use-and-update-selected-time";
import Spinner from "../spinner";
import { MAX_NATIONAL_GENERATION_MW } from "../../constant";
import useHotKeyControlChart from "../hooks/use-hot-key-control-chart";
import { LegendLineGraphIcon } from "../icons";
import { ForecastData } from "../types";

const LegendItem: FC<{ iconClasses: string; label: string; dashed?: boolean }> = ({
  iconClasses,
  label,
  dashed
}) => (
  <div className="flex items-center">
    <LegendLineGraphIcon className={iconClasses} dashed={dashed} />
    <span className="uppercase pl-1">{label}</span>
  </div>
);

const PvRemixChart: FC<{ date?: string }> = () => {
  const [clickedGspId, setClickedGspId] = useGlobalState("clickedGspId");
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

  const { data: national4HourData, error: pv4HourError } = useSWR<
    {
      targetTime: string;
      expectedPowerGenerationMegawatts: number;
    }[]
  >(`${API_PREFIX}/GB/solar/gsp/forecast/latest/0?forecast_horizon_minutes=240`, axiosFetcher, {
    refreshInterval: 60 * 1000 * 5, // 5min
  });

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
  const fourHoursAgo = new Date();
  fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);
  fourHoursAgo.setMinutes(0);
  const fourHoursAgoString = convertISODateStringToLondonTime(fourHoursAgo.toISOString());
  return (
    <div className="flex flex-col flex-1 mt-12 mb-1">
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
          ></GspPvRemixChart>
        )}
      </div>
      <div className="flex-0 px-3 text-[12px] tracking-wider text-ocf-gray-300 py-2 bg-mapbox-black-500">
        <div className="flex justify-around">
          <div className="flex-col">
            <LegendItem iconClasses={"text-ocf-black"} dashed label={"PVlive initial estimate"} />
            <LegendItem iconClasses={"text-ocf-black"} label={"PVlive updated"} />
          </div>
          <div className="flex-col">
            <LegendItem iconClasses={"text-ocf-yellow"} dashed label={"OCF Forecast"} />
            <LegendItem iconClasses={"text-ocf-yellow"} label={"OCF Final Forecast"} />
          </div>
          <div className="flex-col">
            <LegendItem
              iconClasses={"text-ocf-teal"}
              dashed
              label={`OCF ${fourHoursAgoString} Forecast`}
            />
            <LegendItem iconClasses={"text-ocf-teal"} label={"OCF 4 Hr Forecast"} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PvRemixChart;
