import { Dispatch, FC, SetStateAction, useEffect, useMemo } from "react";
import RemixLine from "../remix-line";
import { DELTA_BUCKET, MAX_NATIONAL_GENERATION_MW } from "../../../constant";
import ForecastHeader from "../forecast-header";
import useGlobalState, { get30MinNow, getNext30MinSlot } from "../../helpers/globalState";
import useFormatChartData from "../use-format-chart-data";
import { formatISODateString, getRounded4HoursAgoString } from "../../helpers/utils";
import GspPvRemixChart from "../gsp-pv-remix-chart";
import { useStopAndResetTime } from "../../hooks/use-and-update-selected-time";
import Spinner from "../../icons/spinner";
import useHotKeyControlChart from "../../hooks/use-hot-key-control-chart";
import { InfoIcon, LegendLineGraphIcon } from "../../icons/icons";
import { CombinedData, CombinedErrors, GspDeltaValue } from "../../types";
import Tooltip from "../../tooltip";
import { ChartInfo } from "../../../ChartInfo";
import DeltaForecastLabel from "../../delta-forecast-label";
import DeltaBuckets from "./delta-buckets-ui";

const LegendItem: FC<{
  iconClasses: string;
  label: string;
  dashed?: boolean;
  dataKey: string;
  show4hrView: boolean | undefined;
}> = ({ iconClasses, label, dashed, dataKey, show4hrView }) => {
  const [visibleLines, setVisibleLines] = useGlobalState("visibleLines");
  const isVisible = visibleLines.includes(dataKey);

  const toggleLineVisibility = () => {
    if (isVisible) {
      setVisibleLines(visibleLines.filter((line) => line !== dataKey));
    } else {
      setVisibleLines([...visibleLines, dataKey]);
    }
  };

  return (
    <div className="flex items-center">
      <LegendLineGraphIcon className={iconClasses} dashed={dashed} />
      <button className="text-left pl-1 max-w-full" onClick={toggleLineVisibility}>
        <span
          className={`uppercase block whitespace-nowrap ${show4hrView ? "pr-3" : "pr-6"} pl-1${
            isVisible ? " font-extrabold" : ""
          }`}
        >
          {label}
        </span>
      </button>
    </div>
  );
};

