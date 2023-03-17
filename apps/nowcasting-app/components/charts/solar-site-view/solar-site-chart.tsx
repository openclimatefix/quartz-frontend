import React, { FC, useMemo, useState } from "react";
import RemixLine from "../remix-line";
import Line from "../remix-line";
import useSWR from "swr";
import { AGGREGATION_LEVELS, API_PREFIX } from "../../../constant";
import ForecastHeader from "../forecast-header";
import useGlobalState from "../../helpers/globalState";
import useFormatChartData from "../use-format-chart-data";
import {
  getRounded4HoursAgoString,
  formatISODateString,
  convertISODateStringToLondonTime
} from "../../helpers/utils";
import GspPvRemixChart from "../gsp-pv-remix-chart";
import { useStopAndResetTime } from "../../hooks/use-and-update-selected-time";
import Spinner from "../../icons/spinner";
import { MAX_NATIONAL_GENERATION_MW } from "../../../constant";
import useHotKeyControlChart from "../../hooks/use-hot-key-control-chart";
import { InfoIcon, LegendLineGraphIcon } from "../../icons/icons";
import { CombinedSitesData } from "../../types";
import Tooltip from "../../tooltip";
import { ChartInfo } from "../../../ChartInfo";
import useFormatChartDataSites from "../use-format-chart-data-sites";
import { ForecastWithActualPV, NextForecast } from "../forecast-header/ui";
import { RegionTable, GSPTable, SiteTable } from "./solar-site-tables";

