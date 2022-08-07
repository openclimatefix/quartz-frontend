import React, { useMemo } from "react";
import { get30MinNow } from "../../utils";
import useTimeNow from "../../hooks/use-time-now";
import PlayButton from "../../play-button";
import { PvRealData, ForecastData } from "../../types";
import { convertISODateStringToLondonTime, formatISODateString, KWtoGW, MWtoGW } from "../../utils";
import ForecastHeaderUI from "./ui";

type ForecastHeaderProps = {
  pvUpdatedData: PvRealData;
  pvLiveData: PvRealData;
  pvForecastData: ForecastData;
  selectedTime: string;
};

const ForecastHeader: React.FC<ForecastHeaderProps> = ({
  pvUpdatedData,
  pvLiveData,
  pvForecastData,
  selectedTime,
}) => {
  const timeNow = useTimeNow();

  // get the time for the OCF Forecast
  // This should be the next Forecast if selected time is in the past,
  // or the select time
  const futurePvForecastDatetime =
    formatISODateString(timeNow) >= selectedTime ? formatISODateString(timeNow) : selectedTime;
  const futurePVForecastDatetimeLabel =
    formatISODateString(timeNow) >= selectedTime
      ? "Next"
      : convertISODateStringToLondonTime(futurePvForecastDatetime + ":00.000Z");

  // Get the next OCF forecast, for now (or future)
  const nextPvForecastInGW = MWtoGW(
    pvForecastData?.find((fc) => formatISODateString(fc.targetTime) === futurePvForecastDatetime)
      ?.expectedPowerGenerationMegawatts || 0,
  );

  // get the Actual pv value in GW
  // Try to get it from the updated values, then try initial pv data, finally just take the first
  const selectedPvActualInGW = useMemo(() => {
    const selectetpvUpdate = pvUpdatedData.find(
      (pv) => formatISODateString(pv.datetimeUtc) === selectedTime,
    )?.solarGenerationKw;
    const selectetpvLive = pvLiveData.find(
      (pv) => formatISODateString(pv.datetimeUtc) === selectedTime,
    )?.solarGenerationKw;
    const latestpvLive = pvLiveData[0].solarGenerationKw;
    return KWtoGW(selectetpvUpdate || selectetpvLive || latestpvLive);
  }, [pvUpdatedData, pvLiveData, selectedTime]);

  // get pv time
  // Try to get it from the updated values, then try initial pv data, finally just take the first
  const selectedPvActualDatetime = useMemo(() => {
    const selectetpvUpdate = pvUpdatedData.find(
      (pv) => formatISODateString(pv.datetimeUtc) === selectedTime,
    )?.datetimeUtc;
    const selectetpvLive = pvLiveData.find(
      (pv) => formatISODateString(pv.datetimeUtc) === selectedTime,
    )?.datetimeUtc;
    const latestpvLive = pvLiveData[0].datetimeUtc;
    return selectetpvUpdate || selectetpvLive || latestpvLive;
  }, [pvUpdatedData, pvLiveData, selectedTime]);

  // Use the same time for the Forecast historic
  const pvForecastDatetime = formatISODateString(selectedPvActualDatetime);

  // Get the next OCF forecast,
  // for the selected time in the past, or the last PV value time
  const selectedPvForecastInGW = MWtoGW(
    pvForecastData?.find((fc) => formatISODateString(fc.targetTime) === pvForecastDatetime)
      ?.expectedPowerGenerationMegawatts || 0,
  );

  return (
    <ForecastHeaderUI
      forcastNextPV={nextPvForecastInGW}
      actualPV={selectedPvActualInGW}
      forcastPV={selectedPvForecastInGW}
      selectedTimeOnly={convertISODateStringToLondonTime(pvForecastDatetime + ":00.000Z")}
      pvTimeOnly={convertISODateStringToLondonTime(selectedPvActualDatetime)}
      forecastNextTimeOnly={futurePVForecastDatetimeLabel}
    >
      <PlayButton
        startTime={get30MinNow()}
        endTime={pvForecastData[pvForecastData.length - 1].targetTime}
      ></PlayButton>
    </ForecastHeaderUI>
  );
};

export default ForecastHeader;
