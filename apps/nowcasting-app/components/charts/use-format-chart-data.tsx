import { useMemo } from "react";
import { get30MinNow, useGlobalState } from "../helpers/globalState";
import { ForecastData, PvRealData } from "../types";
import { formatISODateString, getDeltaBucket } from "../helpers/utils";
import {
  ChartData,
  ChartDataBase,
  getPLevelRangeKey,
  SeasonalBound,
  SeasonalPValue,
  SeasonalQuantile
} from "./remix-line";
import { DateTime } from "luxon";
import { Invalid, Valid } from "luxon/src/_util";
import nationalMetrics from "../../data/national_metrics.json";
import { getAvailablePLevels, getSettlementPeriodForDate } from "../helpers/chartUtils";

const NATIONAL_CAPACITY = 21504.629;
const MOCK_HORIZON_SLOTS = 72; // 36h of half-hourly slots

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
      [futureKey]: fr.expectedPowerGenerationMegawatts,
      [pastKey]: fr.expectedPowerGenerationMegawatts
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
    } else if (datum.FORECAST !== undefined && datum["N_HOUR_FORECAST"] !== undefined) {
      return Number(datum.FORECAST) - Number(datum["N_HOUR_FORECAST"]);
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

// Shared by the real per-point loop below and mockValuesGenerator, so both sources of chart
// points get identical settlement-period + seasonal-mean/bound fields from one place.
const applySeasonalFields = (
  point: ChartData,
  date: DateTime<Valid> | DateTime<Invalid>,
  settlementPeriod: number
) => {
  const { seasonalMean, seasonalBounds } = getSeasonalMetricsForDate(date);
  point.SEASONAL_MEAN = seasonalMean[settlementPeriod - 1] * NATIONAL_CAPACITY;
  point.SEASONAL_BOUNDS = seasonalBounds.map((boundPair) => Object.keys(boundPair));
  for (const boundPair of seasonalBounds) {
    for (const [index, bound] of Object.entries(boundPair)) {
      if (bound) {
        point[`SEASONAL_${index as SeasonalQuantile}`] =
          bound[settlementPeriod - 1] * NATIONAL_CAPACITY;
      }
    }
    point[
      `SEASONAL_BOUND_${Object.keys(boundPair).join(
        "_"
      )}` as `SEASONAL_BOUND_${SeasonalQuantile}_${SeasonalQuantile}`
    ] = Object.values(boundPair).map((bound) =>
      bound ? bound[settlementPeriod - 1] * NATIONAL_CAPACITY : 0
    );
  }
};

// Fabricates MOCK_HORIZON_SLOTS of teaser forecast data past "now" for trial-expired users,
// whose real future values are stripped at the fetch layer (see axiosFetcherAuth). The shape
// comes from the seasonal climatology, scaled to the day's own peak so it continues the real
// curve rather than jumping to an arbitrary value. Mutates chartMap in place.
const mockValuesGenerator = (
  chartMap: Record<string, ChartData>,
  timeNow: string,
  pLevels: [number, number][]
) => {
  const peak = Object.values(chartMap)
    .filter((p) => p.formattedDate <= timeNow && p.SEASONAL_MEAN && p.PAST_FORECAST)
    .sort((a, b) => b.PAST_FORECAST! - a.PAST_FORECAST!)[0];
  if (!peak) return;

  const peakForecast = peak.PAST_FORECAST!;
  // Ratio, not a flat offset, so the curve tapers to 0 at dawn/dusk exactly where the seasonal
  // mean does instead of being cut off at a still-elevated value.
  const scale = peakForecast / peak.SEASONAL_MEAN!;
  const bands = pLevels.flatMap(([lower, upper]) => {
    const key = getPLevelRangeKey(lower, upper);
    const range = peak[key];
    return range ? [{ key, ratio: (range[1] - range[0]) / 2 / peakForecast }] : [];
  });
  const widestRatio = Math.max(0, ...bands.map((b) => b.ratio));

  // The first point sits exactly on the "now" slot: truncation removes the real entry there
  // (it's a future slot), and the LIVE/timeOfInterest reference lines target that category on
  // the x-axis — with no data point at it they silently don't render at all.
  let cursor = DateTime.fromISO(timeNow + ":00.000Z", { zone: "utc" });
  for (let i = 0; i < MOCK_HORIZON_SLOTS; i++) {
    const key = cursor.toISO() as string;
    const settlementPeriod = getSettlementPeriodForDate(cursor);
    const point: ChartData = {
      formattedDate: formatISODateString(key),
      SETTLEMENT_PERIOD: settlementPeriod
    };
    applySeasonalFields(point, cursor, settlementPeriod);
    const forecast = point.SEASONAL_MEAN! * scale;
    point.FORECAST = forecast;
    if (i === 0) point.PAST_FORECAST = forecast;
    point.PROBABILISTIC_UPPER_BOUND = forecast * (1 + widestRatio);
    for (const { key: rangeKey, ratio } of bands) {
      const halfWidth = forecast * ratio;
      point[rangeKey] = [Math.max(0, forecast - halfWidth), forecast + halfWidth];
    }

    chartMap[key] = point;
    cursor = cursor.plus({ minutes: 30 });
  }
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
  gsp = false,
  appendTeaserForecast = false
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
  appendTeaserForecast?: boolean;
}) => {
  const [nHourForecast] = useGlobalState("nHourForecast");
  const [pLevels] = useGlobalState("pLevels");

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
        if (fc.plevels && pLevels.length) {
          const plevelValues = fc.plevels as Record<string, number | undefined>;
          const availablePLevels = getAvailablePLevels(plevelValues, pLevels);
          if (availablePLevels.length) {
            addDataToMap(
              fc,
              (db) => db.targetTime,
              () =>
                Object.fromEntries([
                  // widest selected upper bound, so the chart's y-axis zoom fits every band
                  [
                    "PROBABILISTIC_UPPER_BOUND",
                    Math.max(
                      ...availablePLevels.map(([, hi]) => plevelValues[`plevel_${hi}`] as number)
                    )
                  ],
                  // one [min, max] range per selected pair, for the shaded bands
                  ...availablePLevels.map(([lo, hi]) => [
                    getPLevelRangeKey(lo, hi),
                    [plevelValues[`plevel_${lo}`], plevelValues[`plevel_${hi}`]]
                  ])
                ])
            );
          }
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
        const date = DateTime.fromISO(key).toUTC();
        const settlementPeriod = getSettlementPeriodForDate(date);
        chartMap[key].SETTLEMENT_PERIOD = settlementPeriod;
        if (!gsp) applySeasonalFields(chartMap[key], date, settlementPeriod);
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
      if (appendTeaserForecast) {
        mockValuesGenerator(chartMap, timeNow, pLevels);
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
    probabilisticRangeData,
    pLevels,
    appendTeaserForecast
  ]);

  return data;
};

export default useFormatChartData;