const LegendItem: FC<{
  iconClasses: string;
  label: string;
  dashed?: boolean;
  dataKey: string;
}> = ({ iconClasses, label, dashed, dataKey }) => {
  const [visibleLines, setVisibleLines] = useGlobalState("visibleLines");
  const isVisible = visibleLines.includes(dataKey);
  const [show4hView] = useGlobalState("show4hView");

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

const SolarSiteChart: FC<{ sitesData: CombinedSitesData; date?: string; className?: string }> = ({
  sitesData,
  className
}) => {
  const [show4hView] = useGlobalState("show4hView");
  const [clickedGspId, setClickedGspId] = useGlobalState("clickedGspId");
  const [visibleLines] = useGlobalState("visibleLines");
  const [aggregationLevel, setAggregationLevel] = useGlobalState("aggregationLevel");
  const [selectedISOTime, setSelectedISOTime] = useGlobalState("selectedISOTime");
  const [timeNow] = useGlobalState("timeNow");
  const [forecastCreationTime] = useGlobalState("forecastCreationTime");
  const { stopTime, resetTime } = useStopAndResetTime();
  const selectedTime = formatISODateString(selectedISOTime || new Date().toISOString());
  const currentAggregation = (a: AGGREGATION_LEVELS) => a === aggregationLevel;

  // const chartLimits = useMemo(
  //   () =>
  //     nationalForecastData && {
  //       start: nationalForecastData[0].targetTime,
  //       end: nationalForecastData[nationalForecastData.length - 1].targetTime
  //     },
  //   [nationalForecastData]
  // );
  // useHotKeyControlChart(chartLimits);

  // const { data: pvRealDayInData, error: error2 } = useSWR<
  //   {
  //     datetimeUtc: string;
  //     solarGenerationKw: number;
  //   }[]
  // >(`${API_PREFIX}/solar/GB/national/pvlive?regime=in-day`, axiosFetcherAuth, {
  //   refreshInterval: 60 * 1000 * 5 // 5min
  // });
  //
  // const { data: pvRealDayAfterData, error: error3 } = useSWR<
  //   {
  //     datetimeUtc: string;
  //     solarGenerationKw: number;
  //   }[]
  // >(`${API_PREFIX}/solar/GB/national/pvlive?regime=day-after`, axiosFetcherAuth, {
  //   refreshInterval: 60 * 1000 * 5 // 5min
  // });
  //
  // const { data: national4HourData, error: pv4HourError } = useSWR<ForecastValue[]>(
  //   show4hView
  //     ? `${API_PREFIX}/solar/GB/national/forecast?forecast_horizon_minutes=240&historic=true&only_forecast_values=true`
  //     : null,
  //   axiosFetcherAuth,
  //   {
  //     refreshInterval: 60 * 1000 * 5 // 5min
  //   }
  // );

  const chartData = useFormatChartDataSites({
    allSitesData: sitesData.allSitesData,
    pvForecastData: sitesData.sitesPvForecastData,
    // fourHourData: national4HourData,
    // pvRealDayInData,
    pvActualData: sitesData.sitesPvActualData,
    timeTrigger: selectedTime
  });

  console.log(chartData);
  console.log(sitesData);

  const cumulativeCapacity = sitesData.allSitesData?.reduce(
    (acc, site) => acc + site.installed_capacity_kw,
    0
  );
  const forecastPV = chartData?.reduce(
    (acc, site) => acc + (site.FORECAST || 0) + (site.PAST_FORECAST || 0),
    0
  );
  const actualPV = chartData?.reduce((acc, site) => acc + (site.GENERATION_UPDATED || 0), 0);

  // if () return <div>failed to load</div>;
  if (!sitesData.sitesPvForecastData || !sitesData.sitesPvActualData)
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
        <div className="flex content-between bg-ocf-gray-800 h-auto">
          <div className="text-white lg:text-2xl md:text-lg text-base font-black m-auto ml-5 flex justify-evenly">
            All Sites
          </div>
          <div className="flex justify-between flex-2 my-2 px-6">
            <div className="pr-8">
              <ForecastWithActualPV
                forecast={`${forecastPV.toFixed(1)}`}
                pv={`${actualPV.toFixed(1)}`}
                tip={`PV Live / OCF Forecast`}
                time={"time"}
                // time={`${convertISODateStringToLondonTime(
                //   sitesData?.sitesPvActualData?.[0]?.pv_actual_values?.[0].datetime_utc
                // )}`||""}
                color="ocf-yellow"
              />
            </div>
            <div>
              {/*<NextForecast*/}
              {/*  pv={forecastNextPV}*/}
              {/*  time={`${forecastNextTimeOnly}`}*/}
              {/*  tip={`Next OCF Forecast`}*/}
              {/*  color="ocf-yellow"*/}
              {/*/>*/}
            </div>
          </div>
          <div className="inline-flex h-full"></div>
          {/*<div className="inline-flex h-full">{children}</div>*/}
        </div>

        <div className="h-60 mt-4 mb-10">
          <RemixLine
            resetTime={resetTime}
            timeNow={formatISODateString(timeNow)}
            timeOfInterest={selectedTime}
            setTimeOfInterest={setSelectedTime}
            data={chartData}
            yMax={Math.round(Number(cumulativeCapacity))}
            visibleLines={visibleLines}
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
          ></GspPvRemixChart>
        )}
      </div>

      <RegionTable
        className={
          currentAggregation(AGGREGATION_LEVELS.REGION) ||
          currentAggregation(AGGREGATION_LEVELS.NATIONAL)
            ? ""
            : "hidden"
        }
        sitesCombinedData={sitesData}
        allSites={sitesData.allSitesData}
        sitesPvActual={sitesData.sitesPvActualData}
        sitesPvForecast={sitesData.sitesPvForecastData}
      />
      <GSPTable allSites={sitesData.allSitesData} className={currentAggregation(AGGREGATION_LEVELS.GSP) ? "" : "hidden"} />
      <SiteTable allSites={sitesData.allSitesData} className={currentAggregation(AGGREGATION_LEVELS.SITE) ? "" : "hidden"} />

      <div className="flex flex-none justify-end align-items:baseline px-4 text-xs tracking-wider text-ocf-gray-300 pt-3 mb-1 bg-mapbox-black-500 overflow-y-visible">
        <div
          className={`flex flex-1 justify-around max-w-2xl flex-row pb-3 overflow-x-auto${
            show4hView ? " pl-32" : ""
          }`}
        >
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

export default SolarSiteChart;
