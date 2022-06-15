import { FC, useState } from "react";
import RemixLine, { ChartData } from "./remix-line";
import useSWR from "swr";
import { API_PREFIX } from "../../constant";
import ForecastHeader from "./forecast-header";
import axios from "axios";
import useGlobalState, { get30MinNow } from "../globalState";
import useFormatChartData from "./use-format-chart-data";
import { formatISODateString, formatISODateStringHuman } from "../utils";
import GspPvRemixChart from "./gsp-pv-remix-chart";
import { useStopAndResetTime } from "../hooks/use-and-update-selected-time";
import PlatButton from "../play-button";
import Spinner from "../spinner";

const axiosFetcher = (url: string) => {
  return axios(url).then(async (res) => {
    return res.data;
  });
};
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

  const { data: pvRealDataIn, error: error2 } = useSWR<
    {
      datetimeUtc: string;
      solarGenerationKw: number;
    }[]
  >(`${API_PREFIX}/GB/solar/gsp/truth/one_gsp/0/?regime=in-day`, axiosFetcher, {
    refreshInterval: 60 * 1000 * 5, // 5min
  });

  const { data: pvRealDataAfter, error: error3 } = useSWR<
    {
      datetimeUtc: string;
      solarGenerationKw: number;
    }[]
  >(`${API_PREFIX}/GB/solar/gsp/truth/one_gsp/0/?regime=day-after`, axiosFetcher, {
    refreshInterval: 60 * 1000 * 5, // 5min
  });

  const chartData = useFormatChartData({
    forecastData: nationalForecastData,
    pvRealDataIn,
    pvRealDataAfter,
    selectedTime,
  });

  if (error || error2 || error3) return <div>failed to load</div>;
  if (!nationalForecastData || !pvRealDataIn || !pvRealDataAfter)
    return (
      <div className="h-full flex">
        <Spinner></Spinner>
      </div>
    );

  const latestPvGenerationInGW = (
    (nationalForecastData.find((fc) => formatISODateString(fc.targetTime) === selectedTime)
      ?.expectedPowerGenerationMegawatts || 0) / 1000
  ).toFixed(3);
  const setSelectedTime = (time: string) => {
    stopTime();
    setSelectedISOTime(time + ":00.000Z");
  };
  return (
    <div
      className="flex flex-col overflow-y-scroll"
      style={{ minHeight: `calc(100vh - 70px)`, maxHeight: `calc(100vh - 70px)` }}
    >
      <div className="flex-grow mb-7">
        <ForecastHeader pv={latestPvGenerationInGW}>
          <PlatButton
            startTime={get30MinNow()}
            endTime={nationalForecastData[nationalForecastData.length - 1].targetTime}
          ></PlatButton>
        </ForecastHeader>
        <button
          type="button"
          onClick={resetTime}
          className="font-bold block mt-8 items-center px-3 ml-auto text-md text-black  bg-amber-400  hover:bg-amber-400 focus:z-10 focus:bg-amber-400 focus:text-black h-full"
        >
          Reset Time
        </button>
        <div className="h-60">
          <RemixLine
            timeOfInterest={selectedTime}
            setTimeOfInterest={setSelectedTime}
            data={chartData}
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
      <footer className="text-mapbox-black-300 text-right text-xs px-3">
        <p>OCF Forecast Creation Time: {formatISODateStringHuman(forecastCreationTime || "")}</p>
      </footer>
    </div>
  );
};

export default PvRemixChart;