const GspDeltaColumn: FC<{
  gspDeltas: Map<number, GspDeltaValue>;
  setClickedGspId: Dispatch<SetStateAction<number | undefined>>;
  negative?: boolean;
}> = ({ gspDeltas, setClickedGspId, negative = false }) => {
  const [selectedBuckets] = useGlobalState("selectedBuckets");
  const [clickedGspId] = useGlobalState("clickedGspId");
  if (!gspDeltas.size) return null;

  const sortFunc = (a: GspDeltaValue, b: GspDeltaValue) => {
    if (negative) {
      return a.delta - b.delta;
    } else {
      return b.delta - a.delta;
    }
  };

  const deltaArray = Array.from(gspDeltas.values());
  console.log("deltaArray", deltaArray);
  let hasRows = false;
  return (
    <>
      <div className={`flex flex-col flex-1 mb-24 ${!negative ? "pl-3" : "pr-3 "}`}>
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

          const isSelected = selectedBuckets.includes(gspDelta.deltaBucketKey);
          if (isSelected && !hasRows) {
            hasRows = true;
          }

          // this is normalized putting the delta value over the installed capacity of a gsp
          const deltaNormalizedPercentage = Math.abs(
            Number(gspDelta.deltaNormalized) * 100
          ).toFixed(0);

          const tickerColor = `${clickedGspId === gspDelta.gspId ? `h-2.5` : `h-2`} ${
            gspDelta.delta > 0 ? `bg-ocf-delta-900` : `bg-ocf-delta-100`
          }`;

          const selectedClasses = `${bucketColor} transition duration-200 ease-out hover:ease-in items-end`;

          const selectedDeltaClass = `bg-ocf-gray-800 ${bucketColor} items-end`;

          if (!isSelected) {
            return null;
          }

          return (
            <div
              className={`mb-0.5 bg-ocf-delta-950 cursor-pointer relative flex w-full transition duration-200 ease-out hover:bg-ocf-gray-800 hover:ease-in`}
              key={`gspCol${gspDelta.gspId}`}
              onClick={() => setClickedGspId(gspDelta.gspId)}
            >
              <div
                className={`static items-center flex flex-1 py-2 justify-between pl-1 pr-1 ${
                  clickedGspId === gspDelta.gspId ? selectedDeltaClass : selectedClasses
                } ${gspDelta.delta > 0 ? `border-l-8` : `border-r-8`}`}
                key={`gspCol${gspDelta.gspId}`}
              >
                <div className="flex-initial pl-1 max-w-[35%] 2xl:max-w-full">
                  <span className="">{gspDelta.gspRegion}</span>
                </div>
                <div className="flex flex-initial flex-end justify-around items-center">
                  {/* normalized percentage: delta value/gsp installed mw capacity */}
                  <DeltaForecastLabel
                    tip={
                      <div className="w-28 text-xs">
                        <p>{"Normalized Delta"}</p>
                      </div>
                    }
                  >
                    <div className="flex pr-3 text-right opacity-80 text-sm">
                      <p>
                        {negative ? "-" : "+"}
                        {deltaNormalizedPercentage}%
                      </p>
                    </div>
                  </DeltaForecastLabel>

                  {/* delta value in mw */}
                  <DeltaForecastLabel
                    tip={
                      <div className="w-28 text-xs">
                        <p>{"Delta to Forecast"}</p>
                      </div>
                    }
                  >
                    <div className="flex pr-3 font-semibold justify-start">
                      <div>
                        <p>
                          {!negative && "+"}
                          {Number(gspDelta.delta).toFixed(0)}{" "}
                          <span className="opacity-80 text-xs font-thin">MW</span>
                        </p>
                      </div>
                    </div>
                  </DeltaForecastLabel>

                  {/* currentYield/forecasted yield */}
                  <DeltaForecastLabel
                    tip={
                      <div className="w-28 text-xs">
                        <p>{"Actual PV / Forecast"}</p>
                      </div>
                    }
                  >
                    <div className="flex flex-col pr-1 text-left font-semibold text-sm">
                      <div>
                        {Number(gspDelta.currentYield).toFixed(0)}/
                        {Number(gspDelta.forecast).toFixed(0)}{" "}
                        <span className={`opacity-80 text-xs font-thin`}>MW</span>
                      </div>
                    </div>
                  </DeltaForecastLabel>
                </div>
              </div>
              <div className={`absolute bottom-0 right-0 left-0 ${bucketColor}`}>
                <div
                  className={`flex items-end justify-end ${
                    gspDelta.delta > 0 ? `bottom-0 flex-row-reverse ml-2` : `mr-2`
                  }`}
                >
                  <div className={tickerColor} style={{ width: `1px` }}></div>
                  <div
                    className={`${
                      clickedGspId === gspDelta.gspId ? `h-1.5` : `h-1`
                    } ${progressLineColor}`}
                    style={{ width: `${deltaNormalizedPercentage}%` }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}

        {!hasRows && (
          <div className={`${negative ? "pl" : "pr"}-3`}>
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
  const [show4hView] = useGlobalState("show4hView");
  const [clickedGspId, setClickedGspId] = useGlobalState("clickedGspId");
  const [visibleLines] = useGlobalState("visibleLines");
  const [selectedBuckets] = useGlobalState("selectedBuckets");
  const [selectedISOTime, setSelectedISOTime] = useGlobalState("selectedISOTime");
  const [timeNow] = useGlobalState("timeNow");
  const [forecastCreationTime] = useGlobalState("forecastCreationTime");
  const { stopTime, resetTime } = useStopAndResetTime();
  const selectedTime = formatISODateString(selectedISOTime || new Date().toISOString());
  const selectedTimeHalfHourSlot = getNext30MinSlot(new Date(selectedTime));
  const halfHourAgoDate = new Date(timeNow).setMinutes(new Date(timeNow).getMinutes() - 30);
  const halfHourAgo = `${formatISODateString(new Date(halfHourAgoDate).toISOString())}:00Z`;

  const {
    nationalForecastData,
    pvRealDayInData,
    pvRealDayAfterData,
    national4HourData,
    allGspForecastData,
    allGspRealData,
    gspDeltas
  } = combinedData;
  const {
    nationalForecastError,
    pvRealDayInError,
    pvRealDayAfterError,
    national4HourError,
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
    fourHourData: national4HourData,
    pvRealDayInData,
    pvRealDayAfterData,
    timeTrigger: selectedTime,
    delta: true
  });

  // While 4-hour is not available, we default to the latest interval with an Initial Estimate
  useEffect(() => {
    setSelectedISOTime(get30MinNow(-30));
  }, []);

  if (
    nationalForecastError ||
    pvRealDayInError ||
    pvRealDayAfterError ||
    national4HourError ||
    allGspForecastError
  )
    return <div>Failed to load data.</div>;

  if (!nationalForecastData || !pvRealDayInData || !pvRealDayAfterData)
    return (
      <div className="h-full flex">
        <Spinner></Spinner>
      </div>
    );

  const setSelectedTime = (time: string) => {
    stopTime();
    setSelectedISOTime(time + ":00.000Z");
  };
  const fourHoursAgo = getRounded4HoursAgoString();
  const legendItemContainerClasses = "flex flex-initial flex-col xl:flex-col justify-between";
  return (
    <div className={`flex flex-col flex-1 mb-1 ${className || ""}`}>
      <div className="flex-auto flex flex-col mb-7">
        <ForecastHeader
          pvForecastData={nationalForecastData}
          pvLiveData={pvRealDayInData}
          deltaview={true}
        ></ForecastHeader>

        <div className="h-60 mt-4 mb-10">
          <RemixLine
            resetTime={resetTime}
            timeNow={formatISODateString(timeNow)}
            timeOfInterest={selectedTime}
            setTimeOfInterest={setSelectedTime}
            data={chartData}
            yMax={MAX_NATIONAL_GENERATION_MW}
            visibleLines={visibleLines}
            deltaView={true}
          />
        </div>
        {clickedGspId && (
          <GspPvRemixChart
            close={() => {
              setClickedGspId(undefined);
            }}
            setTimeOfInterest={setSelectedTime}
            selectedTime={selectedTime}
            gspId={clickedGspId}
            timeNow={formatISODateString(timeNow)}
            resetTime={resetTime}
            visibleLines={visibleLines}
            deltaView={true}
          ></GspPvRemixChart>
        )}
        <div>
          <DeltaBuckets bucketSelection={selectedBuckets} gspDeltas={gspDeltas} />
        </div>
        <div className="flex flex-1 justify-between mb-15">
          {selectedTimeHalfHourSlot.toISOString() >= halfHourAgo && (
            <div className="flex flex-1 mb-16 px-4 justify-center items-center text-center text-ocf-gray-600 w-full">
              [ Delta values not available for times in the future ]
            </div>
          )}
          {selectedTimeHalfHourSlot.toISOString() < halfHourAgo && (
            <GspDeltaColumn gspDeltas={gspDeltas} negative setClickedGspId={setClickedGspId} />
          )}
          {selectedTimeHalfHourSlot.toISOString() < halfHourAgo && (
            <GspDeltaColumn gspDeltas={gspDeltas} setClickedGspId={setClickedGspId} />
          )}
        </div>
      </div>
      <div
        className="absolute bottom-0 left-0 right-0 flex flex-none justify-start align-items:baseline
                   px-4 text-xs tracking-wider text-ocf-gray-300 pt-3 bg-mapbox-black-500 overflow-y-visible"
      >
        <div className={`flex flex-1 flex-row pb-3 overflow-x-scroll${show4hView ? "" : ""}`}>
          <div className={legendItemContainerClasses}>
            <LegendItem
              iconClasses={"text-ocf-black"}
              dashed
              label={"PV live initial estimate"}
              dataKey={`GENERATION`}
              show4hrView={show4hView}
            />
            <LegendItem
              iconClasses={"text-ocf-black"}
              label={"PV live updated"}
              dataKey={`GENERATION_UPDATED`}
              show4hrView={show4hView}
            />
          </div>
          <div className={legendItemContainerClasses}>
            <LegendItem
              iconClasses={"text-ocf-yellow"}
              dashed
              label={"OCF Forecast"}
              dataKey={`FORECAST`}
              show4hrView={show4hView}
            />
            <LegendItem
              iconClasses={"text-ocf-yellow"}
              label={"OCF Final Forecast"}
              dataKey={`PAST_FORECAST`}
              show4hrView={show4hView}
            />
          </div>
          {show4hView && (
            <div className={legendItemContainerClasses}>
              <LegendItem
                iconClasses={"text-ocf-orange"}
                dashed
                label={`OCF ${fourHoursAgo} Forecast`}
                dataKey={`4HR_FORECAST`}
                show4hrView={show4hView}
              />
              <LegendItem
                iconClasses={"text-ocf-orange"}
                label={"OCF 4hr Forecast"}
                dataKey={`4HR_PAST_FORECAST`}
                show4hrView={show4hView}
              />
            </div>
          )}
        </div>
        <div className="flex-initial flex items-center pl-3 pb-3">
          <Tooltip tip={<ChartInfo />} position="top" className={"text-right"} fullWidth>
            <InfoIcon />
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

export default DeltaChart;
