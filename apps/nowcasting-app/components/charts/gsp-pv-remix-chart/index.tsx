import RemixLine from "../remix-line";
import useFormatChartData from "../use-format-chart-data";
import {
  convertISODateStringToLondonTime,
  formatISODateString,
  getRoundedTickBoundary,
  KWtoMW
} from "../../helpers/utils";
import ForecastHeaderGSP from "./forecast-header-gsp";
import useGetGspData from "./use-get-gsp-data";
import useGlobalState, { get30MinNow, getNext30MinSlot } from "../../helpers/globalState";
import Spinner from "../../icons/spinner";
import { ForecastValue } from "../../types";
import React, { FC } from "react";
import { NationalAggregation } from "../../map/types";
import { getTicks } from "../../helpers/chartUtils";
import { Y_MAX_TICKS } from "../../../constant";

const GspPvRemixChart: FC<{
  selectedRegions: string[];
  selectedTime: string;
  close: () => void;
  setTimeOfInterest: (t: string) => void;
  timeNow: string;
  resetTime: () => void;
  visibleLines: string[];
  deltaView?: boolean;
}> = ({
  selectedRegions,
  selectedTime,
  close,
  setTimeOfInterest,
  timeNow,
  resetTime,
  visibleLines,
  deltaView = false
}) => {
  const [nationalAggregationLevel] = useGlobalState("nationalAggregationLevel");
  let {
    errors,
    loading,
    pvRealDataAfter,
    pvRealDataIn,
    gspLocationInfo,
    gspForecastDataOneGSP,
    gspNHourData
  } = useGetGspData(selectedRegions);
  // const gspData = fcAll?.forecasts.find((fc) => fc.location.gspId === gspId);
  const gspInstalledCapacity =
    gspLocationInfo?.reduce((acc, gsp) => acc + gsp.installedCapacityMw, 0) || 0;
  const gspName = gspLocationInfo?.[0]?.regionName;
  const chartData = useFormatChartData({
    forecastData: gspForecastDataOneGSP,
    fourHourData: gspNHourData,
    pvRealDayInData: pvRealDataIn,
    pvRealDayAfterData: pvRealDataAfter,
    timeTrigger: selectedTime,
    delta: deltaView
  });
  if (errors.length) {
    console.log(errors);
    return <div>failed to load</div>;
  }
  const now30min = formatISODateString(get30MinNow());
  const dataMissing =
    !gspForecastDataOneGSP ||
    !pvRealDataIn ||
    !pvRealDataAfter ||
    loading.gspForecastSelectedGSPsLoading ||
    loading.pvRealInDayLoading ||
    loading.pvRealDayAfterLoading;
  const forecastAtSelectedTime: NonNullable<typeof gspForecastDataOneGSP>[number] =
    gspForecastDataOneGSP?.find((fc) => formatISODateString(fc?.targetTime) === now30min) ||
    ({} as any);
  const pvPercentage = (forecastAtSelectedTime.expectedPowerGenerationNormalized || 0) * 100;

  const fourHourForecastAtSelectedTime: ForecastValue =
    gspNHourData?.find((fc) => formatISODateString(fc?.targetTime) === now30min) ||
    ({} as ForecastValue);

  //

  // get the latest Actual pv value in GW
  const latestPvActualInMW = KWtoMW(pvRealDataIn?.[0]?.solarGenerationKw || 0);

  // get pv time
  const latestPvActualDatetime = pvRealDataIn?.[0]?.datetimeUtc || timeNow;

  // Use the same time for the Forecast historic
  const pvForecastDatetime = formatISODateString(latestPvActualDatetime);

  // Get the next OCF forecast following the latest PV actual datetime
  const followingPvForecastDatetime = getNext30MinSlot(new Date(latestPvActualDatetime));
  const followingPvForecastDateString = formatISODateString(
    followingPvForecastDatetime.toISOString()
  );

  // Get the next OCF forecast for the last PV value time
  const correspondingLatestPvForecast = gspForecastDataOneGSP?.find(
    (fc) => formatISODateString(fc.targetTime) === pvForecastDatetime
  );
  const correspondingLatestPvForecastInMW =
    correspondingLatestPvForecast?.expectedPowerGenerationMegawatts || 0;
  // Get the next OCF forecast
  const followingPvForecastInMW =
    gspForecastDataOneGSP?.find(
      (fc) => formatISODateString(fc.targetTime) === followingPvForecastDateString
    )?.expectedPowerGenerationMegawatts || 0;

  const deltaValue = dataMissing
    ? "---"
    : (Number(latestPvActualInMW) - Number(correspondingLatestPvForecastInMW)).toFixed(1);

  //

  // set ymax to the installed capacity of the graph
  let yMax = gspInstalledCapacity || 100;
  yMax = getRoundedTickBoundary(yMax, Y_MAX_TICKS);

  let title =
    nationalAggregationLevel === NationalAggregation.GSP
      ? gspName || ""
      : String(selectedRegions[0]);
  let selectedGSPNames =
    selectedRegions.length > 1 ? gspLocationInfo?.map((gsp) => gsp.regionName) || [] : [];

  if (selectedRegions.length > 1) {
    title = `${selectedRegions.length} GSPs selected`;
  }

  if (nationalAggregationLevel === NationalAggregation.national) {
    title = "National GSP Sum";
  }

  return (
    <>
      <div className="flex-initial">
        <ForecastHeaderGSP
          onClose={close}
          title={title}
          mwpercent={Math.round(pvPercentage)}
          pvTimeOnly={convertISODateStringToLondonTime(latestPvActualDatetime)}
          pvValue={Number(latestPvActualInMW)?.toFixed(1)}
          forecastPV={correspondingLatestPvForecastInMW?.toFixed(1)}
          forecastNextTimeOnly={convertISODateStringToLondonTime(
            followingPvForecastDatetime.toISOString()
          )}
          forecastNextPV={followingPvForecastInMW?.toFixed(1)}
          deltaValue={deltaValue.toString()}
          deltaView={deltaView}
          titleTooltipText={selectedGSPNames}
        >
          <span className="font-semibold dash:3xl:text-5xl dash:xl:text-4xl xl:text-3xl lg:text-2xl md:text-xl text-lg leading-none text-ocf-yellow-500">
            {Math.round(forecastAtSelectedTime.expectedPowerGenerationMegawatts || 0)}
          </span>

          <span className="font-semibold dash:3xl:text-5xl dash:xl:text-4xl xl:text-3xl lg:text-2xl md:text-xl text-lg leading-none text-white">
            {" "}
            / {gspInstalledCapacity}
          </span>
          <span className="text-xs dash:text-2xl text-ocf-gray-300"> MW</span>
        </ForecastHeaderGSP>
      </div>
      <div className="flex-1 relative">
        {dataMissing && (
          <div className="h-full absolute flex pb-7 items-center justify-center inset-0 z-30">
            <Spinner />
          </div>
        )}
        <RemixLine
          setTimeOfInterest={setTimeOfInterest}
          timeOfInterest={selectedTime}
          data={chartData}
          yMax={yMax!}
          timeNow={timeNow}
          resetTime={resetTime}
          visibleLines={visibleLines}
          deltaView={deltaView}
          deltaYMaxOverride={Math.ceil(Number(gspInstalledCapacity) / 200) * 100 || 500}
          yTicks={getTicks(yMax, Y_MAX_TICKS)}
        />
      </div>
    </>
  );
};

export default GspPvRemixChart;
