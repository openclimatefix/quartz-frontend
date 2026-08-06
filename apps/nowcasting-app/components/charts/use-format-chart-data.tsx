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
import { getAvailablePLevels, getUtcHalfHourIndex } from "../helpers/chartUtils";
import type { TimeSeries } from "../../lib/domain/types";

const NATIONAL_CAPACITY = 21504.629;

/**
 * One series' points in the shape this hook works in: MW, keyed by the raw instant string.
 *
 * Both input dialects collapse into this — the v1 canonical `TimeSeries` the national chart
 * now passes, and the v0 `ForecastData`/`PvRealData` arrays the GSP and delta views still
 * pass. Those views belong to a later migration step and are not this agent's to change, so
 * the v0 props stay accepted and adapted rather than removed.
 */
type SeriesPoint = {
  timeUtc: string;
  powerMw: number;
  /** Keyed `plevel_10`, `plevel_90`, … as `getAvailablePLevels` expects. */
  plevels?: Record<string, number | undefined>;
};

/** A series and the `ChartData` key it writes. `points: undefined` means "not loaded yet". */
export type ChartSeriesInput = {
  key: string;
  series?: TimeSeries;
};

type ResolvedSeries = { key: string; points?: SeriesPoint[] };

/**
 * Canonical -> internal. Points with `powerMw: null` are DROPPED rather than written as 0:
 * the canonical model distinguishes "no reading" from a genuine zero, and collapsing them is
 * the bug class B8 belongs to. (The v0 adapters below preserve v0's `null / 1000 === 0`
 * behaviour instead, because the tests that pin the GSP and delta views depend on it.)
 */
const fromTimeSeries = (series?: TimeSeries): SeriesPoint[] | undefined =>
  series?.values.reduce<SeriesPoint[]>((points, value) => {
    if (value.powerMw === null) return points;
    points.push({
      timeUtc: value.timeUtc,
      powerMw: value.powerMw,
      plevels: value.plevelsMw
        ? Object.fromEntries(
            Object.entries(value.plevelsMw).map(([level, mw]) => [
              `plevel_${level}`,
              mw === null ? undefined : mw
            ])
          )
        : undefined
    });
    return points;
  }, []);

const fromV0Forecast = (data?: ForecastData): SeriesPoint[] | undefined =>
  data?.map((fc) => ({
    timeUtc: fc.targetTime,
    powerMw: fc.expectedPowerGenerationMegawatts,
    plevels: fc.plevels as Record<string, number | undefined> | undefined
  }));

const fromV0PvReal = (data?: PvRealData): SeriesPoint[] | undefined =>
  data?.map((pv) => ({
    timeUtc: pv.datetimeUtc,
    // Preserved exactly, NaN and all: `null / 1000` is 0 and `undefined / 1000` is NaN, and
    // both are pinned by the characterisation tests.
    powerMw: (pv.solarGenerationKw as number) / 1000
  }));

