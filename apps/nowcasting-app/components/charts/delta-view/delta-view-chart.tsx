import { Dispatch, FC, ReactElement, SetStateAction, useMemo, useState } from "react";
import RemixLine from "../remix-line";
import useSWR from "swr";
import { API_PREFIX } from "../../../constant";
import ForecastHeader from "../forecast-header";
import useGlobalState from "../../helpers/globalState";
import useFormatChartData from "../use-format-chart-data";
import {
  getRounded4HoursAgoString,
  formatISODateString,
  axiosFetcherAuth
} from "../../helpers/utils";
import GspPvRemixChart from "../gsp-pv-remix-chart";
import { useStopAndResetTime } from "../../hooks/use-and-update-selected-time";
import Spinner from "../../icons/spinner";
import { MAX_NATIONAL_GENERATION_MW } from "../../../constant";
import useHotKeyControlChart from "../../hooks/use-hot-key-control-chart";
import { InfoIcon, LegendLineGraphIcon } from "../../icons/icons";
import {
  ForecastData,
  ForecastValue,
  GspAllForecastData,
  GspDeltaValue,
  GspRealData
} from "../../types";
import Tooltip from "../../tooltip";
import { ChartInfo } from "../../../ChartInfo";
import { theme } from "../../../tailwind.config";

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
  lowerBound: number;
  upperBound: number;
  increment: number;
  textColor?: string;
}> = ({ dataKey, quantity, text, bucketColor, textColor, lowerBound, upperBound }) => {
  const selectedClass = ``;
  const unselectedClass = "opacity-40";
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
        className={`text-${textColor} justify-between flex flex-1
            flex-col items-center rounded`}
      >
        <button
          className={`flex flex-col flex-1 w-full h-16 items-center p-1 pt-3 rounded-md justify-center ${bucketColor} ${
            isSelected ? selectedClass : unselectedClass
          } ${dataKey === "0" && "border-2 border-ocf-gray-800"}`}
          onClick={toggleBucketSelection}
        >
          <span className="text-2xl font-semibold">{quantity}</span>
          <span className="flex text-xs pb-2">{text}</span>
        </button>
      </div>
    </>
  );
};

const DeltaBuckets: React.FC<{
  gspDeltas: Map<number, GspDeltaValue>;
  bucketSelection: string[];
  setClickedGspId: Dispatch<SetStateAction<number | undefined>>;
  negative?: boolean;
  lowerBound: number;
  upperBound: number;
}> = ({ gspDeltas, lowerBound, upperBound, negative = false }) => {
  // calculate array length here
  if (!gspDeltas.size) return null;

  const sortFunc = (a: GspDeltaValue, b: GspDeltaValue) => {
    if (negative) {
      return a.delta - b.delta;
    } else {
      return b.delta - a.delta;
    }
  };

  const deltaArray = Array.from(gspDeltas.values());
  // const deltaArray = Array.from(gspDeltas.values())
  // console.log(deltaArray)
  // const numberInBucket = deltaArray.filter((number) => {
  //   return number.delta > lowerBound && number.delta < upperBound

  const negativeEighty = deltaArray.filter((number) => {
    return number.delta > -200 && number.delta < -60;
  });

  const negativeSixty = deltaArray.filter((number) => {
    return number.delta > -59 && number.delta < -40;
  });

  const negativeForty = deltaArray.filter((number) => {
    return number.delta > -39 && number.delta < -20;
  });

  const negativeTwenty = deltaArray.filter((number) => {
    return number.delta > -19 && number.delta < -2;
  });

  const minimalDelta = deltaArray.filter((number) => {
    return number.delta > -2 && number.delta <= 2;
  });

  const positiveTwenty = deltaArray.filter((number) => {
    return number.delta > 2 && number.delta <= 20;
  });

  const positiveForty = deltaArray.filter((number) => {
    return number.delta > 20 && number.delta <= 40;
  });

  const positiveSixty = deltaArray.filter((number) => {
    return number.delta > 40 && number.delta <= 60;
  });

  const positiveEighty = deltaArray.filter((number) => {
    return number.delta > 60 && number.delta <= 100;
  });
  return (
    <>
      <div className="flex justify-center mx-3 pb-10 gap-1 lg:gap-3">
        <BucketItem
          dataKey={"-4"}
          text={"-80"}
          bucketColor={"bg-ocf-delta-100"}
          textColor={"ocf-black"}
          quantity={negativeEighty.length}
          lowerBound={-59}
          upperBound={-40}
          increment={1}
        ></BucketItem>
        <BucketItem
          dataKey={"-3"}
          text={"-60"}
          bucketColor={"bg-ocf-delta-200"}
          textColor={"ocf-black"}
          quantity={negativeSixty.length}
          lowerBound={-59}
          upperBound={-40}
          increment={1}
        ></BucketItem>
        <BucketItem
          dataKey={"-2"}
          text={"-40"}
          bucketColor={"bg-ocf-delta-300"}
          textColor={"ocf-black"}
          quantity={negativeForty.length}
          lowerBound={-39}
          upperBound={-20}
          increment={1}
        ></BucketItem>
        <BucketItem
          dataKey={"-1"}
          text={"-20"}
          bucketColor={"bg-ocf-delta-400"}
          textColor={"ocf-white"}
          quantity={negativeTwenty.length}
          lowerBound={-19}
          upperBound={-1}
          increment={1}
        ></BucketItem>
        <BucketItem
          dataKey={"0"}
          text={"+/- MW"}
          bucketColor={"bg-ocf-delta-500"}
          textColor={"ocf-white"}
          quantity={minimalDelta.length}
          lowerBound={-1}
          upperBound={1}
          increment={1}
        ></BucketItem>
        <BucketItem
          dataKey={"1"}
          text={"+20"}
          bucketColor={"bg-ocf-delta-600"}
          textColor={"ocf-white"}
          quantity={positiveTwenty.length}
          lowerBound={2}
          upperBound={20}
          increment={1}
        ></BucketItem>
        <BucketItem
          dataKey={"2"}
          text={"+40"}
          bucketColor={"bg-ocf-delta-700"}
          textColor={"ocf-black"}
          quantity={positiveForty.length}
          lowerBound={21}
          upperBound={39}
          increment={1}
        ></BucketItem>
        <BucketItem
          dataKey={"3"}
          text={"+60"}
          bucketColor={"bg-ocf-delta-800"}
          textColor={"ocf-black"}
          quantity={positiveSixty.length}
          lowerBound={40}
          upperBound={59}
          increment={1}
        ></BucketItem>
        <BucketItem
          dataKey={"4"}
          text={"+80"}
          bucketColor={"bg-ocf-delta-900"}
          textColor={"ocf-black"}
          quantity={positiveEighty.length}
          lowerBound={60}
          upperBound={80}
          increment={1}
        ></BucketItem>
      </div>
    </>
  );
};

