import { FC } from "react";
import RemixLine, { ChartData } from "./remix-line";
import useSWR from "swr";
import { API_PREFIX } from "../../constant";
import ForecastHeader from "./forecast-header";
import axios from "axios";
import useGlobalState from "../globalState";
import useFormatChartData from "./use-format-chart-data";
import { formatISODateString } from "../utils";

const axiosFetcher = (url: string) => {
  return axios(url).then(async (res) => {
    return res.data;
  });
};
const PvRemixChart: FC<{ date?: string }> = (props) => {
  const [selectedISOTime, setSelectedISOTime] = useGlobalState("selectedISOTime");
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
    nationalForecastData,
    pvRealDataIn,
    pvRealDataAfter,
    selectedTime,
  });

  if (error || error2 || error3) return <div>failed to load</div>;
  if (!nationalForecastData || !pvRealDataIn || !pvRealDataAfter) return <div>loading...</div>;

  const latestPvGenerationInGW = (
    (nationalForecastData.find(
      (fc) =>
        formatISODateString(fc.targetTime) ===
        formatISODateString(selectedISOTime || new Date().toISOString()),
    )?.expectedPowerGenerationMegawatts || 0) / 1000
  ).toFixed(3);

  return (
    <>
      <ForecastHeader pv={latestPvGenerationInGW}></ForecastHeader>

      <div className=" h-60 mt-8 ">
        <RemixLine
          timeOfInterest={selectedTime}
          setTimeOfInterest={(time) => setSelectedISOTime(time + ":00.000Z")}
          data={chartData}
        />
      </div>
    </>
  );
};

export default PvRemixChart;