//separate paste forecast from future forecast (ie: after selectedTime)
const getForecastChartData = (
  timeNow: string,
  fr?: SeriesPoint,
  forecast_horizon?: number,
  forecast_key: string = "FORECAST"
) => {
  if (!fr) return {};

  const futureKey = forecast_horizon ? `N_HOUR_${forecast_key}` : forecast_key;
  const pastKey = forecast_horizon ? `N_HOUR_PAST_${forecast_key}` : `PAST_${forecast_key}`;

  if (new Date(fr.timeUtc).getTime() > new Date(timeNow + ":00.000Z").getTime())
    return {
      [futureKey]: fr.powerMw
    };
  else if (new Date(fr.timeUtc).getTime() === new Date(timeNow + ":00.000Z").getTime())
    return {
      [futureKey]: fr.powerMw,
      [pastKey]: fr.powerMw
    };
  else
    return {
      [pastKey]: fr.powerMw
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
  forecastSeries,
  modelSeries,
  nHourSeries,
  generationSeries,
  timeTrigger,
  delta = false,
  gsp = false
}: {
  /** @deprecated v0 shape. The GSP and delta views still pass these; the national chart does not. */
  forecastData?: ForecastData;
  /** @deprecated v0 shape — superseded by `modelSeries`. */
  nationalIntradayECMWFOnlyData?: ForecastData;
  /** @deprecated v0 shape — superseded by `modelSeries`. */
  nationalMetOfficeOnly?: ForecastData;
  /** @deprecated v0 shape — superseded by `modelSeries`. */
  nationalSatOnly?: ForecastData;
  /** @deprecated v0 shape — superseded by `modelSeries`. */
  nationalPvnetDayAhead?: ForecastData;
  /** @deprecated v0 shape — superseded by `modelSeries`. */
  nationalPvnetIntraday?: ForecastData;
  /** @deprecated v0 shape — superseded by `nHourSeries`. */
  fourHourData?: ForecastData;
  /**
   * @deprecated Never read: the p-levels have always been taken off the primary forecast
   * series itself. Kept only because the v0 callers still pass it.
   */
  probabilisticRangeData?: ForecastData;
  /** @deprecated v0 shape — superseded by `generationSeries`. */
  pvRealDayAfterData?: PvRealData;
  /** @deprecated v0 shape — superseded by `generationSeries`. */
  pvRealDayInData?: PvRealData;
  /** The primary forecast: writes `FORECAST`/`PAST_FORECAST` and supplies the p-levels. */
  forecastSeries?: TimeSeries;
  /** Comparison models, from the country's `nationalChartSeries` minus its primary entry. */
  modelSeries?: ChartSeriesInput[];
  /** The N-hour lead-time forecast. */
  nHourSeries?: TimeSeries;
  /**
   * Observed generation, one entry per observer the country actually has. GB has two
   * (`GENERATION`, `GENERATION_UPDATED`); NL has one. Never assume a pair.
   */
  generationSeries?: ChartSeriesInput[];
  timeTrigger?: string;
  delta?: boolean;
  gsp?: boolean;
}) => {
  const [nHourForecast] = useGlobalState("nHourForecast");
  const [pLevels] = useGlobalState("pLevels");

  const data = useMemo(() => {
    // Whichever dialect the caller speaks, reduced to one list of (key, points) pairs.
    //
    // The v0 order — day-after truth, then day-in truth — is preserved because the row order
    // of the output follows first-write order and is pinned by the characterisation tests.
    const generation: ResolvedSeries[] = generationSeries
      ? generationSeries.map(({ key, series }) => ({ key, points: fromTimeSeries(series) }))
      : [
          { key: "GENERATION_UPDATED", points: fromV0PvReal(pvRealDayAfterData) },
          { key: "GENERATION", points: fromV0PvReal(pvRealDayInData) }
        ];
    const primaryPoints = forecastSeries
      ? fromTimeSeries(forecastSeries)
      : fromV0Forecast(forecastData);
    const models: ResolvedSeries[] = modelSeries
      ? modelSeries.map(({ key, series }) => ({ key, points: fromTimeSeries(series) }))
      : [
          { key: "INTRADAY_ECMWF_ONLY", points: fromV0Forecast(nationalIntradayECMWFOnlyData) },
          { key: "PVNET_DAY_AHEAD", points: fromV0Forecast(nationalPvnetDayAhead) },
          { key: "PVNET_INTRADAY", points: fromV0Forecast(nationalPvnetIntraday) },
          { key: "MET_OFFICE_ONLY", points: fromV0Forecast(nationalMetOfficeOnly) },
          { key: "SAT_ONLY", points: fromV0Forecast(nationalSatOnly) }
        ];
    const nHourPoints = nHourSeries ? fromTimeSeries(nHourSeries) : fromV0Forecast(fourHourData);

    // The guard, generalised: the primary forecast, every generation series the country has,
    // and a time trigger. Under v0 that was literally "forecast + both pvlive regimes"; the
    // count of generation series is now a country fact, so a single-observer country waits
    // for one series rather than forever for a second that does not exist.
    const generationReady = generation.every((series) => !!series.points);

    if (primaryPoints && generationReady && timeTrigger) {
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

      for (const { key, points } of generation) {
        points?.forEach((point) =>
          addDataToMap(
            point,
            (db: SeriesPoint) => db.timeUtc,
            (db: SeriesPoint) => ({ [key]: db.powerMw })
          )
        );
      }
      primaryPoints.forEach((fc) => {
        addDataToMap(
          fc,
          (db: SeriesPoint) => db.timeUtc,
          (db: SeriesPoint) => getForecastChartData(timeNow, db)
        );
        if (fc.plevels && pLevels.length) {
          const plevelValues = fc.plevels;
          const availablePLevels = getAvailablePLevels(plevelValues, pLevels);
          if (availablePLevels.length) {
            addDataToMap(
              fc,
              (db: SeriesPoint) => db.timeUtc,
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

      for (const { key, points } of models) {
        if (points) {
          points.forEach((fc) => {
            addDataToMap(
              fc,
              (db: SeriesPoint) => db.timeUtc,
              (db: SeriesPoint) => getForecastChartData(timeNow, db, undefined, key)
            );
          });
        }
      }

      // Add seasonal norm data
      for (const key of Object.keys(chartMap)) {
        const date = DateTime.fromISO(key).toUTC();
        // The seasonal-norm arrays in national_metrics.json are bucketed by UTC time-of-day (the
        // generator groups on `datetime_gmt`), so they are indexed by the UTC half-hour slot —
        // NOT by the GB settlement period, which is counted from Europe/London midnight and runs
        // two slots ahead throughout BST. These used to be the same call (B9). `getUtcHalfHourIndex`
        // must stay UTC: localising it would shift every seasonal line by two slots all summer.
        const utcSlotIndex = getUtcHalfHourIndex(date);
        if (!gsp) {
          const { seasonalMean, seasonalBounds } = getSeasonalMetricsForDate(date);

          chartMap[key].SEASONAL_MEAN = seasonalMean[utcSlotIndex] * NATIONAL_CAPACITY;
          chartMap[key].SEASONAL_BOUNDS = seasonalBounds.map((boundPair) => Object.keys(boundPair));
          for (const boundPair of seasonalBounds) {
            for (const [index, bound] of Object.entries(boundPair)) {
              if (bound) {
                chartMap[key][`SEASONAL_${index as SeasonalQuantile}`] =
                  bound[utcSlotIndex] * NATIONAL_CAPACITY;
              }
            }
            chartMap[key][
              `SEASONAL_BOUND_${Object.keys(boundPair).join(
                "_"
              )}` as `SEASONAL_BOUND_${SeasonalQuantile}_${SeasonalQuantile}`
            ] = Object.values(boundPair).map((bound) => {
              if (bound) {
                return bound[utcSlotIndex] * NATIONAL_CAPACITY;
              }
              return 0;
            });
          }
        }
      }

      if (nHourPoints) {
        nHourPoints.forEach((fc) =>
          addDataToMap(
            fc,
            (db: SeriesPoint) => db.timeUtc,
            (db: SeriesPoint) => getForecastChartData(timeNow, db, nHourForecast * 60)
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
    // B6 lives here: `nationalMetOfficeOnly`, `nationalSatOnly`, `delta` and `gsp` are read
    // above but deliberately still absent below, because the characterisation tests pin the
    // stale behaviour and fixing it is a separate, triaged change. The canonical inputs added
    // for the national chart ARE listed — they are new, so there is no pinned staleness to
    // preserve, and omitting them would have made the new path silently stale from birth.
  }, [
    forecastData,
    fourHourData,
    pvRealDayInData,
    pvRealDayAfterData,
    forecastSeries,
    modelSeries,
    nHourSeries,
    generationSeries,
    timeTrigger,
    nHourForecast,
    nationalIntradayECMWFOnlyData,
    nationalPvnetDayAhead,
    nationalPvnetIntraday,
    probabilisticRangeData,
    pLevels
  ]);

  return data;
};

export default useFormatChartData;
