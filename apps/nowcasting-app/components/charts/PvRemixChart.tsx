import { FC, useState } from "react";
import RemixLine from "./RemixLine";
import useSWR from "swr";
import { API_PREFIX } from "../../constant";
import ForecastHeader from "./forecast-header";

function get30MinNow() {
  const date = new Date();
  const minites = date.getMinutes();
  if (minites <= 30) {
    c(minites);
    date.setHours(date.getHours());
    date.setMinutes(30, 0, 0); // Resets also seconds and milliseconds
  } else {
    date.setHours(date.getHours() + 1);
    date.setMinutes(0, 0, 0); // Resets also seconds and milliseconds
  }
  return date;
}
const PvRemixChart: FC<{ date?: string }> = (props) => {
  const [selectedTimeStep, setSelectedTimeStep] = useState(
    get30MinNow().toISOString()
  );

  //@ts-ignore
  const fetcher = (...args) => fetch(...args).then((res) => res.json());

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

  const pvRealChartData = pvRealData.map((pr) => {
    let fc = ForecastDataMap[pr.datetimeUtc] || undefined;
    if (fc) delete ForecastDataMap[pr.datetimeUtc];
    const data = {
      time: pr.datetimeUtc.slice(11, 16),
      datetimeUtc: pr.datetimeUtc,
      FORECAST:
        fc?.expectedPowerGenerationMegawatts &&
        Math.round(fc?.expectedPowerGenerationMegawatts),
      GENERATION: undefined,
      GENERATION_UPDATED: undefined,
    };
    const GENERATION = Math.round(pr.solarGenerationKw / 1000);
    if (pr.regime === "day-after") data.GENERATION_UPDATED = GENERATION;
    else data.GENERATION = GENERATION;
    return data;
  });
  Object.keys(ForecastDataMap).forEach((key) => {
    pvRealChartData.push({
      time: ForecastDataMap[key].targetTime.slice(11, 16),
      datetimeUtc: ForecastDataMap[key].targetTime,
      FORECAST: Math.round(
        ForecastDataMap[key].expectedPowerGenerationMegawatts
      ),
      GENERATION: undefined,
      GENERATION_UPDATED: undefined,
    });
  });

  return (
    <>
      <ForecastHeader
        pv={pvRealData && pvRealData[0].solarGenerationKw / 1000000}
      ></ForecastHeader>
      <div className="border-t border-black h-60 bg-mapbox-black">
        <RemixLine timeOfInterest={selectedTimeStep} data={pvRealChartData} />
      </div>
    </>
  );
};

export default PvRemixChart;
