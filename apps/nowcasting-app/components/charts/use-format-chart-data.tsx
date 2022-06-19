import { useMemo } from "react";
import { get30MinNow } from "../globalState";
import { formatISODateString } from "../utils";
import { ChartData } from "./remix-line";

//sperate paste forcaste from furute forcast (ie: after selectedTime)
const getForecastChartData = (
  timeNow: string,
  fr?: {
    targetTime: string;
    expectedPowerGenerationMegawatts: number;
  },
) => {
  if (!fr) return {};

  if (new Date(fr.targetTime).getTime() > new Date(timeNow + ":00.000Z").getTime())
    return {
      FORECAST: Math.round(fr.expectedPowerGenerationMegawatts),
    };
  else if (new Date(fr.targetTime).getTime() === new Date(timeNow + ":00.000Z").getTime())
    return {
      FORECAST: Math.round(fr.expectedPowerGenerationMegawatts),
    };
  else
    return {
      PAST_FORECAST: Math.round(fr.expectedPowerGenerationMegawatts),
    };
};
const useFormatChartData = ({
  forecastData,
  pvRealDataAfter,
  pvRealDataIn,
  timeTrigger,
}: {
  forecastData?: {
    targetTime: string;
    expectedPowerGenerationMegawatts: number;
    expectedPowerGenerationNormalized?: number | null;
  }[];
  pvRealDataAfter?: {
    datetimeUtc: string;
    solarGenerationKw: number;
  }[];
  pvRealDataIn?: {
    datetimeUtc: string;
    solarGenerationKw: number;
  }[];
  timeTrigger?: string;
}) => {
  const data = useMemo(() => {
    if (forecastData && pvRealDataAfter && pvRealDataIn && timeTrigger) {
      const timeNow = formatISODateString(get30MinNow());
      const chartMap: Record<string, ChartData> = {};

      const addDataToMap = (
        dataPoint: any,
        getDatetimeUtc: (dp: any) => string,
        getPvdata: (dp: any) => Partial<ChartData>,
      ) => {
        const pvData = getPvdata(dataPoint);
        const formatedDate = getDatetimeUtc(dataPoint);
        if (chartMap[formatedDate]) {
          chartMap[formatedDate] = {
            ...chartMap[formatedDate],
            ...pvData,
          };
        } else {
          chartMap[formatedDate] = {
            formatedDate: formatISODateString(formatedDate),
            ...pvData,
          };
        }
      };

      pvRealDataAfter.forEach((pva) =>
        addDataToMap(
          pva,
          (db) => db.datetimeUtc,
          (db) => ({
            GENERATION_UPDATED: Math.round(db.solarGenerationKw / 1000),
          }),
        ),
      );
      pvRealDataIn.forEach((pvIn) =>
        addDataToMap(
          pvIn,
          (db) => db.datetimeUtc,
          (db) => ({
            GENERATION: Math.round(db.solarGenerationKw / 1000),
          }),
        ),
      );
      forecastData.forEach((fc) =>
        addDataToMap(
          fc,
          (db) => db.targetTime,
          (db) => getForecastChartData(timeNow, db),
        ),
      );

      return Object.values(chartMap);
    }
    return [];
    // timeTrigger is used to trigger chart calculation when time changes
  }, [forecastData, pvRealDataIn, pvRealDataAfter, timeTrigger]);
  return data;
};

export default useFormatChartData;
