import { useMemo } from "react";
import { get30MinNow, useGlobalState } from "../helpers/globalState";
import { ForecastData, PvRealData } from "../types";
import { formatISODateString, getDeltaBucket } from "../helpers/utils";
import { ChartData } from "./remix-line";
import { DateTime } from "luxon";
import { Invalid, Valid } from "luxon/src/_util";
import seasonalRollingMeans from "../../data/monthly_rolling_averages.json";
import seasonalP10s from "../../data/monthly_p10_rolling.json";
import seasonalP90s from "../../data/monthly_p90_rolling.json";

//separate paste forecast from future forecast (ie: after selectedTime)
const getForecastChartData = (
  timeNow: string,
  fr?: {
    targetTime: string;
    expectedPowerGenerationMegawatts: number;
  },
  forecast_horizon?: number,
  forecast_key: string = "FORECAST"
) => {
  if (!fr) return {};

  const futureKey = forecast_horizon ? `N_HOUR_${forecast_key}` : forecast_key;
  const pastKey = forecast_horizon ? `N_HOUR_PAST_${forecast_key}` : `PAST_${forecast_key}`;

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
      return Number(datum.GENERATION_UPDATED) - Number(datum.PAST_FORECAST);
    } else if (datum.GENERATION !== undefined) {
      return Number(datum.GENERATION) - Number(datum.PAST_FORECAST);
    }
  } else if (datum.FORECAST !== undefined && datum["N_HOUR_FORECAST"] !== undefined) {
    return Number(datum.FORECAST) - Number(datum["N_HOUR_FORECAST"]);
  }
  return 0;
};

const getSeasonalMean = (date: DateTime<Valid> | DateTime<Invalid>) => {
  if (date.isValid === false) return 0;

  const month = date.month;
  const time = date.toFormat("HH:mm:ss");
  //   load json file with seasonal means
  const seasonalMeanForDay =
    seasonalRollingMeans[`(${month}, ${date.day})` as keyof typeof seasonalRollingMeans];
  if (seasonalMeanForDay?.[time as keyof typeof seasonalMeanForDay])
    return seasonalMeanForDay[time as keyof typeof seasonalMeanForDay] * 21504.629;

  return 0;
};

