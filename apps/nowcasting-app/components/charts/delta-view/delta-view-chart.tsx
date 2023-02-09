import { Dispatch, FC, SetStateAction, useMemo } from "react";
import RemixLine from "../remix-line";
import { DELTA_BUCKET, MAX_NATIONAL_GENERATION_MW } from "../../../constant";
import ForecastHeader from "../forecast-header";
import useGlobalState from "../../helpers/globalState";
import useFormatChartData from "../use-format-chart-data";
import {
  createBucketObject,
  formatISODateString,
  getRounded4HoursAgoString
} from "../../helpers/utils";
import GspPvRemixChart from "../gsp-pv-remix-chart";
import { useStopAndResetTime } from "../../hooks/use-and-update-selected-time";
import Spinner from "../../icons/spinner";
import useHotKeyControlChart from "../../hooks/use-hot-key-control-chart";
import { InfoIcon, LegendLineGraphIcon } from "../../icons/icons";
import { CombinedData, CombinedErrors, GspDeltaValue } from "../../types";
import Tooltip from "../../tooltip";
import { ChartInfo } from "../../../ChartInfo";
import DeltaForecastLabel from "../../delta-forecast-label";

type DeltaBucketProps = {
  className?: string;
  bucketSelection?: string[];
  gspDeltas?: Map<number, GspDeltaValue>;
};

type Bucket = {
  dataKey: string;
  quantity: number;
  text: string;
  bucketColor: string;
  borderColor: string;
  lowerBound: number;
  upperBound: number;
  increment: number;
  textColor?: string;
  gspDeltas?: Map<number, GspDeltaValue>;
};

const LegendItem: FC<{
  iconClasses: string;
  label: string;
  dashed?: boolean;
  dataKey: string;
}> = ({ iconClasses, label, dashed, dataKey }) => {
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
      <button className="text-left pl-1 max-w-full w-44" onClick={toggleLineVisibility}>
        <span className={`uppercase pl-1${isVisible ? " font-extrabold" : ""}`}>{label}</span>
      </button>
    </div>
  );
};

const BucketItem: React.FC<{
  dataKey: string;
  quantity: number;
  text: string;
  bucketColor: string;
  borderColor: string;
  lowerBound: number;
  upperBound: number;
  increment: number;
  textColour?: string;
  altTextColour?: string;
}> = ({
  dataKey,
  quantity,
  text,
  bucketColor,
  borderColor,
  textColour,
  altTextColour,
  lowerBound,
  upperBound
}) => {
  const selectedClass = ``;
  const unselectedClass = `bg-opacity-0 border-2 ${borderColor}`;
  const [selectedBuckets, setSelectedBuckets] = useGlobalState("selectedBuckets");
  const isSelected = selectedBuckets.includes(dataKey);
  const toggleBucketSelection = () => {
    if (isSelected) {
      setSelectedBuckets(selectedBuckets.filter((bucket) => bucket !== dataKey));
      // setSelectedDeltas(selectedDeltas).filter((list)=> list !== deltaGroup)
    } else {
      setSelectedBuckets([...selectedBuckets, dataKey]);
    }
  };

  return (
    <>
      <div
        className={`${
          isSelected && !DELTA_BUCKET.ZERO ? `${textColour}` : `${altTextColour}`
        } justify-between flex flex-1
            flex-col items-center rounded`}
      >
        <button
          className={`flex flex-col flex-1 w-full h-16 items-center p-1 pt-2 rounded-md justify-center ${bucketColor} ${borderColor} ${
            isSelected ? selectedClass : unselectedClass
          }`}
          onClick={toggleBucketSelection}
        >
          <span className="text-2xl font-semibold">{quantity}</span>
          <span className="flex text-xs pb-2">
            {text === DELTA_BUCKET.ZERO.toString() ? `-/+` : `${text} MW`}
          </span>
        </button>
      </div>
    </>
  );
};

