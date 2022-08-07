import { FC, useMemo } from "react";
import RemixLine from "./remix-line";
import useSWR from "swr";
import { API_PREFIX } from "../../constant";
import ForecastHeader from "./forecast-header";
import useGlobalState from "../globalState";
import useFormatChartData from "./use-format-chart-data";

import {
  axiosFetcher,
  convertISODateStringToLondonTime,
  formatISODateString,
  formatISODateStringHuman,
  KWtoGW,
  MWtoGW,
  get30MinNow,
} from "../utils";
import GspPvRemixChart from "./gsp-pv-remix-chart";
import { useStopAndResetTime } from "../hooks/use-and-update-selected-time";
import PlatButton from "../play-button";
import Spinner from "../spinner";
import { MAX_NATIONAL_GENERATION_MW } from "../../constant";
import useTimeNow from "../hooks/use-time-now";
import { FaExclamationCircle } from "@react-icons/all-files/fa/FaExclamationCircle";
import Tooltip from "../tooltip";
import useHotKeyControlChart from "../hooks/use-hot-key-control-chart";

const chartInfo = (
  <div className="w-full w-64 p-2 text-sm">
    <ul className="list-none space-y-2">
      <li>All datetimes are in Europe/London timezone.</li>
      <li>
        Following{" "}
        <a
          className=" underline"
          href="https://www.solar.sheffield.ac.uk/pvlive/"
          target="_blank"
          rel="noreferrer"
        >
          PVLive
        </a>
        , datetimes show the end of the settlement period. For example 17:00 refers to solar
        generation between 16:30 to 17:00.
      </li>
      <li>The Y axis units are in MW, for the national and GSP plots. </li>
    </ul>
  </div>
);

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
    <div className="flex flex-col overflow-y-scroll h-full">
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
          data-e2e="reset-time-button"
          className="font-bold block mt-8 items-center px-3 ml-auto text-md text-black  bg-amber-400  hover:bg-amber-400 focus:z-10 focus:bg-amber-400 focus:text-black"
        >
          Reset Time
        </button>
        <div className="h-60" data-e2e="NF-chart">
          <RemixLine
            id="national"
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

      <footer className="text-mapbox-black-300 text-right  px-3">
        <Tooltip tip={chartInfo} className={"text-left"}>
          <FaExclamationCircle className="m-2 " size={24} />
        </Tooltip>

        <p className="text-xs">
          OCF Forecast Creation Time: {formatISODateStringHuman(forecastCreationTime || "")}
        </p>
      </footer>
    </div>
  );
};

export default PvRemixChart;
