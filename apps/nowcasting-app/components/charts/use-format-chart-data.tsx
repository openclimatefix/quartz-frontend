import { useMemo } from "react";
import { useGlobalState } from "../helpers/globalState";
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
import { getAvailablePLevels, getUtcHalfHourIndex } from "../helpers/chartUtils";
import type { TimeSeries } from "../../lib/domain/types";
import { useSeasonalNorms, type SeasonalNormsData } from "../../hooks/data/use-seasonal-norms";
import { useFocusedCountry } from "../../hooks/data/use-countries";
import { cadenceMinutesFor, cursorNow, slotForInstant } from "../../lib/time/cursor";

const NATIONAL_CAPACITY = 21504.629;

/**
 * One series' points in the shape this hook works in: MW, keyed by the raw instant string.
 *
 * The canonical `TimeSeries` — from `forecastSeries`, `modelSeries`, `nHourSeries` and
 * `generationSeries` — collapses into this via `fromTimeSeries` below.
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
 * the bug class B8 belongs to.
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

const getSeasonalMetricsForDate = (
  date: DateTime<Valid> | DateTime<Invalid>,
  nationalMetrics: SeasonalNormsData
) => {
  if (date.isValid === false)
    return { seasonalMean: [] as number[], seasonalBounds: [] as SeasonalBound[] };

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
      // `SeasonalPValue`'s declared shape is one number per quantile; what is actually built
      // here (and always was, pre-Phase-5 — this was silently `any` behind an `@ts-ignore`
      // upstream) is one *48-slot array* per quantile, indexed by UTC half-hour slot below.
      // `as unknown as` documents that mismatch rather than hiding it inside `any` again.
    } as unknown as SeasonalPValue);
  }

  return seasonalMetrics;
};

const useFormatChartData = ({
  forecastSeries,
  modelSeries,
  nHourSeries,
  generationSeries,
  timeTrigger,
  delta = false,
  gsp = false
}: {
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
  const nationalMetrics = useSeasonalNorms();
  // The past/future split has to land on a row this chart actually has, and the rows are the
  // focused country's timestamps — so it steps on that country's cadence, not on the shared
  // cursor's finest-enabled one. Enabling NL alongside GB puts the cursor on a 15-minute grid
  // that GB never publishes: the boundary row would then compare as past, and `FUTURE` would
  // start one slot late, which draws as a gap at "now".
  const focusedCountry = useFocusedCountry();
  const cadenceMinutes = cadenceMinutesFor(focusedCountry);

  const data = useMemo(() => {
    // The row order of the output follows first-write order and is pinned by the
    // characterisation tests, so `generationSeries`' own order is preserved here.
    const generation: ResolvedSeries[] = (generationSeries ?? []).map(({ key, series }) => ({
      key,
      points: fromTimeSeries(series)
    }));
    const primaryPoints = fromTimeSeries(forecastSeries);
    const models: ResolvedSeries[] = (modelSeries ?? []).map(({ key, series }) => ({
      key,
      points: fromTimeSeries(series)
    }));
    const nHourPoints = fromTimeSeries(nHourSeries);

    // The guard, generalised: the primary forecast, every generation series the country has,
    // and a time trigger. Under v0 that was literally "forecast + both pvlive regimes"; the
    // count of generation series is now a country fact, so a single-observer country waits
    // for one series rather than forever for a second that does not exist.
    const generationReady = generation.every((series) => !!series.points);

    if (primaryPoints && generationReady && timeTrigger) {
      // The split boundary is compared against *data keys*, which are this country's labels —
      // so it has to be the label of the period currently filling, not the cursor instant that
      // names it. `cursorNow` spells a period start now (one rule for every country, see
      // `periodStartForInstant`); `slotForInstant` puts it back into the country's own naming.
      // Without that step a period-end country splits one period early.
      const timeNow = formatISODateString(slotForInstant(cursorNow(cadenceMinutes), focusedCountry));
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
        // `nationalMetrics` is `undefined` both while the fetch is in flight and permanently
        // for a country with `seasonalNorms: null` (NL). Either way: no seasonal keys written,
        // rather than falling back to whatever country's dataset last happened to be loaded.
        if (!gsp && nationalMetrics) {
          const { seasonalMean, seasonalBounds } = getSeasonalMetricsForDate(date, nationalMetrics);

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
    // B6 lives here: `delta` and `gsp` are read above but deliberately still absent below,
    // because the characterisation tests pin the stale behaviour and fixing it is a separate,
    // triaged change.
  }, [
    forecastSeries,
    modelSeries,
    nHourSeries,
    generationSeries,
    timeTrigger,
    nHourForecast,
    pLevels,
    nationalMetrics,
    cadenceMinutes
  ]);

  return data;
};

export default useFormatChartData;
