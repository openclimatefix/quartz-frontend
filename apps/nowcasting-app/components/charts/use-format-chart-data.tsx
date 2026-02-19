import { useMemo } from "react";
import { get30MinNow, useGlobalState } from "../helpers/globalState";
import { ForecastData, PvRealData } from "../types";
import { formatISODateString, getDeltaBucket } from "../helpers/utils";
import {
  ChartData,
  ChartDataBase,
  SeasonalBound,
  SeasonalPValue,
  SeasonalQuantile
} from "./remix-line";
import { DateTime } from "luxon";
import { Invalid, Valid } from "luxon/src/_util";
import nationalMetrics from "../../data/national_metrics.json";
import { getSettlementPeriodForDate } from "../helpers/chartUtils";

const NATIONAL_CAPACITY = 21504.629;

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

const getSeasonalMetricsForDate = (date: DateTime<Valid> | DateTime<Invalid>) => {
  if (date.isValid === false) return { seasonalMean: 0, seasonalBounds: [] };

  const month = date.month;
  const day = date.day;
  const seasonalQuantiles = nationalMetrics["keys"]["pLevels"];
  // @ts-ignore
  const seasonalMetricData = nationalMetrics["data"][month][day];
  const seasonalMetrics = {
    seasonalMean: seasonalMetricData.mean,
    seasonalBounds: [] as SeasonalBound[]
  };
  // Split quantiles into pairs from beginning and end of array
  const quantilePairs = [];
  for (let i = 0; i < seasonalQuantiles.length / 2; i += 1) {
    quantilePairs.push([seasonalQuantiles[i], seasonalQuantiles[seasonalQuantiles.length - i - 1]]);
  }
  for (const [lowerQuantile, upperQuantile] of quantilePairs) {
    seasonalMetrics["seasonalBounds"].push({
      [lowerQuantile.toUpperCase()]:
        seasonalMetricData.pLevels[seasonalQuantiles.indexOf(lowerQuantile)],
      [upperQuantile.toUpperCase()]:
        seasonalMetricData.pLevels[seasonalQuantiles.indexOf(upperQuantile)]
    } as SeasonalPValue);
  }

  return seasonalMetrics;
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
  delta = false,
  gsp = false
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
  gsp?: boolean;
}) => {
  const [nHourForecast] = useGlobalState("nHourForecast");

  const data = useMemo(() => {
    if (forecastData && pvRealDayAfterData && pvRealDayInData && timeTrigger) {
      const timeNow = formatISODateString(get30MinNow());
      const chartMap: Record<string, ChartData> = {};

      const addDataToMap = (
        dataPoint: any,
        getDatetimeUtc: (dp: any) => string,
        getPvdata: (dp: any) => Partial<ChartDataBase>
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
        const settlementPeriod = getSettlementPeriodForDate(date);
        chartMap[key].SETTLEMENT_PERIOD = settlementPeriod;
        if (!gsp) {
          const { seasonalMean, seasonalBounds } = getSeasonalMetricsForDate(date);

          chartMap[key].SEASONAL_MEAN = seasonalMean[settlementPeriod - 1] * NATIONAL_CAPACITY;
          chartMap[key].SEASONAL_BOUNDS = seasonalBounds.map((boundPair) => Object.keys(boundPair));
          for (const boundPair of seasonalBounds) {
            for (const [index, bound] of Object.entries(boundPair)) {
              if (bound) {
                chartMap[key][`SEASONAL_${index as SeasonalQuantile}`] =
                  bound[settlementPeriod - 1] * NATIONAL_CAPACITY;
              }
            }
            chartMap[key][
              `SEASONAL_BOUND_${Object.keys(boundPair).join(
                "_"
              )}` as `SEASONAL_BOUND_${SeasonalQuantile}_${SeasonalQuantile}`
            ] = Object.values(boundPair).map((bound) => {
              if (bound) {
                return bound[settlementPeriod - 1] * NATIONAL_CAPACITY;
              }
              return 0;
            });
          }
        }
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

  return data;
};

export default useFormatChartData;
