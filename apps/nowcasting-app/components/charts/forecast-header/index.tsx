import React from "react";
import { useFocusedCountry } from "../../../hooks/data/use-countries";
import { cadenceMinutesFor, nextSlot } from "../../../lib/time/cursor";
import useTimeNow from "../../hooks/use-time-now";
import { PvRealData, ForecastData } from "../../types";
import {
  formatDateAsZonedTime,
  formatISODateString,
  formatISODateStringAsZonedTime,
  KWtoGW,
  MWtoGW
} from "../../helpers/utils";
import { useCountryFormatting } from "../../../hooks/data/use-country-format";
import ForecastHeaderUI from "./ui";
import { DeltaHeaderBlock } from "../delta-view/delta-header-block";
import type { TimeSeries } from "../../../lib/domain/types";

type ForecastHeaderProps = {
  /** @deprecated v0 shape. Still passed by the delta view, which migrates in a later step. */
  pvLiveData?: PvRealData;
  /** @deprecated v0 shape. Still passed by the delta view, which migrates in a later step. */
  pvForecastData?: ForecastData;
  /** Canonical observed generation — the country's first observer. Wins over `pvLiveData`. */
  generationSeries?: TimeSeries;
  /** Canonical primary forecast. Wins over `pvForecastData`. */
  forecastSeries?: TimeSeries;
  deltaView: boolean;
};

/**
 * The latest point that actually carries a reading.
 *
 * v0's pvlive payload was newest-first, so the header simply took `[0]`. The canonical
 * `TimeSeries` is time-ordered ascending and its trailing slots can be `null` (published but
 * not yet reported), so "latest" has to be the last point with a number in it — `at(-1)`
 * would show a blank as 0.0 GW every half hour.
 */
const latestReading = (series?: TimeSeries) => {
  if (!series) return undefined;
  for (let i = series.values.length - 1; i >= 0; i -= 1) {
    if (typeof series.values[i].powerMw === "number") return series.values[i];
  }
  return undefined;
};

const ForecastHeader: React.FC<ForecastHeaderProps> = ({
  pvLiveData,
  pvForecastData,
  generationSeries,
  forecastSeries,
  deltaView
}) => {
  const timeNow = useTimeNow();
  const { timezone, locale } = useCountryFormatting();
  // The header reads one country's numbers, so it steps on that country's grid — 30 minutes
  // for GB, 15 for NL — rather than on the shared cursor's.
  const cadenceMinutes = cadenceMinutesFor(useFocusedCountry());

  const latestGeneration = latestReading(generationSeries);

  // get the latest Actual pv value in GW
  const selectedPvActualInGW = generationSeries
    ? MWtoGW(latestGeneration?.powerMw ?? 0)
    : pvLiveData?.length
    ? KWtoGW(pvLiveData?.[0]?.solarGenerationKw)
    : "0.0";

  // get pv times
  const latestPvActualDatetime =
    (generationSeries ? latestGeneration?.timeUtc : pvLiveData?.[0]?.datetimeUtc) || timeNow;

  // Use the same time for the Forecast historic
  const pvForecastDatetime = formatISODateString(latestPvActualDatetime) || timeNow;

  // Get the next OCF forecast following the latest PV actual datetime
  const followingPvForecastDatetime = new Date(
    latestPvActualDatetime ? nextSlot(latestPvActualDatetime, cadenceMinutes) : timeNow
  );
  const followingPvForecastDateString = formatISODateString(
    followingPvForecastDatetime.toISOString()
  );

  // One shape for both dialects, so the two lookups and the play button below read the same
  // whichever the caller passed.
  const forecastPoints: { timeUtc: string; powerMw: number }[] = forecastSeries
    ? forecastSeries.values.map((v) => ({ timeUtc: v.timeUtc, powerMw: v.powerMw ?? 0 }))
    : (pvForecastData ?? []).map((fc) => ({
        timeUtc: fc.targetTime,
        powerMw: fc.expectedPowerGenerationMegawatts
      }));
  const forecastAt = (formattedDate: string) =>
    forecastPoints.find((fc) => formatISODateString(fc.timeUtc) === formattedDate)?.powerMw || 0;

  // Get the next OCF forecast for the last PV value time
  const selectedPvForecastInGW = MWtoGW(forecastAt(pvForecastDatetime));

  // Get the next OCF forecast
  const nextPvForecastInGW = MWtoGW(forecastAt(followingPvForecastDateString));

  if (deltaView) {
    const deltaValue = (Number(selectedPvActualInGW) - Number(selectedPvForecastInGW)).toFixed(1);
    return (
      <ForecastHeaderUI
        forecastNextPV={nextPvForecastInGW}
        actualPV={selectedPvActualInGW}
        forecastPV={selectedPvForecastInGW}
        pvTimeOnly={formatISODateStringAsZonedTime(latestPvActualDatetime, timezone, locale) || ""}
        forecastNextTimeOnly={formatDateAsZonedTime(followingPvForecastDatetime, timezone, locale)}
      >
        <DeltaHeaderBlock deltaValue={deltaValue} unit={"GW"} />
      </ForecastHeaderUI>
    );
  }

  return (
    <ForecastHeaderUI
      forecastNextPV={nextPvForecastInGW}
      actualPV={selectedPvActualInGW}
      forecastPV={selectedPvForecastInGW}
      pvTimeOnly={formatISODateStringAsZonedTime(latestPvActualDatetime, timezone, locale) || ""}
      forecastNextTimeOnly={formatDateAsZonedTime(followingPvForecastDatetime, timezone, locale)}
    />
  );
};

export default ForecastHeader;
