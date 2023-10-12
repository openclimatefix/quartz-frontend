import { useUser, withPageAuthRequired } from "@auth0/nextjs-auth0";
import Layout from "../components/layout/layout";
import { PvLatestMap } from "../components/map";
import SideLayout from "../components/side-layout";
import PvRemixChart from "../components/charts/pv-remix-chart";
import useAndUpdateSelectedTime from "../components/hooks/use-and-update-selected-time";
import React, { useEffect, useMemo, useState } from "react";
import Cookies from "cookies";
import Header from "../components/layout/header";
import DeltaViewChart from "../components/charts/delta-view/delta-view-chart";
import { API_PREFIX, DELTA_BUCKET, SITES_API_PREFIX, VIEWS } from "../constant";
import useGlobalState from "../components/helpers/globalState";
import {
  AllGspRealData,
  AllSites,
  CombinedData,
  CombinedErrors,
  CombinedLoading,
  CombinedSitesData,
  CombinedValidating,
  ForecastData,
  GspAllForecastData,
  National4HourData,
  PvRealData,
  SitePvActual,
  SitePvForecast,
  SitesPvActual,
  SitesPvForecast
} from "../components/types";
import { components } from "../types/quartz-api";
import {
  axiosFetcherAuth,
  formatISODateString,
  getDeltaBucket,
  getLoadingState,
  isProduction
} from "../components/helpers/utils";
import { ActiveUnit } from "../components/map/types";
import DeltaMap from "../components/map/deltaMap";
import * as Sentry from "@sentry/nextjs";
import SolarSiteChart from "../components/charts/solar-site-view/solar-site-chart";
import SitesMap from "../components/map/sitesMap";
import { useFormatSitesData } from "../components/hooks/useFormatSitesData";
import {
  CookieStorageKeys,
  setArraySettingInCookieStorage
} from "../components/helpers/cookieStorage";
import { useLoadDataFromApi } from "../components/hooks/useLoadDataFromApi";

