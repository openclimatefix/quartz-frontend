import { Dispatch, FC, ReactElement, SetStateAction, useMemo } from "react";
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
import DeltaBuckets from "./delta-buckets-ui";

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

  return (
    <div className={`flex flex-col flex-1 ${negative ? "pl-3 border-l" : "pr-3"}`}>
      {Array.from(gspDeltas.values())
        .sort(sortFunc)
        .map((gspDelta) => {
          if (negative && gspDelta.delta >= 0) {
            return null;
          }
          if (!negative && gspDelta.delta <= 0) {
            return null;
          }

          return (
            <div
              className="flex flex-row justify-between pb-1 mb-1 border-b border-white cursor-pointer"
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
  );
};

const DeltaChart: FC<{ date?: string; className?: string }> = ({ className }) => {
  const [show4hView] = useGlobalState("show4hView");
  const [clickedGspId, setClickedGspId] = useGlobalState("clickedGspId");
  const [visibleLines] = useGlobalState("visibleLines");
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
    //Add in the Delta forecast header here
    <div className={`flex flex-col flex-1 mb-1 ${className || ""}`}>
      <div className="flex-auto mb-7">
        <ForecastHeader
          pvForecastData={nationalForecastData}
          pvLiveData={pvRealDayInData}
          deltaview={true}
          //figure out something where we can put deltaview{true}
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
          <DeltaBuckets className={`text-2xl`} />
        </div>
        <div className="flex justify-between mx-3">
          <GspDeltaColumn gspDeltas={gspDeltas} setClickedGspId={setClickedGspId} />
          <GspDeltaColumn gspDeltas={gspDeltas} negative setClickedGspId={setClickedGspId} />
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
