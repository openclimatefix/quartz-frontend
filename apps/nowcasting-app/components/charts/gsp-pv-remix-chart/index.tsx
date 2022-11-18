import { FC } from "react";
import RemixLine from "../remix-line";
import useFormatChartData from "../use-format-chart-data";
import { formatISODateString, getRoundedTickBoundary } from "../../helpers/utils";
import ForecastHeaderGSP from "./forecast-header-gsp";
import useGetGspData from "./use-get-gsp-data";
import useGlobalState from "../../helpers/globalState";
import Spinner from "../../icons/spinner";

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
  //when adding 4hour forecast data back in, add gsp4HourData to list in line 27
  const { errors, fcAll, pvRealDataAfter, pvRealDataIn } = useGetGspData(gspId);
  const gspData = fcAll?.forecasts.find((fc) => fc.location.gspId === gspId);
  const gspForecastData = gspData?.forecastValues;
  const gspInfo = gspData?.location;
  const chartData = useFormatChartData({
    forecastData: gspForecastData,
    // fourHourData: gsp4HourData,
    pvRealDayInData: pvRealDataIn,
    pvRealDayAfterData: pvRealDataAfter,
    timeTrigger: selectedTime,
    delta: deltaView
  });
  if (errors.length) {
    console.log(errors);
    return <div>failed to load</div>;
  }
  if (!fcAll || !pvRealDataIn || !pvRealDataAfter)
    return (
      <div className="h-60  flex">
        <Spinner />
      </div>
    );
  const forecastAtSelectedTime: NonNullable<typeof gspForecastData>[number] =
    gspForecastData?.find((fc) => formatISODateString(fc?.targetTime) === selectedTime) ||
    ({} as any);
  const pvPercentage = (forecastAtSelectedTime.expectedPowerGenerationNormalized || 0) * 100;

  // set ymax to the installed capacity of the graph
  let yMax = gspInfo?.installedCapacityMw || 100;

  yMax = getRoundedTickBoundary(yMax, yMax_levels);

  return (
    <>
      <div className="bg-black">
        <ForecastHeaderGSP
          onClose={close}
          title={gspInfo?.regionName || ""}
          mwpercent={Math.round(pvPercentage)}
        >
          <span className="font-semibold lg:text-lg md:text-lg text-med text-ocf-yellow-500">
            {Math.round(forecastAtSelectedTime.expectedPowerGenerationMegawatts || 0)}
          </span>
          <span className="font-semibold lg:text-lg md:text-lg text-med text-white">
            {" "}
            / {gspInfo?.installedCapacityMw}
          </span>
          <span className="text-xs text-ocf-gray-300"> MW</span>
        </ForecastHeaderGSP>
      </div>

      <div className=" h-60 mt-8 ">
        <RemixLine
          setTimeOfInterest={setTimeOfInterest}
          timeOfInterest={selectedTime}
          data={chartData}
          yMax={yMax!}
          timeNow={timeNow}
          resetTime={resetTime}
          visibleLines={visibleLines}
          deltaView={deltaView}
          deltaYMaxOverride={Math.ceil(Number(gspInfo?.installedCapacityMw) / 200) * 100 || 500}
        />
      </div>
    </>
  );
};

export default GspPvRemixChart;
