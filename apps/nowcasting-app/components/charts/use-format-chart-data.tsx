import { useMemo } from "react";
import { ChartData } from "./remix-line";

//sperate paste forcaste from furute forcast (ie: after selectedTime)
export const formatISODateString = (date: string) => date.slice(0, 16);
const getForecastChartData = (
  selectedTime: string,
  fr?: {
    targetTime: string;
    expectedPowerGenerationMegawatts: number;
  }
) => {
  if (!fr) return {};

  if (
    new Date(fr.targetTime).getTime() >=
    new Date(selectedTime + ":00.000Z").getTime()
  )
    return {
      FORECAST: Math.round(fr.expectedPowerGenerationMegawatts),
    };
  else
    return {
      PAST_FORECAST: Math.round(fr.expectedPowerGenerationMegawatts),
    };
};
const useFormatChartData = ({
  nationalForecastData,
  pvRealData,
  selectedTime,
}: {
  nationalForecastData?: {
    targetTime: string;
    expectedPowerGenerationMegawatts: number;
  }[];
  pvRealData?: {
    datetimeUtc: string;
    solarGenerationKw: number;
    regime: "in-day" | "day-after";
  }[];
  selectedTime?: string;
}) => {
  const data = useMemo(() => {
    if (nationalForecastData && pvRealData && selectedTime) {
      const ForecastDataMap = nationalForecastData.reduce((acc, curr, i) => {
        acc[curr.targetTime] = curr;
        return acc;
      }, {});

      const chartData: ChartData[] = pvRealData.map((pr) => {
        let fc = ForecastDataMap[pr.datetimeUtc] || undefined;
        if (fc) delete ForecastDataMap[pr.datetimeUtc];
        const data: ChartData = {
          datetimeUtc: formatISODateString(pr.datetimeUtc),
          ...getForecastChartData(selectedTime, fc),
        };
        const GENERATION = Math.round(pr.solarGenerationKw / 1000);
        if (pr.regime === "day-after") data.GENERATION_UPDATED = GENERATION;
        else data.GENERATION = GENERATION;
        return data;
      });

      Object.keys(ForecastDataMap).forEach((key) => {
        const fr = ForecastDataMap[key];
        chartData.push({
          datetimeUtc: formatISODateString(fr.targetTime),
          ...getForecastChartData(selectedTime, fr),
        });
      });
      return chartData;
    }
    return [];
  }, [nationalForecastData, pvRealData, selectedTime]);
  return data;
};

export default useFormatChartData;