const getSeasonalMinMax = (date: DateTime<Valid> | DateTime<Invalid>) => {
  if (date.isValid === false) return [0, 0];

  const month = date.month;
  const time = date.toFormat("HH:mm:ss");
  const seasonalP10ForDate = seasonalP10s[`(${month}, ${date.day})` as keyof typeof seasonalP10s];
  const seasonalP90ForDate = seasonalP90s[`(${month}, ${date.day})` as keyof typeof seasonalP90s];
  let max = 0;
  let min = 0;

  if (seasonalP10ForDate?.[time as keyof typeof seasonalP10ForDate]) {
    max = seasonalP10ForDate[time as keyof typeof seasonalP10ForDate] * 21504.629;
  }
  if (seasonalP90ForDate?.[time as keyof typeof seasonalP90ForDate]) {
    min = seasonalP90ForDate[time as keyof typeof seasonalP90ForDate] * 21504.629;
  }
  return [min, max];
};
const useFormatChartData = ({
  forecastData,
  nationalIntradayECMWFOnlyData,
  nationalMetOfficeOnly,
  nationalSatOnly,
  nationalPvnetDayAhead,
  nationalPvnetIntraday,
  fourHourData,
  probabilisticRangeData,
  pvRealDayAfterData,
  pvRealDayInData,
  timeTrigger,
  delta = false
}: {
  forecastData?: ForecastData;
  nationalIntradayECMWFOnlyData?: ForecastData;
  nationalMetOfficeOnly?: ForecastData;
  nationalSatOnly?: ForecastData;
  nationalPvnetDayAhead?: ForecastData;
  nationalPvnetIntraday?: ForecastData;
  fourHourData?: ForecastData;
  probabilisticRangeData?: ForecastData;
  pvRealDayAfterData?: PvRealData;
  pvRealDayInData?: PvRealData;
  timeTrigger?: string;
  delta?: boolean;
}) => {
  const [nHourForecast] = useGlobalState("nHourForecast");

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
        const formattedDate = getDatetimeUtc(dataPoint);
        if (chartMap[formattedDate]) {
          chartMap[formattedDate] = {
            ...chartMap[formattedDate],
            ...pvData
          };
        } else {
          chartMap[formattedDate] = {
            formattedDate: formatISODateString(formattedDate),
            ...pvData
          };
        }
      };

      pvRealDayAfterData.forEach((pva) =>
        addDataToMap(
          pva,
          (db) => db.datetimeUtc,
          (db) => ({
            GENERATION_UPDATED: db.solarGenerationKw / 1000
          })
        )
      );
      pvRealDayInData.forEach((pvIn) =>
        addDataToMap(
          pvIn,
          (db) => db.datetimeUtc,
          (db) => ({
            GENERATION: db.solarGenerationKw / 1000
          })
        )
      );
      forecastData.forEach((fc) => {
        addDataToMap(
          fc,
          (db) => db.targetTime,
          (db) => getForecastChartData(timeNow, db)
        );
        if (fc.plevels) {
          addDataToMap(
            fc,
            (db) => db.targetTime,
            //add an array here for the probabilistic area in the chart
            (db) => ({
              PROBABILISTIC_RANGE: [db.plevels.plevel_10, db.plevels.plevel_90]
            })
          );
        }
        if (fc.plevels?.plevel_10) {
          addDataToMap(
            fc,
            (db) => db.targetTime,
            // probabilistic lower bound for the tooltip to use
            (db) => ({
              PROBABILISTIC_LOWER_BOUND: db.plevels.plevel_10
            })
          );
        }
        if (fc.plevels?.plevel_90) {
          addDataToMap(
            fc,
            (db) => db.targetTime,
            (db) => ({
              // probabilistic upper bound for the tooltip to use
              PROBABILISTIC_UPPER_BOUND: db.plevels.plevel_90
            })
          );
        }
      });

      const models: [ForecastData | undefined, string][] = [
        [nationalIntradayECMWFOnlyData, "INTRADAY_ECMWF_ONLY"],
        [nationalPvnetDayAhead, "PVNET_DAY_AHEAD"],
        [nationalPvnetIntraday, "PVNET_INTRADAY"],
        [nationalMetOfficeOnly, "MET_OFFICE_ONLY"],
        [nationalSatOnly, "SAT_ONLY"]
      ];
      for (const [model, key] of models) {
        if (model) {
          model.forEach((fc) => {
            addDataToMap(
              fc,
              (db) => db.targetTime,
              (db) => getForecastChartData(timeNow, db, undefined, key)
            );
          });
        }
      }

      // Add settlement period and seasonal norm data
      for (const key of Object.keys(chartMap)) {
        const date = DateTime.fromISO(key);
        const midnightBefore = date.set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
        // Compute settlement period by duration since midnight, e.g. 00:00 is 1, 00:30 is 2, 01:00 is 3, etc.
        const interval = date.diff(midnightBefore, "minutes").minutes;
        // console.log("date", date);
        // console.log("interval", interval);
        chartMap[key].SETTLEMENT_PERIOD = Math.floor(interval / 30) + 1; // 1-indexed, not 0-indexed

        const seasonalBounds = getSeasonalMinMax(date);
        chartMap[key].SEASONAL_MEAN = getSeasonalMean(date);
        chartMap[key].SEASONAL_BOUNDS = seasonalBounds;
        chartMap[key].SEASONAL_P10 = seasonalBounds[1];
        chartMap[key].SEASONAL_P90 = seasonalBounds[0];
      }

      if (fourHourData) {
        fourHourData.forEach((fc) =>
          addDataToMap(
            fc,
            (db) => db.targetTime,
            (db) => getForecastChartData(timeNow, db, nHourForecast * 60)
          )
        );
      }
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
  }, [
    forecastData,
    fourHourData,
    pvRealDayInData,
    pvRealDayAfterData,
    timeTrigger,
    nHourForecast,
    nationalIntradayECMWFOnlyData,
    nationalPvnetDayAhead,
    nationalPvnetIntraday,
    probabilisticRangeData
  ]);
  console.log("returning chartData", data);
  return data;
};

export default useFormatChartData;
