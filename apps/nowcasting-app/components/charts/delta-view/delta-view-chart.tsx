import { Dispatch, FC, SetStateAction, useEffect, useMemo } from "react";
import RemixLine from "../remix-line";
import { DELTA_BUCKET, MAX_NATIONAL_GENERATION_MW, Y_MAX_TICKS } from "../../../constant";
import ForecastHeader from "../forecast-header";
import useGlobalState, { get30MinSlot } from "../../helpers/globalState";
import useFormatChartData from "../use-format-chart-data";
import {
  calculateChartYMax,
  convertToLocaleDateString,
  formatISODateString
} from "../../helpers/utils";
import GspPvRemixChart from "../gsp-pv-remix-chart";
import { useStopAndResetTime } from "../../hooks/use-and-update-selected-time";
import Spinner from "../../icons/spinner";
import { InfoIcon, LegendLineGraphIcon } from "../../icons/icons";
import { CombinedData, CombinedErrors, NationalEndpointStates, GspDeltaValue } from "../../types";
import Tooltip from "../../tooltip";
import { ChartInfo } from "../../../ChartInfo";
import DeltaForecastLabel from "../../delta-forecast-label";
import DeltaBuckets from "./delta-buckets-ui";
import useTimeNow from "../../hooks/use-time-now";
import { ChartLegend } from "../ChartLegend";
import DataLoadingChartStatus from "../DataLoadingChartStatus";
import { getTicks } from "../../helpers/chartUtils";

