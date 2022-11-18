import { useMemo } from "react";
import { get30MinNow } from "../helpers/globalState";
import { ForecastData, PvRealData } from "../types";
import { formatISODateString } from "../helpers/utils";
import { ChartData } from "./remix-line";

//separate paste forecast from future forecast (ie: after selectedTime)
const getForecastChartData = (
  timeNow: string,
  fr?: {
    targetTime: string;
    expectedPowerGenerationMegawatts: number;
  },
  forecast_horizon?: number
) => {
  if (!fr) return {};

  const futureKey = forecast_horizon === 240 ? "4HR_FORECAST" : "FORECAST";
  const pastKey = forecast_horizon === 240 ? "4HR_PAST_FORECAST" : "PAST_FORECAST";

  if (new Date(fr.targetTime).getTime() > new Date(timeNow + ":00.000Z").getTime())
    return {
      [futureKey]: fr.expectedPowerGenerationMegawatts
    };
  else if (new Date(fr.targetTime).getTime() === new Date(timeNow + ":00.000Z").getTime())
    return {
      [futureKey]: fr.expectedPowerGenerationMegawatts
    };
  else
    return {
      [pastKey]: fr.expectedPowerGenerationMegawatts
    };
};
const getDelta: (datum: ChartData) => number = (datum) => {
  if (datum.PAST_FORECAST !== undefined) {
    if (datum.GENERATION_UPDATED !== undefined) {
      return Number(datum.PAST_FORECAST) - Number(datum.GENERATION_UPDATED);
    } else if (datum.GENERATION !== undefined) {
      return Number(datum.PAST_FORECAST) - Number(datum.GENERATION);
    }
  }
  return 0;
};
const useFormatChartData = ({
  forecastData,
  fourHourData,
  pvRealDayAfterData,
  pvRealDayInData,
  timeTrigger,
  delta = false
}: {
  forecastData?: ForecastData;
  fourHourData?: ForecastData;
  pvRealDayAfterData?: PvRealData;
  pvRealDayInData?: PvRealData;
  timeTrigger?: string;
  delta?: boolean;
}) => {
  const data = useMemo(() => {
    if (forecastData && pvRealDayAfterData && pvRealDayInData && timeTrigger) {
      const timeNow = formatISODateString(get30MinNow());
      const chartMap: Record<string, ChartData> = {};

      const addDataToMap = (
        dataPoint: any,
        getDatetimeUtc: (dp: any) => string,
        getPvdata: (dp: any) => Partial<ChartData>
      ) => {
        const pvData = getPvdata(dataPoint);
        const formatedDate = getDatetimeUtc(dataPoint);
        if (chartMap[formatedDate]) {
          chartMap[formatedDate] = {
            ...chartMap[formatedDate],
            ...pvData
          };
        } else {
          chartMap[formatedDate] = {
            formatedDate: formatISODateString(formatedDate),
            ...pvData
          };
        }
      };

      pvRealDayAfterData.forEach((pva) =>
        addDataToMap(
          pva,
          (db) => db.datetimeUtc,
          (db) => ({
            GENERATION_UPDATED: Math.round(db.solarGenerationKw / 1000)
          })
        )
      );
      pvRealDayInData.forEach((pvIn) =>
        addDataToMap(
          pvIn,
          (db) => db.datetimeUtc,
          (db) => ({
            GENERATION: Math.round(db.solarGenerationKw / 1000)
          })
        )
      );
      forecastData.forEach((fc) =>
        addDataToMap(
          fc,
          (db) => db.targetTime,
          (db) => getForecastChartData(timeNow, db)
        )
      );
      if (fourHourData) {
        fourHourData.forEach((fc) =>
          addDataToMap(
            fc,
            (db) => db.targetTime,
            (db) => getForecastChartData(timeNow, db, 240)
          )
        );
      }
      if (delta) {
        for (const chartDatum in chartMap) {
          if (typeof chartMap[chartDatum] === "object") {
            chartMap[chartDatum].DELTA = getDelta(chartMap[chartDatum]);
          }
        }
      }

      return Object.values(chartMap);
    }
    return [];
    // timeTrigger is used to trigger chart calculation when time changes
  }, [forecastData, fourHourData, pvRealDayInData, pvRealDayAfterData, timeTrigger]);
  return data;
};

export default useFormatChartData;