const DeltaBuckets: React.FC<{
  gspDeltas: Map<number, GspDeltaValue>;
  bucketSelection: string[];
  setClickedGspId?: Dispatch<SetStateAction<number | undefined>>;
  negative?: boolean;
  lowerBound?: number;
  upperBound?: number;
}> = ({ gspDeltas, negative = false }) => {
  // calculate array length here
  if (!gspDeltas.size) return null;

  const deltaArray = Array.from(gspDeltas.values());

  const groupedDeltas: Map<DELTA_BUCKET, GspDeltaValue[]> = new Map([
    [DELTA_BUCKET.NEG4, []],
    [DELTA_BUCKET.NEG3, []],
    [DELTA_BUCKET.NEG2, []],
    [DELTA_BUCKET.NEG1, []],
    [DELTA_BUCKET.ZERO, []],
    [DELTA_BUCKET.POS1, []],
    [DELTA_BUCKET.POS2, []],
    [DELTA_BUCKET.POS3, []],
    [DELTA_BUCKET.POS4, []]
  ]);
  deltaArray.forEach((delta) => {
    groupedDeltas.set(delta.deltaBucket, [...(groupedDeltas.get(delta.deltaBucket) || []), delta]);
  });
  const buckets: Bucket[] = [];
  groupedDeltas.forEach((deltaGroup, deltaBucket) => {
    buckets.push(createBucketObject(deltaBucket, deltaGroup));
  });

  return (
    <>
      <div className="flex justify-center mx-3 pb-10 gap-1 lg:gap-3">
        {buckets.map((bucket) => {
          return <BucketItem key={`Bucket-${bucket.dataKey}`} {...bucket}></BucketItem>;
        })}
      </div>
    </>
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

          const isSelectedGSP = () => {
            setClickedGspId(gspDelta.gspId);
          };

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
              onClick={isSelectedGSP}
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

  const chartLimits = useMemo(
    () =>
      nationalForecastData?.[0] && {
        start: nationalForecastData[0].targetTime,
        end: nationalForecastData[nationalForecastData.length - 1].targetTime
      },
    [nationalForecastData]
  );
  useHotKeyControlChart(chartLimits);

  const chartData = useFormatChartData({
    forecastData: nationalForecastData,
    fourHourData: national4HourData,
    pvRealDayInData,
    pvRealDayAfterData,
    timeTrigger: selectedTime,
    delta: true
  });

  if (
    nationalForecastError ||
    pvRealDayInError ||
    pvRealDayAfterError ||
    national4HourError ||
    allGspForecastError
  )
    return <div>failed to load</div>;

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
      <div className="flex-auto mb-7">
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
        <div className="flex justify-between mb-15">
          {`${selectedTime}:00.000Z` >= timeNow && (
            <div className="pt-6 pb-36 text-center text-ocf-gray-600 w-full">
              [ GSP-level delta values not yet available for future ]
            </div>
          )}
          {`${selectedTime}:00.000Z` < timeNow && (
            <GspDeltaColumn gspDeltas={gspDeltas} negative setClickedGspId={setClickedGspId} />
          )}
          {`${selectedTime}:00.000Z` < timeNow && (
            <GspDeltaColumn gspDeltas={gspDeltas} setClickedGspId={setClickedGspId} />
          )}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 flex flex-none justify-end align-items:baseline px-4 text-xs tracking-wider text-ocf-gray-300 pt-3 bg-mapbox-black-500 overflow-y-visible">
        <div className="flex flex-row pb-3 overflow-x-auto">
          <div className={legendItemContainerClasses}>
            <LegendItem
              iconClasses={"text-ocf-black"}
              dashed
              label={"PV live initial estimate"}
              dataKey={`GENERATION`}
            />
            <LegendItem
              iconClasses={"text-ocf-black"}
              label={"PV live updated"}
              dataKey={`GENERATION_UPDATED`}
            />
          </div>
          <div className={legendItemContainerClasses}>
            <LegendItem
              iconClasses={"text-ocf-yellow"}
              dashed
              label={"OCF Forecast"}
              dataKey={`FORECAST`}
            />
            <LegendItem
              iconClasses={"text-ocf-yellow"}
              label={"OCF Final Forecast"}
              dataKey={`PAST_FORECAST`}
            />
          </div>
          {show4hView && (
            <div className={legendItemContainerClasses}>
              <LegendItem
                iconClasses={"text-ocf-orange"}
                dashed
                label={`OCF ${fourHoursAgo} Forecast`}
                dataKey={`4HR_FORECAST`}
              />
              <LegendItem
                iconClasses={"text-ocf-orange"}
                label={"OCF 4hr Forecast"}
                dataKey={`4HR_PAST_FORECAST`}
              />
            </div>
          )}
        </div>
        <div className="flex-initial flex items-center pb-3">
          <Tooltip tip={<ChartInfo />} position="top" className={"text-right"} fullWidth>
            <InfoIcon />
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

export default DeltaChart;
