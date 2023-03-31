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
  convertISODateStringToLondonTime,
  formatISODateStringHuman
} from "../../helpers/utils";
import GspPvRemixChart from "../gsp-pv-remix-chart";
import { useStopAndResetTime } from "../../hooks/use-and-update-selected-time";
import Spinner from "../../icons/spinner";
import { MAX_NATIONAL_GENERATION_MW } from "../../../constant";
import useHotKeyControlChart from "../../hooks/use-hot-key-control-chart";
import { InfoIcon, LegendLineGraphIcon } from "../../icons/icons";
import { AggregatedSitesCombinedData, CombinedSitesData } from "../../types";
import Tooltip from "../../tooltip";
import { ChartInfo } from "../../../ChartInfo";
import useFormatChartDataSites from "../use-format-chart-data-sites";
import { ForecastWithActualPV, NextForecast } from "../forecast-header/ui";
import { AggregatedDataTable } from "./solar-site-tables";
import ForecastHeaderSite from "./forecast-header";

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

const SolarSiteChart: FC<{
  combinedSitesData: CombinedSitesData;
  aggregatedSitesData: AggregatedSitesCombinedData;
  date?: string;
  className?: string;
}> = ({ combinedSitesData, aggregatedSitesData, className }) => {
  const [show4hView] = useGlobalState("show4hView");
  const [clickedGspId, setClickedGspId] = useGlobalState("clickedGspId");
  const [clickedSiteGroupId, setClickedSiteGroupId] = useGlobalState("clickedSiteGroupId");
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
    allSitesData: combinedSitesData.allSitesData,
    pvForecastData: combinedSitesData.sitesPvForecastData,
    // fourHourData: national4HourData,
    // pvRealDayInData,
    pvActualData: combinedSitesData.sitesPvActualData,
    timeTrigger: selectedTime
  });
  // TODO: this currently only works for sites;
  //  need to add a helper function to filter sites by group to feed into here
  const filteredChartData = useFormatChartDataSites({
    allSitesData: combinedSitesData.allSitesData?.filter(
      (site) => site.site_uuid === clickedSiteGroupId
    ),
    pvForecastData: combinedSitesData.sitesPvForecastData,
    // fourHourData: national4HourData,
    // pvRealDayInData,
    pvActualData: combinedSitesData.sitesPvActualData,
    timeTrigger: selectedTime
  });

  const cumulativeCapacity = combinedSitesData.allSitesData?.reduce(
    (acc, site) => acc + site.installed_capacity_kw,
    0
  );
  const forecastPV = chartData?.reduce(
    (acc, site) => acc + (site.FORECAST || 0) + (site.PAST_FORECAST || 0),
    0
  );

  const forecastPVMW = forecastPV / 1000;

  const actualPV = chartData?.reduce((acc, site) => acc + (site.GENERATION_UPDATED || 0), 0);
  const actualPVMW = actualPV / 1000;

  // TABLE DATA MANIPULATION
  // site level
  const getExpectedPowerGenerationForSite = (site_uuid: string, targetTime: string) => {
    const siteForecast = combinedSitesData.sitesPvForecastData.find(
      (fc) => fc.site_uuid === site_uuid
    );
    return (
      siteForecast?.forecast_values.find(
        (fv) => formatISODateString(fv.target_datetime_utc) === formatISODateString(targetTime)
      )?.expected_generation_kw || 0
    );
  };

  const getPvActualGenerationForSite = (site_uuid: string, targetTime: string) => {
    const siteForecast = combinedSitesData.sitesPvActualData.find(
      (pv) => pv.site_uuid === site_uuid
    );
    return (
      siteForecast?.pv_actual_values.find(
        (pv) => formatISODateString(pv.datetime_utc) === formatISODateString(targetTime)
      )?.actual_generation_kw || 0
    );
  };

  const getSiteName = (site_uuid: string) => {
    const site = combinedSitesData.allSitesData?.find((s) => s.site_uuid === clickedSiteGroupId);
    return site?.client_site_id || "";
  };

  const allSitesYield = Array.from(aggregatedSitesData.national.values());
  const nationalPVActual = allSitesYield[0]?.actualPV || 0;
  const nationalPVExpected = allSitesYield[0]?.expectedPV || 0;
  const allSitesSelectedTime = formatISODateString(selectedTime);
  const allSitesChartDateTime = convertISODateStringToLondonTime(allSitesSelectedTime + ":00.000Z");

  // if () return <div>failed to load</div>;

  if (!combinedSitesData.sitesPvForecastData || !combinedSitesData.sitesPvActualData)
    return (
      <div className="h-full flex">
        <Spinner></Spinner>
      </div>
    );

  const setSelectedTime = (time: string) => {
    stopTime();
    setSelectedISOTime(time);
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
                forecast={`${nationalPVExpected?.toFixed(1)}`}
                pv={`${nationalPVActual?.toFixed(1)}`}
                tip={`PV Actual / OCF Forecast`}
                sites={true}
                time={allSitesChartDateTime}
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
            yMax={Math.round(Number(cumulativeCapacity) / 20)}
            visibleLines={visibleLines}
          />
        </div>
        <span>{clickedSiteGroupId || "No site group selected"}</span>
        {clickedSiteGroupId && (
          <>
            <ForecastHeaderSite
              forecast={
                getExpectedPowerGenerationForSite(clickedSiteGroupId, selectedTime).toFixed(1) ||
                "0"
              }
              pvActual={
                getPvActualGenerationForSite(clickedSiteGroupId, selectedTime).toFixed(1) || "0"
              }
              time={allSitesChartDateTime}
              onClose={() => {
                setClickedSiteGroupId(undefined);
              }}
              title={getSiteName(clickedSiteGroupId) || "No site name for this site group"}
            ></ForecastHeaderSite>
            <div className="h-60 mt-4 mb-10">
              <RemixLine
                resetTime={resetTime}
                timeNow={formatISODateString(timeNow)}
                timeOfInterest={selectedTime}
                setTimeOfInterest={setSelectedTime}
                data={filteredChartData}
                yMax={Math.round(Number(cumulativeCapacity) / 20)}
                visibleLines={visibleLines}
              />
            </div>
          </>
        )}
      </div>
      {/*{clickedGspId && (*/}
      {/*  <GspPvRemixChart*/}
      {/*    close={() => {*/}
      {/*      setClickedGspId(undefined);*/}
      {/*    }}*/}
      {/*    setTimeOfInterest={setSelectedTime}*/}
      {/*    selectedTime={selectedTime}*/}
      {/*    gspId={clickedGspId}*/}
      {/*    timeNow={formatISODateString(timeNow)}*/}
      {/*    resetTime={resetTime}*/}
      {/*    visibleLines={visibleLines}*/}
      {/*  ></GspPvRemixChart>*/}
      {/*)}*/}

      <AggregatedDataTable
        className={currentAggregation(AGGREGATION_LEVELS.NATIONAL) ? "" : "hidden"}
        title={"National"}
        tableData={Array.from(aggregatedSitesData.national.values())}
      />
      <AggregatedDataTable
        className={currentAggregation(AGGREGATION_LEVELS.REGION) ? "" : "hidden"}
        title={"Region"}
        tableData={Array.from(aggregatedSitesData.regions.values())}
      />
      <AggregatedDataTable
        className={currentAggregation(AGGREGATION_LEVELS.GSP) ? "" : "hidden"}
        title={"GSP"}
        tableData={Array.from(aggregatedSitesData.gsps.values())}
      />
      <AggregatedDataTable
        className={currentAggregation(AGGREGATION_LEVELS.SITE) ? "" : "hidden"}
        title={"Sites"}
        tableData={Array.from(aggregatedSitesData.sites.values())}
      />

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
