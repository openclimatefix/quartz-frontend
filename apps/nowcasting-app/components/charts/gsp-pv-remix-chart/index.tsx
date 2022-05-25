import { FC } from "react";
import RemixLine from "../remix-line";
import useFormatChartData from "../use-format-chart-data";
import { formatISODateString } from "../../utils";
import ForecastHeaderGSP from "./forecast-header-gsp";
import useGetGspData from "./use-get-gsp-data";
import Spinner from "../../spinner";

const GspPvRemixChart: FC<{ gspId: number; selectedTime: string; close: () => void }> = ({
  gspId,
  selectedTime,
  close,
}) => {
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
  if (!fcAll || !pvRealDataIn || !pvRealDataAfter) return <Spinner></Spinner>;
  const forcastAtSelectedTime: NonNullable<typeof gspForecastData>[number] =
    gspForecastData?.find((fc) => formatISODateString(fc?.targetTime) === selectedTime) ||
    ({} as any);
  const pvPercentage = (forcastAtSelectedTime.expectedPowerGenerationNormalized || 0) * 100;
  return (
    <>
      <div className="bg-black">
        <ForecastHeaderGSP onClose={close} title={gspInfo?.regionName || ""}>
          {pvPercentage}% | {forcastAtSelectedTime.expectedPowerGenerationMegawatts?.toFixed(2)} /{" "}
          {gspInfo?.installedCapacityMw}
          <span className=" ml-2 font-bold">MW</span>
        </ForecastHeaderGSP>
      </div>

      <div className=" h-60 mt-8 ">
        <RemixLine timeOfInterest={selectedTime} data={chartData} />
      </div>
    </>
  );
};

export default GspPvRemixChart;
