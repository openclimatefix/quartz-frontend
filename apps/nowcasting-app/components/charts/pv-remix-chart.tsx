import { FC, useMemo } from "react";
import RemixLine from "./remix-line";
import useSWR from "swr";
import { API_PREFIX } from "../../constant";
import ForecastHeader from "./forecast-header";
import useGlobalState from "../globalState";
import useFormatChartData from "./use-format-chart-data";
import { axiosFetcher, formatISODateString } from "../utils";
import GspPvRemixChart from "./gsp-pv-remix-chart";
import { useStopAndResetTime } from "../hooks/use-and-update-selected-time";
import Spinner from "../spinner";
import { MAX_NATIONAL_GENERATION_MW } from "../../constant";
import useHotKeyControlChart from "../hooks/use-hot-key-control-chart";

const PvRemixChart: FC<{ date?: string }> = (props) => {
  const [clickedGspId, setClickedGspId] = useGlobalState("clickedGspId");
  const [selectedISOTime, setSelectedISOTime] = useGlobalState("selectedISOTime");
  const [forecastCreationTime] = useGlobalState("forecastCreationTime");
  const { stopTime, resetTime } = useStopAndResetTime();
  const selectedTime = formatISODateString(selectedISOTime || new Date().toISOString());
  const { data: nationalForecastData, error } = useSWR<
    {
      targetTime: string;
      expectedPowerGenerationMegawatts: number;
    }[]
  >(`${API_PREFIX}/GB/solar/gsp/forecast/latest/0`, axiosFetcher, {
    refreshInterval: 60 * 1000 * 5, // 5min
  });
  const chartLimits = useMemo(
    () =>
      nationalForecastData && {
        start: nationalForecastData[0].targetTime,
        end: nationalForecastData[nationalForecastData.length - 1].targetTime,
      },
    [nationalForecastData],
  );
  useHotKeyControlChart(chartLimits);

  const { data: pvRealDayInData, error: error2 } = useSWR<
    {
      datetimeUtc: string;
      solarGenerationKw: number;
    }[]
  >(`${API_PREFIX}/GB/solar/gsp/pvlive/one_gsp/0/?regime=in-day`, axiosFetcher, {
    refreshInterval: 60 * 1000 * 5, // 5min
  });

  const { data: pvRealDayAfterData, error: error3 } = useSWR<
    {
      datetimeUtc: string;
      solarGenerationKw: number;
    }[]
  >(`${API_PREFIX}/GB/solar/gsp/pvlive/one_gsp/0/?regime=day-after`, axiosFetcher, {
    refreshInterval: 60 * 1000 * 5, // 5min
  });

  const chartData = useFormatChartData({
    forecastData: nationalForecastData,
    pvRealDayInData,
    pvRealDayAfterData,
    timeTrigger: selectedTime,
  });

  if (error || error2 || error3) return <div>failed to load</div>;
  if (!nationalForecastData || !pvRealDayInData || !pvRealDayAfterData)
    return (
      <div className="h-full flex">
        <Spinner></Spinner>
      </div>
    );

  const setSelectedTime = (time: string) => {
    stopTime();
    setSelectedISOTime(time + ":00.000Z");
  };
  return (
    <div className="flex flex-col ">
      <div className="flex-grow mb-7">
        <ForecastHeader
          pvForecastData={nationalForecastData}
          pvUpdatedData={pvRealDayAfterData}
          pvLiveData={pvRealDayInData}
          selectedTime={selectedTime}
        ></ForecastHeader>
        <button
          type="button"
          onClick={resetTime}
          className="font-bold block mt-8 items-center px-3 ml-auto text-md text-black  bg-ocf-yellow  hover:bg-ocf-yellow focus:z-10 focus:bg-ocf-yellow focus:text-black"
        >
          Reset Time
        </button>
        <div className="h-60">
          <RemixLine
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
          ></GspPvRemixChart>
        )}
      </div>
    </div>
  );
};

export default PvRemixChart;
