import React, { FC } from "react";
import RemixLine from "../remix-line";
import { AGGREGATION_LEVELS } from "../../../constant";
import useGlobalState from "../../helpers/globalState";
import {
  convertISODateStringToLondonTime,
  formatISODateString,
  getRounded4HoursAgoString,
  getRoundedTickBoundary
} from "../../helpers/utils";
import { useStopAndResetTime } from "../../hooks/use-and-update-selected-time";
import Spinner from "../../icons/spinner";
import { InfoIcon, LegendLineGraphIcon } from "../../icons/icons";
import {
  AggregatedSitesCombinedData,
  CombinedSitesData,
  LoadingState,
  Site,
  SitesEndpointStates
} from "../../types";
import Tooltip from "../../tooltip";
import { ChartInfo } from "../../../ChartInfo";
import useFormatChartDataSites from "../use-format-chart-data-sites";
import { ForecastHeadlineFigure } from "../forecast-header/ui";
import { AggregatedDataTable } from "./solar-site-tables";
import ForecastHeaderSite from "./forecast-header";
import DataLoadingChartStatus from "../DataLoadingChartStatus";

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
  const [sitesLoadingState] = useGlobalState("sitesLoadingState");
  const { stopTime, resetTime } = useStopAndResetTime();
  const selectedTime = formatISODateString(selectedISOTime || new Date().toISOString());
  const currentAggregation = (a: AGGREGATION_LEVELS) => a === aggregationLevel;

  const chartData = useFormatChartDataSites({
    allSitesData: combinedSitesData.allSitesData,
    pvForecastData: combinedSitesData.sitesPvForecastData,
    pvActualData: combinedSitesData.sitesPvActualData,
    timeTrigger: selectedTime
  });

  const getSelectedSitesData = (
    sitesData: Site[],
    aggregationLevel: AGGREGATION_LEVELS,
    clickedGroupId: string
  ) => {
    switch (aggregationLevel) {
      case AGGREGATION_LEVELS.NATIONAL:
        return sitesData;
      case AGGREGATION_LEVELS.REGION:
        return sitesData.filter((site) => site.dno.includes(`\"dno_id\": \"${clickedGroupId}\"`));
      case AGGREGATION_LEVELS.GSP:
        return sitesData.filter((site) => site.gsp.includes(`\"gsp_id\": \"${clickedGroupId}\"`));
      case AGGREGATION_LEVELS.SITE:
        return sitesData.filter((site) => site.site_uuid === clickedGroupId);
    }
  };
  const getSelectedSitesCapacity = (selectedSitesData: Site[]) => {
    return selectedSitesData.reduce((acc, site) => acc + site.inverter_capacity_kw, 0);
  };

  const selectedSiteData = getSelectedSitesData(
    combinedSitesData.allSitesData || [],
    aggregationLevel,
    String(clickedSiteGroupId) || ""
  );
  const selectedSiteCapacity = getSelectedSitesCapacity(selectedSiteData);
  const filteredChartData = useFormatChartDataSites({
    allSitesData: selectedSiteData,
    pvForecastData: combinedSitesData.sitesPvForecastData,
    pvActualData: combinedSitesData.sitesPvActualData,
    timeTrigger: selectedTime
  });

  let yMax = Number(aggregatedSitesData.national.get("National")?.capacity);
  const yMax_levels = [
    1, 2, 3, 4, 6, 8, 9, 20, 28, 36, 45, 60, 80, 100, 120, 160, 200, 240, 300, 320, 360, 400, 450,
    600
  ];
  yMax = getRoundedTickBoundary(yMax, yMax_levels);

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

  const getTotalPvActualGenerationForGroup = (site_uuids: string[], targetTime: string) => {
    const sitesActuals = combinedSitesData.sitesPvActualData.filter((pv) =>
      site_uuids.includes(pv.site_uuid)
    );
    return sitesActuals.reduce((acc, pv) => {
      const actual = pv.pv_actual_values.find(
        (pv) => formatISODateString(pv.datetime_utc) === formatISODateString(targetTime)
      );
      return acc + (actual?.actual_generation_kw || 0);
    }, 0);
  };

  const getTotalPvForecastGenerationForGroup = (site_uuids: string[], targetTime: string) => {
    const sitesForecasts = combinedSitesData.sitesPvForecastData.filter((pv) =>
      site_uuids.includes(pv.site_uuid)
    );
    return sitesForecasts.reduce((acc, fc) => {
      const forecastVal = fc.forecast_values.find(
        (pv) => formatISODateString(pv.target_datetime_utc) === formatISODateString(targetTime)
      );
      return acc + (forecastVal?.expected_generation_kw || 0);
    }, 0);
  };

  const getSiteName = (
    filteredSites: Site[],
    aggregationLevel: AGGREGATION_LEVELS,
    clickedGroupId: string
  ) => {
    switch (aggregationLevel) {
      case AGGREGATION_LEVELS.NATIONAL:
        return "National";
      case AGGREGATION_LEVELS.REGION:
        const siteWithRegion = filteredSites.find((s) =>
          s.dno.includes(`\"dno_id\": \"${clickedGroupId}\"`)
        );
        if (!siteWithRegion) return "";
        const region = JSON.parse(siteWithRegion.dno);
        return region.long_name || "";
      case AGGREGATION_LEVELS.GSP:
        const siteWithGsp = filteredSites.find((s) =>
          s.gsp.includes(`\"gsp_id\": \"${clickedGroupId}\"`)
        );
        if (!siteWithGsp) return "";
        const gsp = JSON.parse(siteWithGsp.gsp);
        return gsp.name || "";
      case AGGREGATION_LEVELS.SITE:
        const site = filteredSites.find((s) => s.site_uuid === clickedGroupId);
        return site?.client_site_id || "";
    }
  };

  const allSitesYield = Array.from(aggregatedSitesData.national.values());
  const nationalPVActual = allSitesYield[0]?.actualPV || 0;
  const nationalPVExpected = allSitesYield[0]?.expectedPV || 0;
  const allSitesSelectedTime = formatISODateString(selectedTime);
  const allSitesChartDateTime = convertISODateStringToLondonTime(allSitesSelectedTime + ":00.000Z");

  // if () return <div>failed to load</div>;

  if (!combinedSitesData.sitesPvForecastData || !combinedSitesData.sitesPvActualData)
    return (
      <div className={`h-full flex ${className}`}>
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
      <div className="flex-auto flex flex-col mb-2">
        <div className="flex content-between bg-ocf-gray-800 h-auto">
          <div className="flex-1 justify-start text-white lg:text-2xl md:text-lg text-base font-black m-auto mx-3 flex">
            All Sites
          </div>
          <div className="flex justify-end flex-initial my-2 pr-6 pl-3">
            <div className="">
              <ForecastHeadlineFigure
                tip={`PV Actual / OCF Forecast`}
                time={allSitesChartDateTime}
                color="ocf-yellow"
                unit={"KW"}
              >
                <span className="text-black">{nationalPVActual?.toFixed(1)}</span>
                <span className="text-ocf-gray-300 mx-1"> / </span>
                {nationalPVExpected?.toFixed(1)}
              </ForecastHeadlineFigure>
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
        <div className="flex-1 relative h-60 mt-4 mb-3">
          <DataLoadingChartStatus loadingState={sitesLoadingState} />
          <RemixLine
            resetTime={resetTime}
            timeNow={formatISODateString(timeNow)}
            timeOfInterest={selectedTime}
            setTimeOfInterest={setSelectedTime}
            data={chartData}
            yMax={yMax}
            visibleLines={visibleLines}
          />
        </div>
        {clickedSiteGroupId && aggregationLevel !== AGGREGATION_LEVELS.NATIONAL && (
          <div className="flex-1 flex flex-col relative h-60 dash:h-auto">
            <>
              <ForecastHeaderSite
                onClose={() => {
                  setClickedSiteGroupId(undefined);
                }}
                title={
                  getSiteName(selectedSiteData, aggregationLevel, clickedSiteGroupId) ||
                  "No name found for selected group"
                }
              >
                <ForecastHeadlineFigure
                  tip={`PV Actual / OCF Forecast`}
                  time={allSitesChartDateTime}
                  color="ocf-yellow"
                  unit={"KW"}
                >
                  <span className="text-black">
                    {getTotalPvActualGenerationForGroup(
                      selectedSiteData.map((site) => site.site_uuid),
                      selectedTime
                    ).toFixed(1) || "0"}
                  </span>
                  <span className="text-ocf-gray-300 mx-1"> / </span>
                  {getTotalPvForecastGenerationForGroup(
                    selectedSiteData.map((site) => site.site_uuid),
                    selectedTime
                  ).toFixed(1) || "0"}
                </ForecastHeadlineFigure>
              </ForecastHeaderSite>
              <div className="h-60 mt-4 mb-2">
                <RemixLine
                  resetTime={resetTime}
                  timeNow={formatISODateString(timeNow)}
                  timeOfInterest={selectedTime}
                  setTimeOfInterest={setSelectedTime}
                  data={filteredChartData}
                  yMax={getRoundedTickBoundary(Number(selectedSiteCapacity), yMax_levels)}
                  visibleLines={visibleLines}
                />
              </div>
            </>
          </div>
        )}
      </div>

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
          className={`flex flex-1 justify-around max-w-2xl flex-row pb-3 overflow-x-auto ${
            show4hView ? " pl-32" : ""
          }`}
        >
          <div className={legendItemContainerClasses}>
            <LegendItem
              iconClasses={"text-ocf-black"}
              label={"PV Actual"}
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
          </div>
          <div className={legendItemContainerClasses}>
            <LegendItem
              iconClasses={"text-ocf-yellow"}
              label={"OCF Final Forecast"}
              dataKey={`PAST_FORECAST`}
            />
          </div>
        </div>
        {/* {show4hView && (
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
          )} */}

        <div className="flex-initial flex items-center pb-6 pl-6">
          <Tooltip tip={<ChartInfo />} position="top" className={"text-right"} fullWidth>
            <InfoIcon />
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

export default SolarSiteChart;