export default function Home({ dashboardModeServer }: { dashboardModeServer: string }) {
  useAndUpdateSelectedTime();
  const [view, setView] = useGlobalState("view");
  const [activeUnit, setActiveUnit] = useState<ActiveUnit>(ActiveUnit.MW);
  const [show4hView] = useGlobalState("show4hView");
  const [selectedISOTime] = useGlobalState("selectedISOTime");
  const selectedTime = formatISODateString(selectedISOTime || new Date().toISOString());
  const [timeNow] = useGlobalState("timeNow");
  const { user, isLoading, error } = useUser();
  const [maps] = useGlobalState("maps");
  const [lat] = useGlobalState("lat");
  const [lng] = useGlobalState("lng");
  const [zoom] = useGlobalState("zoom");
  const [largeScreenMode] = useGlobalState("dashboardMode");
  const [visibleLines] = useGlobalState("visibleLines");
  const [, setLoadingState] = useGlobalState("loadingState");

  // Local state used to set initial state on server side render, then updated by global state
  const [combinedDashboardModeActive, setCombinedDashboardModeActive] = useState(
    dashboardModeServer === "true"
  );
  useEffect(() => {
    setCombinedDashboardModeActive(largeScreenMode);
  }, [largeScreenMode]);

  useEffect(() => {
    setArraySettingInCookieStorage(CookieStorageKeys.VISIBLE_LINES, visibleLines);
  }, [visibleLines]);

  const currentView = (v: VIEWS) => v === view;

  useEffect(() => {
    if (user && !isLoading && !error) {
      Sentry.setUser({
        id: user.sub || "",
        email: user.email || "",
        username: user.nickname || "",
        name: user.name,
        locale: user.locale,
        avatar: user.picture
      });
    }
  }, [user, isLoading, error]);

  useEffect(() => {
    maps.forEach((map) => {
      if (map.getCanvas()?.style.width === "400px") {
        console.log("-- -- -- resizing map");
        map.resize();
      }
    });
  }, [view, maps]);

  useEffect(() => {
    maps.forEach((map) => {
      console.log("-- -- -- resizing map");
      map.resize();
    });
  }, [combinedDashboardModeActive]);

  useEffect(() => {
    maps.forEach((map, index) => {
      if (map.getContainer().dataset.title === view) return;

      if (map.getCenter().lat !== lat || map.getCenter().lng !== lng) {
        map.setCenter([lng, lat]);
      }
      if (map.getZoom() !== zoom) {
        map.setZoom(zoom);
      }
    });
  }, [lat, lng, zoom]);

  const {
    data: nationalForecastData,
    isLoading: nationalForecastLoading,
    isValidating: nationalForecastValidating,
    error: nationalForecastError
  } = useLoadDataFromApi<ForecastData>(
    `${API_PREFIX}/solar/GB/national/forecast?historic=false&only_forecast_values=true`
  );

  const {
    data: pvRealDayInData,
    isLoading: pvRealDayInLoading,
    isValidating: pvRealDayInValidating,
    error: pvRealDayInError
  } = useLoadDataFromApi<PvRealData>(`${API_PREFIX}/solar/GB/national/pvlive?regime=in-day`);
  const {
    data: pvRealDayAfterData,
    isLoading: pvRealDayAfterLoading,
    isValidating: pvRealDayAfterValidating,
    error: pvRealDayAfterError
  } = useLoadDataFromApi<PvRealData>(`${API_PREFIX}/solar/GB/national/pvlive?regime=day-after`);
  const {
    data: national4HourData,
    isLoading: national4HourLoading,
    isValidating: national4HourValidating,
    error: national4HourError
  } = useLoadDataFromApi<National4HourData>(
    show4hView
      ? `${API_PREFIX}/solar/GB/national/forecast?forecast_horizon_minutes=240&historic=true&only_forecast_values=true`
      : null
  );
  const {
    data: allGspSystemData,
    isLoading: allGspSystemLoading,
    isValidating: allGspSystemValidating,
    error: allGspSystemError
  } = useLoadDataFromApi<components["schemas"]["Location"][]>(`${API_PREFIX}/system/GB/gsp/`);
  const {
    data: allGspForecastData,
    isLoading: allGspForecastLoading,
    isValidating: allGspForecastValidating,
    error: allGspForecastError
  } = useLoadDataFromApi<
    // TODO: see if we can fully integrate API paths/params into type safe functions
    // paths["/v0/solar/GB/gsp/forecast/all/"]["get"]["responses"]["200"]["content"]["application/json"]
    components["schemas"]["OneDatetimeManyForecastValues"][]
  >(
    // `/v0/solar/GB/gsp/forecast/all/`,
    `${API_PREFIX}/solar/GB/gsp/forecast/all/?historic=true&compact=true`,
    {}
  );
  const {
    data: allGspRealData,
    isLoading: allGspRealLoading,
    isValidating: allGspRealValidating,
    error: allGspRealError
  } = useLoadDataFromApi<
    components["schemas"]["GSPYieldGroupByDatetime"][]
    // paths["/v0/solar/GB/gsp/pvlive/all"]["get"]["responses"]["200"]["content"]["application/json"]
  >(`${API_PREFIX}/solar/GB/gsp/pvlive/all?regime=in-day&compact=true`);

  const currentYieldSet = allGspRealData?.find((datum) => {
    return datum.datetimeUtc === `${selectedTime}:00+00:00`;
  });
  const currentYields = currentYieldSet
    ? Object.entries(currentYieldSet.generationKwByGspId).map(([key, val]) => {
        const gspLocationInfo = allGspSystemData?.find((gsp) => gsp.gspId === Number(key));
        return {
          gspId: key,
          gspRegion: gspLocationInfo?.regionName || "No name",
          gspCapacity: gspLocationInfo?.installedCapacityMw || 0,
          yield: val
        };
      })
    : [];
  const gspDeltas = useMemo(() => {
    let tempGspDeltas = new Map();
    const currentForecasts = allGspForecastData?.find((forecast) => {
      return forecast.datetimeUtc === `${selectedTime}:00+00:00`;
    });
    for (let i = 0; i < currentYields.length; i++) {
      const currentYield = currentYields[i];
      const currentForecastMw = currentForecasts?.forecastValues[currentYield.gspId];
      const isFutureOrNoYield = `${selectedTime}:00.000Z` >= timeNow || !currentYield.yield;
      const delta = isFutureOrNoYield
        ? 0
        : Number(currentYield.yield) / 1000 - (currentForecastMw || 0);
      const deltaNormalized = isFutureOrNoYield
        ? 0
        : (Number(currentYield.yield) / 1000 - (currentForecastMw || 0)) /
            currentYield.gspCapacity || 0;
      const deltaBucket = getDeltaBucket(delta);
      tempGspDeltas.set(currentYield.gspId, {
        gspId: currentYield.gspId,
        gspRegion: currentYield.gspRegion,
        gspCapacity: currentYield.gspCapacity,
        currentYield: Number(currentYield.yield) / 1000,
        forecast: currentForecastMw || 0,
        delta,
        deltaPercentage: (Number(currentYield.yield) / 1000 / (currentForecastMw || 0)) * 100,
        deltaNormalized,
        deltaBucket: deltaBucket,
        deltaBucketKey: DELTA_BUCKET[deltaBucket]
      });
    }
    // console.log("gspDeltas calculated");
    // console.log(
    //   "gspDeltas",
    //   Array.from(tempGspDeltas)
    //     .filter((gspDelta) => gspDelta[1].delta > 0)
    //     .map((gspDelta, index) => {
    //       const delta = gspDelta[1].delta;
    //       return delta;
    //     })
    // );
    return tempGspDeltas;
  }, [allGspForecastData, allGspRealData, currentYields, selectedTime]);

  const combinedData: CombinedData = {
    nationalForecastData,
    pvRealDayInData,
    pvRealDayAfterData,
    national4HourData,
    allGspSystemData,
    allGspForecastData,
    allGspRealData,
    gspDeltas
  };
  const combinedLoading: CombinedLoading = useMemo(
    () => ({
      nationalForecastLoading,
      pvRealDayInLoading,
      pvRealDayAfterLoading,
      national4HourLoading,
      allGspSystemLoading,
      allGspForecastLoading,
      allGspRealLoading
    }),
    [
      nationalForecastLoading,
      pvRealDayInLoading,
      pvRealDayAfterLoading,
      national4HourLoading,
      allGspSystemLoading,
      allGspForecastLoading,
      allGspRealLoading
    ]
  );
  const combinedValidating: CombinedValidating = useMemo(
    () => ({
      nationalForecastValidating,
      pvRealDayInValidating,
      pvRealDayAfterValidating,
      national4HourValidating,
      allGspSystemValidating,
      allGspForecastValidating,
      allGspRealValidating
    }),
    [
      nationalForecastValidating,
      pvRealDayInValidating,
      pvRealDayAfterValidating,
      national4HourValidating,
      allGspSystemValidating,
      allGspForecastValidating,
      allGspRealValidating
    ]
  );
  const combinedErrors: CombinedErrors = {
    nationalForecastError,
    pvRealDayInError,
    pvRealDayAfterError,
    national4HourError,
    allGspSystemError,
    allGspForecastError,
    allGspRealError
  };

  // Sites API data
  const { data: allSitesData, error: allSitesError } = useLoadDataFromApi<AllSites>(
    `${SITES_API_PREFIX}/sites`,
    {
      // isPaused: () => !currentView(VIEWS.SOLAR_SITES)
    }
  );
  const slicedSitesData = allSitesData?.site_list.slice(0, 100) || [];
  const siteUuids = slicedSitesData.map((site) => site.site_uuid);
  const siteUuidsString = siteUuids?.join(",");

  const { data: sitePvForecastData, error: sitePvForecastError } =
    useLoadDataFromApi<SitesPvForecast>(
      `${SITES_API_PREFIX}/sites/pv_forecast?site_uuids=${siteUuidsString}`,
      {}
    );

  const { data: sitesPvActualData, error: sitePvActualError } = useLoadDataFromApi<SitesPvActual>(
    `${SITES_API_PREFIX}/sites/pv_actual?site_uuids=${siteUuidsString}`,
    {}
  );

  const sitesData: CombinedSitesData = {
    allSitesData: slicedSitesData,
    sitesPvForecastData: sitePvForecastData?.filter((d): d is SitePvForecast => !!d) || [],
    sitesPvActualData: sitesPvActualData?.filter((d): d is SitePvActual => !!d) || []
  };

  const sitesErrors = {
    allSitesError,
    sitesPvForecastError: sitePvForecastError,
    sitesPvActualError: sitePvActualError
  };

  const aggregatedSitesData = useFormatSitesData(sitesData, selectedISOTime);

  // Watch and update loading state
  useEffect(() => {
    setLoadingState(getLoadingState(combinedLoading, combinedValidating));
  }, [combinedLoading, combinedValidating, setLoadingState]);

  const closedWidth = combinedDashboardModeActive ? "50%" : "56%";

  return (
    <Layout>
      <div
        className={`h-full relative pt-16${
          combinedDashboardModeActive ? " @container dashboard-mode" : ""
        }`}
      >
        <Header view={view} setView={setView} />
        <div
          id="map-container"
          className={`relative float-right h-full`}
          style={{ width: closedWidth }}
        >
          <PvLatestMap
            className={currentView(VIEWS.FORECAST) ? "" : "hidden"}
            combinedData={combinedData}
            combinedErrors={combinedErrors}
            activeUnit={activeUnit}
            setActiveUnit={setActiveUnit}
          />
          {!isProduction && (
            <SitesMap
              className={currentView(VIEWS.SOLAR_SITES) ? "" : "hidden"}
              sitesData={sitesData}
              aggregatedSitesData={aggregatedSitesData}
              sitesErrors={sitesErrors}
              activeUnit={activeUnit}
              setActiveUnit={setActiveUnit}
            />
          )}
          <DeltaMap
            className={currentView(VIEWS.DELTA) ? "" : "hidden"}
            combinedData={combinedData}
            combinedErrors={combinedErrors}
            activeUnit={activeUnit}
            setActiveUnit={setActiveUnit}
          />
        </div>

        <SideLayout dashboardModeActive={combinedDashboardModeActive}>
          <PvRemixChart
            combinedData={combinedData}
            combinedErrors={combinedErrors}
            className={currentView(VIEWS.FORECAST) ? "" : "hidden"}
          />
          {!isProduction && (
            <SolarSiteChart
              combinedSitesData={sitesData}
              aggregatedSitesData={aggregatedSitesData}
              className={currentView(VIEWS.SOLAR_SITES) ? "" : "hidden"}
            />
          )}
          <DeltaViewChart
            combinedData={combinedData}
            combinedErrors={combinedErrors}
            className={currentView(VIEWS.DELTA) ? "" : "hidden"}
          />
        </SideLayout>
      </div>
    </Layout>
  );
}

export const getServerSideProps = withPageAuthRequired({
  async getServerSideProps(context) {
    const cookies = new Cookies(context.req, context.res);
    return {
      props: {
        dashboardModeServer: cookies.get(CookieStorageKeys.DASHBOARD_MODE) || false
      }
    };
  }
});
