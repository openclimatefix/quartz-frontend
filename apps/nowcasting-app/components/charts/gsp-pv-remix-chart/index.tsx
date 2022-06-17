import { FC } from "react";
import RemixLine from "../remix-line";
import useFormatChartData from "../use-format-chart-data";
import { formatISODateString } from "../../utils";
import ForecastHeaderGSP from "./forecast-header-gsp";
import useGetGspData from "./use-get-gsp-data";
import Spinner from "../../spinner";

const GspPvRemixChart: FC<{
  gspId: number;
  selectedTime: string;
  close: () => void;
  setTimeOfInterest: (t: string) => void;
}> = ({ gspId, selectedTime, close, setTimeOfInterest }) => {
  const { errors, fcAll, pvRealDataAfter, pvRealDataIn } = useGetGspData(gspId);
  const gspData = fcAll?.forecasts.find((fc) => fc.location.gspId === gspId);
  const gspForecastData = gspData?.forecastValues;
  const gspInfo = gspData?.location;
  const chartData = useFormatChartData({
    forecastData: gspForecastData,
    pvRealDataIn,
    pvRealDataAfter,
    selectedTime,
  });
  if (errors.length) return <div>failed to load</div>;
  if (!fcAll || !pvRealDataIn || !pvRealDataAfter)
    return (
      <div className="m-auto w-full h-60 flex">
        <Spinner></Spinner>
      </div>
    );
  const forcastAtSelectedTime: NonNullable<typeof gspForecastData>[number] =
    gspForecastData?.find((fc) => formatISODateString(fc?.targetTime) === selectedTime) ||
    ({} as any);
  const pvPercentage = (forcastAtSelectedTime.expectedPowerGenerationNormalized || 0) * 100;
  return (
    <>
      <div className="bg-black">
        <ForecastHeaderGSP onClose={close} title={gspInfo?.regionName || ""}>
          {Math.round(pvPercentage)}% |{" "}
          {Math.round(forcastAtSelectedTime.expectedPowerGenerationMegawatts || 0)} /{" "}
          {gspInfo?.installedCapacityMw}
          <span className=" ml-2 font-bold">MW</span>
        </ForecastHeaderGSP>
      </div>

      <div className=" h-60 mt-8 ">
        <RemixLine
          setTimeOfInterest={setTimeOfInterest}
          timeOfInterest={selectedTime}
          data={chartData}
          yMax='auto'
        />
      </div>
    </>
  );
};

export default GspPvRemixChart;
