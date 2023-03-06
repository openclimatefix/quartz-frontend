import { useMemo } from "react";
import { get30MinNow } from "../helpers/globalState";
import {
  AllSites,
  ForecastData,
  PvRealData,
  Site,
  SiteForecastValue,
  SitesPvActual,
  SitesPvForecast
} from "../types";
import { formatISODateString, getDeltaBucket } from "../helpers/utils";
import { ChartData } from "./remix-line";
import { DELTA_BUCKET } from "../../constant";

//separate paste forecast from future forecast (ie: after selectedTime)
const getForecastChartData = (
  timeNow: string,
  fr?: SiteForecastValue,
  forecast_horizon?: number
) => {
  if (!fr) return {};

  const futureKey = forecast_horizon === 240 ? "4HR_FORECAST" : "FORECAST";
  const pastKey = forecast_horizon === 240 ? "4HR_PAST_FORECAST" : "PAST_FORECAST";
  const generation =
    fr.expected_generation_kw > 20 ? fr.expected_generation_kw / 7000 : fr.expected_generation_kw;

  if (new Date(fr.target_datetime_utc).getTime() > new Date(timeNow + ":00.000Z").getTime())
    return {
      [futureKey]: generation
    };
  else if (new Date(fr.target_datetime_utc).getTime() === new Date(timeNow + ":00.000Z").getTime())
    return {
      [futureKey]: generation
    };
  else
    return {
      [pastKey]: generation
    };
};
const getDelta: (datum: ChartData) => number = (datum) => {
  if (datum.PAST_FORECAST !== undefined) {
    if (datum.GENERATION_UPDATED !== undefined) {
      return Number(datum.GENERATION_UPDATED) - Number(datum.PAST_FORECAST);
    } else if (datum.GENERATION !== undefined) {
      return Number(datum.GENERATION) - Number(datum.PAST_FORECAST);
    }
  } else if (datum.FORECAST !== undefined && datum["4HR_FORECAST"] !== undefined) {
    return Number(datum.FORECAST) - Number(datum["4HR_FORECAST"]);
  }
  return 0;
};
const useFormatChartDataSites = ({
  allSitesData,
  pvForecastData,
  // fourHourData,
  pvActualData,
  // pvRealDayInData,
  timeTrigger,
  delta = false
}: {
  allSitesData: Site[] | undefined;
  pvForecastData?: SitesPvForecast[];
  // fourHourData?: ForecastData[];
  pvActualData?: SitesPvActual[];
  // pvRealDayInData?: PvRealData;
  timeTrigger?: string;
  delta?: boolean;
}) => {
  console.log("useFormatChartDataSites");
  console.log("pvForecastData", pvForecastData);
  console.log("pvActualData", pvActualData);
  console.log("allSites", allSitesData);
  const data = useMemo(() => {
    if (pvForecastData && pvActualData && timeTrigger) {
      const timeNow = formatISODateString(get30MinNow());
      const chartMap: Record<string, ChartData> = {};

      const addDataToMap = (
        dataPoint: any,
        getDatetimeUtc: (dp: any) => string,
        getPvdata: (dp: any) => Partial<ChartData>
      ) => {
        const pvData = getPvdata(dataPoint);
        const formattedDate = getDatetimeUtc(dataPoint);
        if (typeof formattedDate !== "string") {
          return;
        }
        if (chartMap[formattedDate]) {
          chartMap[formattedDate] = {
            ...chartMap[formattedDate],
            ...pvData
          };
        } else {
          chartMap[formattedDate] = {
            formattedDate: new Date(formattedDate).getTime().toString(),
            ...pvData
          };
        }
      };

      pvActualData.forEach((pva) =>
        pva.pv_actual_values.forEach((pvav) => {
          addDataToMap(
            pvav,
            (db) => db.datetime_utc,
            (db) => ({
              GENERATION_UPDATED: db.actual_generation_kw
            })
          );
        })
      );
      // pvRealDayInData.forEach((pvIn) =>
      //   addDataToMap(
      //     pvIn,
      //     (db) => db.datetimeUtc,
      //     (db) => ({
      //       GENERATION: Math.round(db.solarGenerationKw / 1000)
      //     })
      //   )
      // );
      pvForecastData.forEach((fc) =>
        fc.forecast_values.forEach((fcv) =>
          addDataToMap(
            fcv,
            (db) => db.target_datetime_utc,
            (db) => getForecastChartData(timeNow, db)
          )
        )
      );
      // if (fourHourData) {
      //   fourHourData.forEach((fc) =>
      //     addDataToMap(
      //       fc,
      //       (db) => db.targetTime,
      //       (db) => getForecastChartData(timeNow, db, 240)
      //     )
      //   );
      // }
      if (delta) {
        for (const chartDatum in chartMap) {
          if (typeof chartMap[chartDatum] === "object") {
            const delta = getDelta(chartMap[chartDatum]);
            chartMap[chartDatum].DELTA = delta;
            chartMap[chartDatum].DELTA_BUCKET = getDeltaBucket(delta);
          }
        }
      }

      return Object.values(chartMap);
    }
    return [];
    // timeTrigger is used to trigger chart calculation when time changes
  }, [pvForecastData, pvActualData, timeTrigger]);
  // }, [forecastData, fourHourData, pvRealDayInData, pvRealDayAfterData, timeTrigger]);
  return data;
};

export default useFormatChartDataSites;
