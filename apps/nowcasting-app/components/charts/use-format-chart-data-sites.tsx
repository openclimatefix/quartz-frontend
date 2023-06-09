import { useMemo } from "react";
import { get30MinNow } from "../helpers/globalState";
import {
  AllSites,
  ForecastData,
  PvRealData,
  Site,
  SiteForecastValue,
  SitePvActual,
  SitePvForecast,
  SitesPvActual,
  SitesPvForecast
} from "../types";
import { convertToLocaleDateString, formatISODateString, getDeltaBucket } from "../helpers/utils";
import { ChartData } from "./remix-line";
import { DELTA_BUCKET } from "../../constant";

// Separate past forecast from future forecast (ie: after selectedTime)
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
// const getDelta: (datum: ChartData) => number = (datum) => {
//   if (datum.PAST_FORECAST !== undefined) {
//     if (datum.GENERATION_UPDATED !== undefined) {
//       return Number(datum.GENERATION_UPDATED) - Number(datum.PAST_FORECAST);
//     } else if (datum.GENERATION !== undefined) {
//       return Number(datum.GENERATION) - Number(datum.PAST_FORECAST);
//     }
//   } else if (datum.FORECAST !== undefined && datum["4HR_FORECAST"] !== undefined) {
//     return Number(datum.FORECAST) - Number(datum["4HR_FORECAST"]);
//   }
//   return 0;
// };
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
  pvForecastData?: SitePvForecast[];
  pvActualData?: SitePvActual[];
  timeTrigger?: string;
  delta?: boolean;
}) => {
  const data = useMemo(() => {
    if (pvForecastData && pvActualData && timeTrigger) {
      const timeNow = formatISODateString(get30MinNow());
      const chartMap: Record<string, ChartData> = {};
      const siteIds: string[] = allSitesData?.map((site) => site.site_uuid) || [];

      type ActualDataPoint = {
        datetime_utc: string;
        actual_generation_kw: number;
      };
      type ForecastDataPoint = {
        expected_generation_kw: number;
        target_datetime_utc: string;
      };
      type DataPoint = ActualDataPoint | ForecastDataPoint;

      const addDataToMap = <DataPointTypeGeneric extends DataPoint>(
        dataPoint: DataPointTypeGeneric,
        getDatetimeUtc: (dp: DataPointTypeGeneric) => string,
        getPvdata: (dp: DataPointTypeGeneric) => Partial<Record<keyof ChartData, any>>
      ) => {
        const sitePvData = getPvdata(dataPoint);
        const pvDataKey: keyof ChartData = Object.keys(sitePvData)[0] as keyof ChartData;
        const formattedDate = getDatetimeUtc(dataPoint);
        if (!chartMap[formattedDate]) {
          chartMap[formattedDate] = {
            formattedDate: new Date(convertToLocaleDateString(formattedDate)).getTime().toString(),
            ...sitePvData
          };
        } else {
          if (!pvDataKey) return;
          let existingPvData = chartMap[formattedDate][pvDataKey] || 0;
          if (existingPvData === 0) {
            chartMap[formattedDate] = {
              ...chartMap[formattedDate],
              ...sitePvData
            };
          } else {
            chartMap[formattedDate] = {
              ...chartMap[formattedDate],
              [pvDataKey || ""]: existingPvData + (sitePvData[pvDataKey] || 0)
            };
          }
        }
      };

      pvActualData.forEach((pva) => {
        if (!siteIds.includes(pva.site_uuid)) return;

        pva.pv_actual_values.forEach((pvav) => {
          if (typeof pvav.actual_generation_kw !== "number") return;
          addDataToMap<ActualDataPoint>(
            pvav,
            (db) => db.datetime_utc,
            (db) => ({
              GENERATION_UPDATED: db.actual_generation_kw
            })
          );
        });
      });

      pvForecastData.forEach((fc) => {
        if (!siteIds.includes(fc.site_uuid)) return;

        fc.forecast_values.forEach((fcv) =>
          addDataToMap<ForecastDataPoint>(
            fcv,
            (db) => db.target_datetime_utc,
            (db) => getForecastChartData(timeNow, db)
          )
        );
      });

      // if (delta) {
      //   for (const chartDatum in chartMap) {
      //     if (typeof chartMap[chartDatum] === "object") {
      //       const delta = getDelta(chartMap[chartDatum]);
      //       chartMap[chartDatum].DELTA = delta;
      //       chartMap[chartDatum].DELTA_BUCKET = getDeltaBucket(delta);
      //     }
      //   }
      // }

      // Filter out data points without forecast data
      const filteredData = Object.values(chartMap).filter((datum) => {
        return datum.FORECAST !== undefined || datum.PAST_FORECAST !== undefined;
      });

      return filteredData;
    }
    return [];
    // timeTrigger is used to trigger chart calculation when time changes
  }, [allSitesData, pvForecastData, pvActualData, timeTrigger]);
  // }, [forecastData, fourHourData, pvRealDayInData, pvRealDayAfterData, timeTrigger]);
  return data;
};

export default useFormatChartDataSites;
