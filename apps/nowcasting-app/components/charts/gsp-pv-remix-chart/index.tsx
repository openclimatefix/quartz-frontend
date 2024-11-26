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

// We want to have the ymax of the graph to be related to the capacity of the GspPvRemixChart
// If we use the raw values, the graph looks funny, i.e y major ticks are 0 100 232
// So, we round these up to the following numbers
const yMax_levels = [
  3, 9, 20, 28, 36, 45, 60, 80, 100, 120, 160, 200, 240, 300, 320, 360, 400, 450, 600
];

const GspPvRemixChart: FC<{
  gspId: number;
  selectedTime: string;
  close: () => void;
  setTimeOfInterest: (t: string) => void;
  timeNow: string;
  resetTime: () => void;
  visibleLines: string[];
  deltaView?: boolean;
}> = ({
  gspId,
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
    pvRealDataAfter,
    pvRealDataIn,
    gspLocationInfo,
    gspForecastDataOneGSP,
    gspNHourData
  } = useGetGspData(gspId);
  // TODO – temp reset; if aggregation is zones, make sure data is all set
  if ([NationalAggregation.DNO, NationalAggregation.zone].includes(nationalAggregationLevel)) {
    gspLocationInfo = [];
    gspNHourData = [];
  }
  // const gspData = fcAll?.forecasts.find((fc) => fc.location.gspId === gspId);
  const gspInstalledCapacity = gspLocationInfo?.[0]?.installedCapacityMw;
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
  const dataMissing = !gspForecastDataOneGSP || !pvRealDataIn || !pvRealDataAfter;
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
  yMax = getRoundedTickBoundary(yMax, yMax_levels);

  const title =
    nationalAggregationLevel === NationalAggregation.GSP ? gspName || "" : String(gspId);

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
        />
      </div>
    </>
  );
};

export default GspPvRemixChart;
