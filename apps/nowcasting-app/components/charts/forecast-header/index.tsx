import React, { useMemo } from "react";
import { get30MinNow } from "../../globalState";
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
  const nextPvForecastInGW = MWtoGW(
    pvForecastData?.find(
      (fc) => formatISODateString(fc.targetTime) === formatISODateString(timeNow),
    )?.expectedPowerGenerationMegawatts || 0,
  );
  const selectedPvForecastInGW = MWtoGW(
    pvForecastData?.find((fc) => formatISODateString(fc.targetTime) === selectedTime)
      ?.expectedPowerGenerationMegawatts || 0,
  );
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

  return (
    <ForecastHeaderUI
      forcastNextPV={nextPvForecastInGW}
      actualPV={selectedPvActualInGW}
      forcastPV={selectedPvForecastInGW}
      selectedTimeOnly={convertISODateStringToLondonTime(selectedTime)}
    >
      <PlayButton
        startTime={get30MinNow()}
        endTime={pvForecastData[pvForecastData.length - 1].targetTime}
      ></PlayButton>
    </ForecastHeaderUI>
  );
};

export default ForecastHeader;
