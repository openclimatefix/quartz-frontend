import React, { useMemo } from "react";
import { get30MinNow } from "../../globalState";
import useFloorTimeNow from "../../hooks/use-time-now";
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
  const timeNow = useFloorTimeNow();
  // Get the next OCF forecast, for now
  const nextPvForecastInGW = MWtoGW(
    pvForecastData?.find(
      (fc) => formatISODateString(fc.targetTime) === formatISODateString(timeNow),
    )?.expectedPowerGenerationMegawatts || 0,
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

  // if the select time is the same as timenow, then use the PV datetime, else use the select time
  // This means that normally the forecast datetime is the same as pv,
  // unless the selected time is the same as now.
  // This is because the next OCF Forecast value shows that forecast already.
  const pvForecastDatetime =
    formatISODateString(timeNow) === selectedTime
      ? formatISODateString(selectedPvActualDatetime)
      : selectedTime;

  // Get the next OCF forecast, for selected time
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
    >
      <PlayButton
        startTime={get30MinNow()}
        endTime={pvForecastData[pvForecastData.length - 1].targetTime}
      ></PlayButton>
    </ForecastHeaderUI>
  );
};

export default ForecastHeader;