const GspDeltaColumn: FC<{
  gspDeltas: Map<string, GspDeltaValue> | undefined;
  negative?: boolean;
}> = ({ gspDeltas, negative = false }) => {
  const [selectedBuckets] = useGlobalState("selectedBuckets");
  const [selectedMapRegionIds, setSelectedMapRegionIds] = useGlobalState("selectedMapRegionIds");
  const deltaArray = useMemo(() => Array.from(gspDeltas?.values() || []), [gspDeltas]);
  if (!gspDeltas?.size) return null;

  const sortFunc = (a: GspDeltaValue, b: GspDeltaValue) => {
    if (negative) {
      return a.delta - b.delta;
    } else {
      return b.delta - a.delta;
    }
  };

  let hasRows = false;
  return (
    <>
      <div className={`flex flex-col flex-1`}>
        {deltaArray.sort(sortFunc).map((gspDelta) => {
          let bucketColor = "";
          let dataKey = "";
          let progressLineColor = "";
          if (negative && gspDelta.delta >= 0) {
            return null;
          }
          if (!negative && gspDelta.delta <= 0) {
            return null;
          }
          switch (gspDelta.deltaBucket) {
            case DELTA_BUCKET.NEG4:
              bucketColor = "border-ocf-delta-100";
              progressLineColor = "bg-ocf-delta-100";
              dataKey = "-4";
              break;
            case DELTA_BUCKET.NEG3:
              bucketColor = "border-ocf-delta-200";
              progressLineColor = "bg-ocf-delta-200";
              dataKey = "-3";
              break;
            case DELTA_BUCKET.NEG2:
              bucketColor = "border-ocf-delta-300";
              progressLineColor = "bg-ocf-delta-300";
              dataKey = "-2";
              break;
            case DELTA_BUCKET.NEG1:
              bucketColor = "border-ocf-delta-400";
              progressLineColor = "bg-ocf-delta-400";
              dataKey = "-1";
              break;
            case DELTA_BUCKET.ZERO:
              bucketColor = "border-white border-opacity-40";
              progressLineColor = "bg-white bg-opacity-40";
              dataKey = "0";
              break;
            case DELTA_BUCKET.POS1:
              bucketColor = "border-ocf-delta-600";
              progressLineColor = "bg-ocf-delta-600";
              dataKey = "1";
              break;
            case DELTA_BUCKET.POS2:
              bucketColor = "border-ocf-delta-700";
              progressLineColor = "bg-ocf-delta-700";
              dataKey = "2";
              break;
            case DELTA_BUCKET.POS3:
              bucketColor = "border-ocf-delta-800";
              progressLineColor = "bg-ocf-delta-800";
              dataKey = "3";
              break;
            case DELTA_BUCKET.POS4:
              bucketColor = "border-ocf-delta-900";
              progressLineColor = "bg-ocf-delta-900";
              dataKey = "4";
              break;
          }

          const bucketIsSelected = selectedBuckets.includes(gspDelta.deltaBucketKey);
          if (bucketIsSelected && !hasRows) {
            hasRows = true;
          }

          const isSelectedGsp =
            gspDelta.gspId &&
            selectedMapRegionIds?.map((gspId) => Number(gspId)).includes(Number(gspDelta.gspId));

          // this is normalized putting the delta value over the installed capacity of a gsp
          const deltaNormalizedPercentage = Math.abs(
            Number(gspDelta.deltaNormalized) * 100
          ).toFixed(0);

          const tickerColor = `${isSelectedGsp ? `h-2.5` : `h-2`} ${
            gspDelta.delta > 0 ? `bg-ocf-delta-900` : `bg-ocf-delta-100`
          }`;

          const deltaRowClasses = `bg-ocf-delta-950`;

          const selectedDeltaRowClasses = `bg-ocf-gray-800 items-end`;

          if (!bucketIsSelected) {
            return null;
          }

          return (
            <div
              className={`mb-0.5 border-mapbox-black-600 border ${
                isSelectedGsp ? selectedDeltaRowClasses : deltaRowClasses
              } ${
                negative ? "rounded-l" : "rounded-r"
              } box-content cursor-pointer relative flex w-full transition duration-200 ease-out 
              hover:bg-ocf-gray-900 hover:ease-in`}
              key={`gspCol${gspDelta.gspId}`}
              onClick={() => setSelectedMapRegionIds([String(gspDelta.gspId)])}
            >
              <div
                className={`items-start xl:items-center text-xs grid grid-cols-12 flex-1 py-1.5 justify-between px-2 
                transition duration-200 ease-out hover:ease-in ${bucketColor} ${
                  gspDelta.delta > 0 ? `border-l-8` : `border-r-8`
                }`}
                key={`gspCol${gspDelta.gspId}`}
              >
                <div className="col-span-10 xl:col-span-5 flex-initial flex justify-between self-stretch items-center dash:max-w-full">
                  <span className="">{gspDelta.gspRegion}</span>
                  {/* normalized percentage: delta value/gsp installed mw capacity */}
                </div>
                <div className="col-span-2 xl:col-span-2 flex">
                  <DeltaForecastLabel
                    className="flex-1 text-right justify-end xl:justify-start "
                    tip={
                      <div className="px-1 text-xs">
                        <p>{"Normalized Delta"}</p>
                      </div>
                    }
                  >
                    <span className={"self-stretch opacity-80"}>
                      {negative ? "-" : "+"}
                      {deltaNormalizedPercentage}%
                    </span>
                  </DeltaForecastLabel>
                </div>

                {/* delta value in mw */}
                <div className="col-span-6 xl:col-span-2 flex justify-start">
                  <DeltaForecastLabel
                    tip={
                      <div className="w-28 text-xs">
                        <p>{"Delta to Forecast"}</p>
                      </div>
                    }
                  >
                    <div>
                      <p>
                        {!negative && "+"}
                        <span className="font-semibold">
                          {Number(gspDelta.delta).toFixed(0)}
                        </span>{" "}
                        <span className="opacity-80 text-2xs font-thin">MW</span>
                      </p>
                    </div>
                  </DeltaForecastLabel>
                </div>

                {/* currentYield/forecasted yield */}
                <div className="col-span-6 xl:col-span-3">
                  <DeltaForecastLabel
                    tip={
                      <div className="px-1 text-xs">
                        <p>{"Actual PV / Forecast"}</p>
                      </div>
                    }
                  >
                    <div className="flex flex-1 items-end justify-end text-right font-semibold">
                      <div>
                        <span className={"text-black"}>
                          {Number(gspDelta.currentYield).toFixed(0)}
                        </span>{" "}
                        /{" "}
                        <span className="text-ocf-yellow">
                          {Number(gspDelta.forecast).toFixed(0)}
                        </span>{" "}
                        <span className={`opacity-80 text-2xs font-thin`}>MW</span>
                      </div>
                    </div>
                  </DeltaForecastLabel>
                </div>
                {/*</div>*/}
              </div>
              <div className={`absolute bottom-0 right-0 left-0 ${bucketColor}`}>
                <div
                  className={`flex items-end justify-end ${
                    gspDelta.delta > 0 ? `bottom-0 flex-row-reverse ml-2` : `mr-2`
                  }`}
                >
                  <div
                    className={`${isSelectedGsp ? `h-1.5` : `h-1`} bg-ocf-gray-800`}
                    style={{ width: `2px` }}
                  ></div>
                  <div
                    className={`${isSelectedGsp ? `h-1.5` : `h-1`} ${progressLineColor}`}
                    style={{ width: `${deltaNormalizedPercentage}%` }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}

        {!hasRows && (
          <div className={`${negative ? "pr-1.5" : "pl-1.5"}`}>
            <div
              className={`flex flex-col flex-1 items-center justify-center border-dashed border border-ocf-gray-400 rounded-md p-6`}
            >
              <span className="text-sm text-center text-ocf-gray-400">
                No {negative ? "negative" : "positive"} GSP deltas <br />
                for current filters
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
type DeltaChartProps = {
  date?: string;
  className?: string;
  combinedData: CombinedData;
  combinedErrors: CombinedErrors;
};
const DeltaChart: FC<DeltaChartProps> = ({ className, combinedData, combinedErrors }) => {
  const [selectedMapRegionIds, setSelectedMapRegionIds] = useGlobalState("selectedMapRegionIds");
  const [visibleLines] = useGlobalState("visibleLines");
  const [selectedBuckets] = useGlobalState("selectedBuckets");
  const [selectedISOTime, setSelectedISOTime] = useGlobalState("selectedISOTime");
  const [timeNow] = useGlobalState("timeNow");
  const [loadingState] = useGlobalState("loadingState");
  const { stopTime, resetTime } = useStopAndResetTime();
  const selectedTime = formatISODateString(selectedISOTime || new Date().toISOString());
  const selectedTimeHalfHourSlot = get30MinSlot(new Date(convertToLocaleDateString(selectedTime)));
  const hasGspPvInitialForSelectedTime = combinedData.pvRealDayInData?.find(
    (d) =>
      d.datetimeUtc.slice(0, 16) ===
      `${formatISODateString(selectedTimeHalfHourSlot.toISOString())}`
  );

  const {
    nationalForecastData,
    pvRealDayInData,
    pvRealDayAfterData,
    nationalNHourData,
    allGspForecastData,
    allGspRealData,
    gspDeltas
  } = combinedData;
  const {
    nationalForecastError,
    pvRealDayInError,
    pvRealDayAfterError,
    nationalNHourError,
    allGspForecastError
  } = combinedErrors;

  // const chartLimits = useMemo(
  //   () =>
  //     nationalForecastData?.[0] && {
  //       start: nationalForecastData[0].targetTime,
  //       end: nationalForecastData[nationalForecastData.length - 1].targetTime
  //     },
  //   [nationalForecastData]
  // );
  // useHotKeyControlChart(chartLimits);

  const chartData = useFormatChartData({
    forecastData: nationalForecastData,
    fourHourData: nationalNHourData,
    pvRealDayInData,
    pvRealDayAfterData,
    timeTrigger: selectedTime,
    delta: true
  });

  const yMax = useMemo(() => {
    return calculateChartYMax(chartData, MAX_NATIONAL_GENERATION_MW);
  }, [chartData]);

  // While N-hour is not available, we default to the latest interval with an Initial Estimate
  // useEffect(() => {
  //   if (selectedISOTime === get30MinNow() && view === VIEWS.DELTA) {
  //     setSelectedISOTime(get30MinNow(-60));
  //   }
  // }, [view]);

  if (
    nationalForecastError ||
    pvRealDayInError ||
    pvRealDayAfterError ||
    nationalNHourError ||
    allGspForecastError
  )
    return <div className={`h-full flex ${className}`}>Failed to load data.</div>;

  if (!nationalForecastData || !pvRealDayInData || !pvRealDayAfterData)
    return (
      <div className={`h-full flex ${className}`}>
        <Spinner></Spinner>
      </div>
    );

  const setSelectedTime = (time: string) => {
    stopTime();
    setSelectedISOTime(time + ":00.000Z");
  };

  let selectedRegions: string[] = [];
  if (selectedMapRegionIds && selectedMapRegionIds.length > 0) {
    selectedRegions = selectedMapRegionIds.map((id) => String(id));
  }

  return (
    <>
      <div className={`flex flex-col flex-1 ${className || ""}`}>
        <div className="flex flex-1 flex-col relative">
          <ForecastHeader
            pvForecastData={nationalForecastData}
            pvLiveData={pvRealDayInData}
            deltaView={true}
          ></ForecastHeader>
          <div className={"flex-1 relative"}>
            <DataLoadingChartStatus<NationalEndpointStates> loadingState={loadingState} />
            <RemixLine
              resetTime={resetTime}
              timeNow={formatISODateString(timeNow)}
              timeOfInterest={selectedTime}
              setTimeOfInterest={setSelectedTime}
              data={chartData}
              yMax={yMax}
              yTicks={getTicks(yMax, Y_MAX_TICKS)}
              visibleLines={visibleLines}
              deltaView={true}
            />
          </div>
        </div>
        {selectedMapRegionIds?.length && (
          <div className="flex-1 flex flex-col relative dash:h-auto">
            <GspPvRemixChart
              close={() => {
                setSelectedMapRegionIds([]);
              }}
              setTimeOfInterest={setSelectedTime}
              selectedTime={selectedTime}
              selectedRegions={selectedRegions}
              timeNow={formatISODateString(timeNow)}
              resetTime={resetTime}
              visibleLines={visibleLines}
              deltaView={true}
            ></GspPvRemixChart>
          </div>
        )}
        <div
          className={`flex flex-col flex-grow-0 flex-shrink${
            hasGspPvInitialForSelectedTime ? " overflow-y-scroll" : ""
          } ${selectedMapRegionIds?.length ? "h-[30%]" : "h-[40%]"}`}
        >
          <DeltaBuckets bucketSelection={selectedBuckets} gspDeltas={gspDeltas} />
          {!hasGspPvInitialForSelectedTime && (
            <div className="flex flex-1 m-3 p-4 font-thin tracking-wide border border-dashed border-ocf-gray-600 rounded-md justify-center items-center text-center text-ocf-gray-600">
              [ Delta values not available until PV Live output available ]
            </div>
          )}
          {hasGspPvInitialForSelectedTime && gspDeltas && (
            <div className="flex pt-2 mx-3 max-h-96">
              <GspDeltaColumn gspDeltas={gspDeltas} negative />
              <GspDeltaColumn gspDeltas={gspDeltas} />
            </div>
          )}
        </div>
      </div>
      {!className?.includes("hidden") && <ChartLegend />}
    </>
  );
};

export default DeltaChart;
