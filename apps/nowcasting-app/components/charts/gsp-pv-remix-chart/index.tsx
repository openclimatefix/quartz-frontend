import { FC } from "react";
import RemixLine from "../remix-line";
import useFormatChartData from "../use-format-chart-data";
import { formatISODateString } from "../../helpers/utils";
import ForecastHeaderGSP from "./forecast-header-gsp";
import useGetGspData from "./use-get-gsp-data";
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
}> = ({ gspId, selectedTime, close, setTimeOfInterest, timeNow, resetTime }) => {
  const { errors, fcAll, pvRealDataAfter, pvRealDataIn } = useGetGspData(gspId);
  const gspData = fcAll?.forecasts.find((fc) => fc.location.gspId === gspId);
  const gspForecastData = gspData?.forecastValues;
  const gspInfo = gspData?.location;
  const chartData = useFormatChartData({
    forecastData: gspForecastData,
    pvRealDayInData: pvRealDataIn,
    pvRealDayAfterData: pvRealDataAfter,
    timeTrigger: selectedTime
  });
  if (errors.length) return <div>failed to load</div>;
  if (!fcAll || !pvRealDataIn || !pvRealDataAfter)
    return (
      <div className="h-60  flex">
        <Spinner />
      </div>
    );
  const forcastAtSelectedTime: NonNullable<typeof gspForecastData>[number] =
    gspForecastData?.find((fc) => formatISODateString(fc?.targetTime) === selectedTime) ||
    ({} as any);
  const pvPercentage = (forcastAtSelectedTime.expectedPowerGenerationNormalized || 0) * 100;

  // set ymax to the installed capacity of the graph
  let yMax = gspInfo?.installedCapacityMw || 100;

  // lets round it up to the 'yMax_levels' so that the y major ticks look right.
  for (var i = 0; i < yMax_levels.length; i++) {
    var level = yMax_levels[i];
    yMax = yMax < level ? level : yMax;
    if (yMax === level) {
      break;
    }
  }

  return (
    <>
      <div className="bg-black">
        <ForecastHeaderGSP
          onClose={close}
          title={gspInfo?.regionName || ""}
          mwpercent={Math.round(pvPercentage)}
        >
          <span className="font-semibold lg:text-lg md:text-lg text-med text-ocf-yellow-500">
            {Math.round(forcastAtSelectedTime.expectedPowerGenerationMegawatts || 0)}
          </span>
          <span className="font-semibold lg:text-lg md:text-lg text-med text-white">
            /{gspInfo?.installedCapacityMw}
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
        />
      </div>
    </>
  );
};

export default GspPvRemixChart;