const GspDeltaColumn: FC<{
  gspDeltas: Map<number, GspDeltaValue>;
  setClickedGspId: Dispatch<SetStateAction<number | undefined>>;
  negative?: boolean;
}> = ({ gspDeltas, setClickedGspId, negative = false }) => {
  if (!gspDeltas.size) return null;

  const sortFunc = (a: GspDeltaValue, b: GspDeltaValue) => {
    if (negative) {
      return a.delta - b.delta;
    } else {
      return b.delta - a.delta;
    }
  };

  const deltaArray = Array.from(gspDeltas.values());

  return (
    <>
      <div className={`flex flex-col flex-1 ${!negative ? "pl-3" : "pr-3 "}`}>
        {deltaArray.sort(sortFunc).map((gspDelta) => {
          let bucketColor = "border-ocf-delta-500";
          if (negative && gspDelta.delta >= 0) {
            return null;
          }
          if (!negative && gspDelta.delta <= 0) {
            return null;
          }
          if (-200 < gspDelta.delta && gspDelta.delta < -60) {
            bucketColor = "border-ocf-delta-100";
          } else if (-60 < gspDelta.delta && gspDelta.delta < -40) {
            bucketColor = "border-ocf-delta-200";
          } else if (-40 < gspDelta.delta && gspDelta.delta < -20) {
            bucketColor = "border-ocf-delta-300";
          } else if (-20 < gspDelta.delta && gspDelta.delta < -1) {
            bucketColor = "border-ocf-delta-400";
          } else if (-1 <= gspDelta.delta && gspDelta.delta < 2) {
            bucketColor = "border-white border-opacity-40";
          } else if (2 < gspDelta.delta && 20 > gspDelta.delta) {
            bucketColor = "border-ocf-delta-600";
          } else if (20 < gspDelta.delta && 40 > gspDelta.delta) {
            bucketColor = "border-ocf-delta-700";
          } else if (40 < gspDelta.delta && 60 > gspDelta.delta) {
            bucketColor = "border-ocf-delta-800";
          } else if ((60 < gspDelta.delta && 80 > gspDelta.delta) || gspDelta.delta > 80) {
            bucketColor = "border-ocf-delta-900";
          }

          return (
            <div
              className={`flex flex-row justify-between pb-1 pl-1 pr-1 mb-1 border-b-8 ${
                gspDelta.delta > 0 ? `border-l-4` : `border-r-4`
              }
              ${bucketColor} cursor-pointer`}
              key={`gspCol${gspDelta.gspId}`}
              onClick={() => setClickedGspId(gspDelta.gspId)}
            >
              <div className="flex flex-col">
                <span>{gspDelta.gspRegion}</span>
                <small>{gspDelta.gspId}</small>
              </div>
              <div className="flex flex-col text-right">
                <small>
                  {Number(gspDelta.currentYield).toFixed(2)} /{" "}
                  {Number(gspDelta.forecast).toFixed(2)} MW
                </small>
                <span>
                  {!negative && "+"}
                  {Number(gspDelta.delta).toFixed(2)} MW
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

const DeltaChart: FC<{ date?: string; className?: string }> = ({ className }) => {
  const [show4hView] = useGlobalState("show4hView");
  const [clickedGspId, setClickedGspId] = useGlobalState("clickedGspId");
  const [visibleLines] = useGlobalState("visibleLines");
  const [selectedBuckets] = useGlobalState("selectedBuckets");
  const [selectedISOTime, setSelectedISOTime] = useGlobalState("selectedISOTime");
  const [timeNow] = useGlobalState("timeNow");
  const [forecastCreationTime] = useGlobalState("forecastCreationTime");
  const { stopTime, resetTime } = useStopAndResetTime();
  const selectedTime = formatISODateString(selectedISOTime || new Date().toISOString());
  const { data: nationalForecastData, error } = useSWR<ForecastData>(
    `${API_PREFIX}/solar/GB/national/forecast?historic=false&only_forecast_values=true`,
    axiosFetcherAuth,
    {
      refreshInterval: 60 * 1000 * 5 // 5min
    }
  );

  const chartLimits = useMemo(
    () =>
      nationalForecastData && {
        start: nationalForecastData[0].targetTime,
        end: nationalForecastData[nationalForecastData.length - 1].targetTime
      },
    [nationalForecastData]
  );
  useHotKeyControlChart(chartLimits);

  const { data: pvRealDayInData, error: error2 } = useSWR<
    {
      datetimeUtc: string;
      solarGenerationKw: number;
    }[]
  >(`${API_PREFIX}/solar/GB/national/pvlive?regime=in-day`, axiosFetcherAuth, {
    refreshInterval: 60 * 1000 * 5 // 5min
  });

  const { data: pvRealDayAfterData, error: error3 } = useSWR<
    {
      datetimeUtc: string;
      solarGenerationKw: number;
    }[]
  >(`${API_PREFIX}/solar/GB/national/pvlive?regime=day-after`, axiosFetcherAuth, {
    refreshInterval: 60 * 1000 * 5 // 5min
  });

  const { data: national4HourData, error: pv4HourError } = useSWR<ForecastValue[]>(
    show4hView
      ? `${API_PREFIX}/solar/GB/national/forecast?forecast_horizon_minutes=240&historic=true&only_forecast_values=true`
      : null,
    axiosFetcherAuth,
    {
      refreshInterval: 60 * 1000 * 5 // 5min
    }
  );

  const { data: allGspForecastData, error: allGspForecastError } = useSWR<GspAllForecastData>(
    `${API_PREFIX}/solar/GB/gsp/forecast/all/?historic=true`,
    axiosFetcherAuth,
    {
      refreshInterval: 60 * 1000 * 5 // 5min
    }
  );

  const { data: allGspPvData, error: allGspPvError } = useSWR<GspRealData[]>(
    `${API_PREFIX}/solar/GB/gsp/pvlive/all?regime=in-day`,
    axiosFetcherAuth,
    {
      refreshInterval: 60 * 1000 * 5 // 5min
    }
  );
  const currentYields =
    allGspPvData?.map((datum) => {
      const gspYield = datum.gspYields.find((yieldDatum, index) => {
        return yieldDatum.datetimeUtc === `${selectedTime}:00+00:00`;
      });
      return {
        gspId: datum.gspId,
        gspRegion: datum.regionName,
        yield: gspYield?.solarGenerationKw || 0
      };
    }) || [];

  const gspDeltas = useMemo(() => {
    let tempGspDeltas = new Map();

    for (let i = 0; i < currentYields.length; i++) {
      const currentYield = currentYields[i];
      let gspForecastData = allGspForecastData?.forecasts[i];
      if (gspForecastData?.location.gspId !== currentYield.gspId) {
        gspForecastData = allGspForecastData?.forecasts.find((gspForecastDatum) => {
          return gspForecastDatum.location.gspId === currentYield.gspId;
        });
      }
      const currentGspForecast = gspForecastData?.forecastValues.find((forecastValue) => {
        return forecastValue.targetTime === `${selectedTime}:00+00:00`;
      });
      tempGspDeltas.set(currentYield.gspId, {
        gspId: currentYield.gspId,
        gspRegion: currentYield.gspRegion,
        currentYield: currentYield.yield / 1000,
        forecast: currentGspForecast?.expectedPowerGenerationMegawatts || 0,
        delta:
          currentYield.yield / 1000 - (currentGspForecast?.expectedPowerGenerationMegawatts || 0)
      });
    }
    return tempGspDeltas;
  }, [allGspForecastData, allGspPvData, selectedTime]);

  const chartData = useFormatChartData({
    forecastData: nationalForecastData,
    fourHourData: national4HourData,
    pvRealDayInData,
    pvRealDayAfterData,
    timeTrigger: selectedTime,
    delta: true
  });

  // when commenting 4hour forecast back in, add pv4HourError to the list of errors to line 108 and "!national4HourData" to line 109
  if (error || error2 || error3) return <div>failed to load</div>;
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
          <DeltaBuckets
            className={`text-2xl`}
            bucketSelection={selectedBuckets}
            gspDeltas={gspDeltas}
          />
        </div>
        <div className="flex justify-between mx-3">
          <GspDeltaColumn gspDeltas={gspDeltas} negative setClickedGspId={setClickedGspId} />
          <GspDeltaColumn gspDeltas={gspDeltas} setClickedGspId={setClickedGspId} />
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
