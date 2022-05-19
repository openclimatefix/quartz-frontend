import { FC } from "react";
import RemixLine, { ChartData } from "./remix-line";
import useSWR from "swr";
import { API_PREFIX } from "../../constant";
import ForecastHeader from "./forecast-header";
import axios from "axios";
import useGlobalState from "../globalState";
import useFormatChartData, {
  formatISODateString,
} from "./use-format-chart-data";

const axiosFetcher = (url) => {
  return axios(url, {
    // mode: "no-cors",
    headers: {
      Accept: "*/*",
      "Content-Type": "application/json",
    },
  }).then(async (res) => {
    return res.data;
  });
};
const PvRemixChart: FC<{ date?: string }> = (props) => {
  //TODO: modve to a global state
  const [selectedISOTime] = useGlobalState("selectedISOTime");
  const selectedTime = formatISODateString(selectedISOTime);
  const { data: nationalForecastData, error } = useSWR<
    {
      targetTime: string;
      expectedPowerGenerationMegawatts: number;
    }[]
  >(`${API_PREFIX}/GB/solar/gsp/forecast/latest/0`, axiosFetcher);
  const { data: pvRealData, error: error2 } = useSWR<
    {
      datetimeUtc: string;
      solarGenerationKw: number;
      regime: "in-day" | "day-after";
    }[]
  >(`${API_PREFIX}/GB/solar/gsp/truth/one_gsp/0/`, axiosFetcher);

  const chartData = useFormatChartData({
    nationalForecastData,
    pvRealData,
    selectedTime,
  });

  if (error || error2) return <div>failed to load</div>;
  if (!nationalForecastData || !pvRealData) return <div>loading...</div>;

  const latestPvGenerationInGW =
    pvRealData && pvRealData[0].solarGenerationKw / 1000000;
  return (
    <>
      <ForecastHeader pv={latestPvGenerationInGW}></ForecastHeader>
      <div className=" h-60 mt-8 ">
        <RemixLine timeOfInterest={selectedTime} data={chartData} />
      </div>
    </>
  );
};

export default PvRemixChart;
