import { FC } from "react";
import RemixLine, { ChartData } from "./remix-line";
import useSWR from "swr";
import { API_PREFIX } from "../../constant";
import ForecastHeader from "./forecast-header";

const formatISODateString = (date: string) => date.slice(0, 16);

function get30MinNow() {
  const date = new Date();
  const minites = date.getMinutes();
  if (minites <= 30) {
    date.setHours(date.getHours());
    date.setMinutes(30, 0, 0); // Resets also seconds and milliseconds
  } else {
    date.setHours(date.getHours() + 1);
    date.setMinutes(0, 0, 0); // Resets also seconds and milliseconds
  }
  return formatISODateString(date.toISOString());
}
const getForecastChatData = (
  selectedDateTime: string,
  fr?: {
    targetTime: string;
    expectedPowerGenerationMegawatts: number;
  }
) => {
  if (!fr) return {};

  if (
    new Date(fr.targetTime).getTime() >=
    new Date(selectedDateTime + ":00.000Z").getTime()
  )
    return {
      FORECAST: Math.round(fr.expectedPowerGenerationMegawatts),
    };
  else
    return {
      PAST_FORECAST: Math.round(fr.expectedPowerGenerationMegawatts),
    };
};
const fetcher = (url) => {
  //@ts-ignore
  return fetch(url, { mode: "no-cors", method: "GET" }).then((res) =>
    res.json()
  );
};
const PvRemixChart: FC<{ date?: string }> = (props) => {
  //TODO: modve to a global state
  const selectedDateTime = get30MinNow();
  const { data: nationalForecastData, error } = useSWR<
    {
      targetTime: string;
      expectedPowerGenerationMegawatts: number;
    }[]
  >(`${API_PREFIX}/GB/solar/gsp/forecast/latest/0`, fetcher);
  const { data: pvRealData, error: error2 } = useSWR<
    {
      datetimeUtc: string;
      solarGenerationKw: number;
      regime: "in-day" | "day-after";
    }[]
  >(`${API_PREFIX}/GB/solar/gsp/truth/one_gsp/0`, fetcher);
  if (error || error2) return <div>failed to load</div>;
  if (!nationalForecastData || !pvRealData) return <div>loading...</div>;

  const ForecastDataMap = nationalForecastData.reduce((acc, curr, i) => {
    acc[curr.targetTime] = curr;
    return acc;
  }, {});

  const pvRealChartData: ChartData[] = pvRealData.map((pr) => {
    let fc = ForecastDataMap[pr.datetimeUtc] || undefined;
    if (fc) delete ForecastDataMap[pr.datetimeUtc];
    const data: ChartData = {
      datetimeUtc: formatISODateString(pr.datetimeUtc),
      ...getForecastChatData(selectedDateTime, fc),
    };
    const GENERATION = Math.round(pr.solarGenerationKw / 1000);
    if (pr.regime === "day-after") data.GENERATION_UPDATED = GENERATION;
    else data.GENERATION = GENERATION;
    return data;
  });

  Object.keys(ForecastDataMap).forEach((key) => {
    const fr = ForecastDataMap[key];
    pvRealChartData.push({
      datetimeUtc: formatISODateString(fr.targetTime),
      ...getForecastChatData(selectedDateTime, fr),
    });
  });

  return (
    <>
      <ForecastHeader
        pv={pvRealData && pvRealData[0].solarGenerationKw / 1000000}
      ></ForecastHeader>
      <div className=" h-60 mt-8 ">
        <RemixLine timeOfInterest={selectedDateTime} data={pvRealChartData} />
      </div>
    </>
  );
};

export default PvRemixChart;
