import React from "react";
import useGlobalState, { get30MinNow, getNext30MinSlot } from "../../helpers/globalState";
import useTimeNow from "../../hooks/use-time-now";
import PlayButton from "../../play-button";
import { PvRealData, ForecastData } from "../../types";
import {
  convertISODateStringToLondonTime,
  dateToLondonDateTimeString,
  formatISODateAsLondonTime,
  formatISODateString,
  KWtoGW,
  MWtoGW
} from "../../helpers/utils";
import ForecastHeaderUI from "./ui";
import { DeltaHeaderBlock } from "../delta-view/delta-header-ui";

type ForecastHeaderProps = {
  pvLiveData: PvRealData;
  pvForecastData: ForecastData;
  deltaView: boolean;
};

const ForecastHeader: React.FC<ForecastHeaderProps> = ({
  pvLiveData,
  pvForecastData,
  deltaView
}) => {
  const timeNow = useTimeNow();

  // get the latest Actual pv value in GW
  const selectedPvActualInGW = pvLiveData?.length
    ? KWtoGW(pvLiveData?.[0]?.solarGenerationKw)
    : "0.0";

  // get pv times
  const latestPvActualDatetime = pvLiveData?.[0]?.datetimeUtc || timeNow;

  // Use the same time for the Forecast historic
  const pvForecastDatetime = formatISODateString(latestPvActualDatetime) || timeNow;

  // Get the next OCF forecast following the latest PV actual datetime
  const followingPvForecastDatetime = latestPvActualDatetime
    ? getNext30MinSlot(new Date(latestPvActualDatetime))
    : new Date(timeNow);
  const followingPvForecastDateString = formatISODateString(
    followingPvForecastDatetime.toISOString()
  );

  // Get the next OCF forecast for the last PV value time
  const selectedPvForecastInGW = MWtoGW(
    pvForecastData?.find((fc) => formatISODateString(fc.targetTime) === pvForecastDatetime)
      ?.expectedPowerGenerationMegawatts || 0
  );

  // Get the next OCF forecast
  const nextPvForecastInGW = MWtoGW(
    pvForecastData?.find(
      (fc) => formatISODateString(fc.targetTime) === followingPvForecastDateString
    )?.expectedPowerGenerationMegawatts || 0
  );

  if (deltaView) {
    const deltaValue = (Number(selectedPvActualInGW) - Number(selectedPvForecastInGW)).toFixed(2);
    return (
      <ForecastHeaderUI
        forecastNextPV={nextPvForecastInGW}
        actualPV={selectedPvActualInGW}
        forecastPV={selectedPvForecastInGW}
        pvTimeOnly={convertISODateStringToLondonTime(latestPvActualDatetime) || ""}
        forecastNextTimeOnly={formatISODateAsLondonTime(followingPvForecastDatetime)}
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
      pvTimeOnly={convertISODateStringToLondonTime(latestPvActualDatetime) || ""}
      forecastNextTimeOnly={formatISODateAsLondonTime(followingPvForecastDatetime)}
    >
      <PlayButton
        startTime={get30MinNow()}
        endTime={pvForecastData?.[pvForecastData.length - 1]?.targetTime}
      ></PlayButton>
    </ForecastHeaderUI>
  );
};

export default ForecastHeader;
