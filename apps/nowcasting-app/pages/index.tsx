import { useUser } from "@auth0/nextjs-auth0/client";
import { withPageAuthRequired } from "@auth0/nextjs-auth0";
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
import useGlobalState, { get30MinNow } from "../components/helpers/globalState";
import {
  AllGspRealData,
  AllSites,
  CombinedData,
  CombinedErrors,
  CombinedLoading,
  CombinedSitesData,
  CombinedValidating,
  ElexonForecastValue,
  ForecastData,
  GspAllForecastData,
  NationalNHourData,
  PvRealData,
  SitePvActual,
  SitePvForecast,
  SitesPvActual,
  SitesPvForecast
} from "../components/types";
import { components } from "../types/quartz-api";
import {
  formatISODateString,
  getDeltaBucket,
  computeLoadingState,
  getSitesLoadingState,
  isProduction
} from "../components/helpers/utils";
import { ActiveUnit, NationalAggregation } from "../components/map/types";
import DeltaMap from "../components/map/deltaMap";
import * as Sentry from "@sentry/nextjs";
import SolarSiteChart from "../components/charts/solar-site-view/solar-site-chart";
import SitesMap from "../components/map/sitesMap";
import { useAggregateSitesDataForTimestamp } from "../components/hooks/useAggregateSitesDataForTimestamp";
import {
  CookieStorageKeys,
  setArraySettingInCookieStorage
} from "../components/helpers/cookieStorage";
import { useLoadDataFromApi } from "../components/hooks/useLoadDataFromApi";
import {
  filterCompactFutureData,
  filterCompactHistoricData,
  calculateHistoricDataStartFromCompactValuesIntervalInMinutes,
  getOldestTimestampFromCompactForecastValues,
  getOldestTimestampFromForecastValues,
  calculateHistoricDataStartFromForecastValuesIntervalInMinutes,
  getEarliestForecastTimestamp,
  getFurthestForecastTimestamp
} from "../components/helpers/data";
import { DateTime } from "luxon";

export default function Home({ dashboardModeServer }: { dashboardModeServer: string }) {
  useAndUpdateSelectedTime();
  const [view, setView] = useGlobalState("view");
  const [activeUnit, setActiveUnit] = useState<ActiveUnit>(ActiveUnit.MW);
  const [showNHourView] = useGlobalState("showNHourView");
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
  const [, setSitesLoadingState] = useGlobalState("sitesLoadingState");
  const [, setLoadingState] = useGlobalState("loadingState");
  const [nHourForecast] = useGlobalState("nHourForecast");
  const [nationalAggregationLevel, setNationalAggregationLevel] = useGlobalState(
    "nationalAggregationLevel"
  );
  const [, setClickedGspId] = useGlobalState("clickedGspId");

  const [forecastLastFetch30MinISO, setForecastLastFetch30MinISO] = useState(get30MinNow(-30));
  const [forecastHistoricBackwardIntervalMinutes, setForecastHistoricBackwardIntervalMinutes] =
    useState(0);
  const [allGspForecastFuture, setAllGspForecastFuture] =
    useState<components["schemas"]["OneDatetimeManyForecastValues"][]>();
  const [allGspForecastHistory, setAllGspForecastHistory] =
    useState<components["schemas"]["OneDatetimeManyForecastValues"][]>();

  const [actualsLastFetch30MinISO, setActualsLastFetch30MinISO] = useState(get30MinNow(-30));
  const [actualsHistoricBackwardIntervalMinutes, setActualsHistoricBackwardIntervalMinutes] =
    useState(0);
  const [allGspActualFuture, setAllGspActualFuture] =
    useState<components["schemas"]["GSPYieldGroupByDatetime"][]>();
  const [allGspActualHistory, setAllGspActualHistory] =
    useState<components["schemas"]["GSPYieldGroupByDatetime"][]>();

  const [isOldNowcastingDomain, setIsOldNowcastingDomain] = useState(false);

  useEffect(() => {
    setIsOldNowcastingDomain(window.location.host.includes("nowcasting.io"));
  }, []);

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

  // On view change, unset the clicked region if the aggregation is not GSP,
  // and set the national aggregation level to GSP if we're now on Delta view
  useEffect(() => {
    if (nationalAggregationLevel !== NationalAggregation.GSP) {
      setClickedGspId(undefined);
    }
    if (view === VIEWS.DELTA) {
      setNationalAggregationLevel(NationalAggregation.GSP);
    }
  }, [view]);

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

  const forecastFrom = getEarliestForecastTimestamp();
  const forecastTo = getFurthestForecastTimestamp();

  const {
    data: nationalForecastData,
    isLoading: nationalForecastLoading,
    isValidating: nationalForecastValidating,
    error: nationalForecastError
  } = useLoadDataFromApi<ForecastData>(
    `${API_PREFIX}/solar/GB/national/forecast?historic=false&only_forecast_values=true&model_name=blend&trend_adjuster_on=true`,
    {
      keepPreviousData: true,
      refreshInterval: 0, // Only load this once at beginning
      onSuccess: (data) => {
        if (!data) return;

        const historicBackwardIntervalMinutes =
          calculateHistoricDataStartFromForecastValuesIntervalInMinutes(data);
        const prev30MinNowISO = `${get30MinNow(-30)}:00+00:00`;
        setForecastLastFetch30MinISO(prev30MinNowISO);
        setForecastHistoricBackwardIntervalMinutes(historicBackwardIntervalMinutes);
      }
    }
  );
  const {
    data: nationalIntradayECMWFOnlyData,
    isLoading: nationalIntradayECMWFOnlyLoading,
    isValidating: nationalIntradayECMWFOnlyValidating,
    error: nationalIntradayECMWFOnlyError
  } = useLoadDataFromApi<ForecastData>(
    `${API_PREFIX}/solar/GB/national/forecast?include_metadata=false&model_name=pvnet_intraday_ecmwf_only&trend_adjuster_on=true`,
    {
      keepPreviousData: true,
      refreshInterval: 0 // Only load this once at beginning
    }
  );
  if (nationalIntradayECMWFOnlyError) {
    Sentry.captureMessage(
      `ECMWF forecast data load error: ${JSON.stringify(nationalIntradayECMWFOnlyError)}`
    );
  }
  const {
    data: nationalPvnetDayAhead,
    isLoading: nationalPvnetDayAheadLoading,
    isValidating: nationalPvnetDayAheadValidating,
    error: nationalPvnetDayAheadError
  } = useLoadDataFromApi<ForecastData>(
    `${API_PREFIX}/solar/GB/national/forecast?include_metadata=false&model_name=pvnet_day_ahead&trend_adjuster_on=true`,
    {
      keepPreviousData: true,
      refreshInterval: 0 // Only load this once at beginning
    }
  );
  if (nationalPvnetDayAheadError) {
    Sentry.captureMessage(
      `PVNet day-ahead forecast data load error: ${JSON.stringify(nationalPvnetDayAheadError)}`
    );
  }
  const {
    data: nationalPvnetIntraday,
    isLoading: nationalPvnetIntradayLoading,
    isValidating: nationalPvnetIntradayValidating,
    error: nationalPvnetIntradayError
  } = useLoadDataFromApi<ForecastData>(
    `${API_PREFIX}/solar/GB/national/forecast?include_metadata=false&model_name=pvnet_intraday&trend_adjuster_on=true`,
    {
      keepPreviousData: true,
      refreshInterval: 0 // Only load this once at beginning
    }
  );
  if (nationalPvnetIntradayError) {
    Sentry.captureMessage(
      `PVNet day-ahead forecast data load error: ${JSON.stringify(nationalPvnetIntradayError)}`
    );
  }
  const {
    data: nationalMetOfficeOnly,
    isLoading: nationalMetOfficeOnlyLoading,
    isValidating: nationalMetOfficeOnlyValidating,
    error: nationalMetOfficeOnlyError
  } = useLoadDataFromApi<ForecastData>(
    `${API_PREFIX}/solar/GB/national/forecast?include_metadata=false&model_name=pvnet_intraday_met_office_only&trend_adjuster_on=true`,
    {
      keepPreviousData: true,
      refreshInterval: 0
    }
  );
  if (nationalMetOfficeOnlyError) {
    Sentry.captureMessage(
      `Met Office forecast data load error: ${JSON.stringify(nationalMetOfficeOnlyError)}`
    );
  }

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
  const nMinuteForecast = nHourForecast * 60;
  const {
    data: nationalNHourData,
    isLoading: nationalNHourLoading,
    isValidating: nationalNHourValidating,
    error: nationalNHourError
  } = useLoadDataFromApi<NationalNHourData>(
    showNHourView
      ? `${API_PREFIX}/solar/GB/national/forecast?forecast_horizon_minutes=${nMinuteForecast}&historic=true&only_forecast_values=true`
      : null
  );
  const {
    data: allGspSystemData,
    isLoading: allGspSystemLoading,
    isValidating: allGspSystemValidating,
    error: allGspSystemError
  } = useLoadDataFromApi<components["schemas"]["Location"][]>(`${API_PREFIX}/system/GB/gsp/`);

  //////////////////////////////////////
  // ALL GSP FORECAST DATA
  //////////////////////////////////////
  // Load future all GSP forecast data (every 5 minutes)
  const {
    data: allGspForecastFutureData,
    isLoading: allGspForecastFutureLoading,
    isValidating: allGspForecastFutureValidating,
    error: allGspForecastFutureError
  } = useLoadDataFromApi<
    // TODO: see if we can fully integrate API paths/params into type safe functions
    // paths["/v0/solar/GB/gsp/forecast/all/"]["get"]["responses"]["200"]["content"]["application/json"]
    components["schemas"]["OneDatetimeManyForecastValues"][]
  >(
    // `/v0/solar/GB/gsp/forecast/all/`,
    `${API_PREFIX}/solar/GB/gsp/forecast/all/?compact=true&start_datetime_utc=${encodeURIComponent(
      `${forecastLastFetch30MinISO.slice(0, 19)}+00:00`
    )}`,
    {
      keepPreviousData: true,
      onSuccess: (data) => {
        const forecastHistoricStart = get30MinNow(forecastHistoricBackwardIntervalMinutes);
        const prev30MinFromNowISO = `${get30MinNow(-30)}:00+00:00`;
        setForecastLastFetch30MinISO(prev30MinFromNowISO);
        setAllGspForecastHistory(
          allGspForecastHistory
            ? filterCompactHistoricData(
                [...allGspForecastHistory, ...data],
                forecastHistoricStart,
                prev30MinFromNowISO
              )
            : filterCompactHistoricData(data, forecastHistoricStart, prev30MinFromNowISO)
        );
        setAllGspForecastFuture(filterCompactFutureData(data, prev30MinFromNowISO));
      }
    }
  );
  // Load historic all GSP forecast data (once, at page load)
  const {
    data: allGspForecastHistoricData,
    isLoading: allGspForecastHistoricLoading,
    isValidating: allGspForecastHistoricValidating,
    error: allGspForecastHistoricError
  } = useLoadDataFromApi<components["schemas"]["OneDatetimeManyForecastValues"][]>(
    `${API_PREFIX}/solar/GB/gsp/forecast/all/?historic=true&compact=true&start_datetime_utc=${encodeURIComponent(
      `${forecastFrom.slice(0, 19)}+00:00`
    )}&end_datetime_utc=${encodeURIComponent(`${forecastLastFetch30MinISO.slice(0, 19)}+00:00`)}`,
    {
      keepPreviousData: true,
      refreshInterval: 0, // Only load this once at beginning
      onSuccess: (data) => {
        if (!data) return;

        const oldestTimestamp = getOldestTimestampFromCompactForecastValues(data);
        const prev30MinNowISO = `${get30MinNow(-30)}:00+00:00`;
        setAllGspForecastHistory(filterCompactHistoricData(data, oldestTimestamp, prev30MinNowISO));
      }
    }
  );

  // Combine historic and future forecast data & fetch states
  const allGspForecastData = useMemo(() => {
    return allGspForecastHistory && allGspForecastFuture
      ? [...allGspForecastHistory, ...allGspForecastFuture]
      : [];
  }, [allGspForecastHistory, allGspForecastFuture]);
  const allGspForecastLoading = useMemo(() => {
    return allGspForecastFutureLoading;
  }, [allGspForecastFutureLoading]);
  const allGspForecastValidating = useMemo(() => {
    return allGspForecastFutureValidating;
  }, [allGspForecastFutureValidating]);
  const allGspForecastError = useMemo(() => {
    return allGspForecastHistoricError || allGspForecastFutureError;
  }, [allGspForecastHistoricError, allGspForecastFutureError]);

  //////////////////////////////////////
  // ALL GSP REAL DATA
  //////////////////////////////////////

  // Load all new GSP real data (every 5 minutes)
  const {
    data: allGspActualFutureData,
    isLoading: allGspActualFutureLoading,
    isValidating: allGspActualFutureValidating,
    error: allGspActualFutureError
  } = useLoadDataFromApi<
    components["schemas"]["GSPYieldGroupByDatetime"][]
    // paths["/v0/solar/GB/gsp/pvlive/all"]["get"]["responses"]["200"]["content"]["application/json"]
  >(
    `${API_PREFIX}/solar/GB/gsp/pvlive/all?regime=in-day&compact=true&compact=true&start_datetime_utc=${encodeURIComponent(
      `${actualsLastFetch30MinISO.slice(0, 19)}+00:00`
    )}`,
    {
      onSuccess: (data) => {
        const forecastHistoricStart = get30MinNow(actualsHistoricBackwardIntervalMinutes);
        const prev30MinFromNowISO = `${get30MinNow(-30)}:00+00:00`;
        setActualsLastFetch30MinISO(prev30MinFromNowISO);
        setAllGspActualHistory(
          allGspActualHistory
            ? filterCompactHistoricData<components["schemas"]["GSPYieldGroupByDatetime"]>(
                [...allGspActualHistory, ...data],
                forecastHistoricStart,
                prev30MinFromNowISO
              )
            : filterCompactHistoricData<components["schemas"]["GSPYieldGroupByDatetime"]>(
                data,
                forecastHistoricStart,
                prev30MinFromNowISO
              )
        );
        setAllGspActualFuture(
          filterCompactFutureData<components["schemas"]["GSPYieldGroupByDatetime"]>(
            data,
            prev30MinFromNowISO
          )
        );
      }
    }
  );

  // Load historic all GSP real data (once, at page load)
  const {
    data: allGspActualHistoricData,
    isLoading: allGspActualHistoricLoading,
    isValidating: allGspActualHistoricValidating,
    error: allGspActualHistoricError
  } = useLoadDataFromApi<components["schemas"]["GSPYieldGroupByDatetime"][]>(
    `${API_PREFIX}/solar/GB/gsp/pvlive/all?compact=true&end_datetime_utc=${encodeURIComponent(
      `${actualsLastFetch30MinISO.slice(0, 19)}+00:00`
    )}`,
    {
      refreshInterval: 0, // Only load this once at beginning
      onSuccess: (data) => {
        if (!data) return;

        const oldestTimestamp =
          getOldestTimestampFromCompactForecastValues<
            components["schemas"]["GSPYieldGroupByDatetime"]
          >(data);
        const historicBackwardIntervalMinutes =
          calculateHistoricDataStartFromCompactValuesIntervalInMinutes<
            components["schemas"]["GSPYieldGroupByDatetime"]
          >(data);
        const prev30MinNowISO = `${get30MinNow(-30)}:00+00:00`;
        setActualsLastFetch30MinISO(prev30MinNowISO);
        setActualsHistoricBackwardIntervalMinutes(historicBackwardIntervalMinutes);
        setAllGspActualHistory(
          filterCompactHistoricData<components["schemas"]["GSPYieldGroupByDatetime"]>(
            data,
            oldestTimestamp,
            prev30MinNowISO
          )
        );
      }
    }
  );

  // Combine historic and future real data & fetch states
  const allGspRealData = useMemo(() => {
    return allGspActualHistory && allGspActualFuture
      ? [...allGspActualHistory, ...allGspActualFuture]
      : [];
  }, [allGspActualHistory, allGspActualFuture]);
  const allGspRealLoading = useMemo(() => {
    return allGspActualHistoricLoading || allGspActualFutureLoading;
  }, [allGspActualHistoricLoading, allGspActualFutureLoading]);
  const allGspActualValidating = useMemo(() => {
    return allGspActualHistoricValidating || allGspActualFutureValidating;
  }, [allGspActualHistoricValidating, allGspActualFutureValidating]);
  const allGspActualError = useMemo(() => {
    return allGspActualHistoricError || allGspActualFutureError;
  }, [allGspActualHistoricError, allGspActualFutureError]);

  //////////////////////////////////////

  const currentYieldSet = useMemo(
    () =>
      allGspRealData?.find((datum) => {
        return datum.datetimeUtc.slice(0, 16) === `${selectedTime}`;
      }),
    [allGspRealData, selectedTime]
  );
  const currentYields = useMemo(
    () =>
      currentYieldSet
        ? Object.entries(currentYieldSet.generationKwByGspId).map(([key, val]) => {
            const gspLocationInfo = allGspSystemData?.find((gsp) => gsp.gspId === Number(key));
            return {
              gspId: key,
              gspRegion: gspLocationInfo?.regionName || "No name",
              gspCapacity: gspLocationInfo?.installedCapacityMw || 0,
              yield: val
            };
          })
        : [],
    [currentYieldSet, allGspSystemData]
  );
  const gspDeltas = useMemo(() => {
    console.log("about to calc deltas");
    let tempGspDeltas = new Map();
    const currentForecasts = allGspForecastData?.find((forecast) => {
      return forecast.datetimeUtc.slice(0, 16) === `${selectedTime}`;
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
  }, [allGspForecastData, currentYields, selectedTime, timeNow]);

  const combinedData: CombinedData = {
    nationalForecastData,
    nationalIntradayECMWFOnlyData,
    nationalMetOfficeOnly,
    nationalPvnetDayAhead,
    nationalPvnetIntraday,
    pvRealDayInData,
    pvRealDayAfterData,
    nationalNHourData,
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
      nationalNHourLoading: nationalNHourLoading,
      allGspSystemLoading,
      allGspForecastLoading,
      allGspRealLoading
    }),
    [
      nationalForecastLoading,
      pvRealDayInLoading,
      pvRealDayAfterLoading,
      nationalNHourLoading,
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
      nationalNHourValidating,
      allGspSystemValidating,
      allGspForecastValidating,
      allGspRealValidating: allGspActualValidating
    }),
    [
      nationalForecastValidating,
      pvRealDayInValidating,
      pvRealDayAfterValidating,
      nationalNHourValidating,
      allGspSystemValidating,
      allGspForecastValidating,
      allGspActualValidating
    ]
  );
  const combinedErrors: CombinedErrors = {
    nationalForecastError,
    pvRealDayInError,
    pvRealDayAfterError,
    nationalNHourError,
    allGspSystemError,
    allGspForecastError,
    allGspRealError: allGspActualError
  };

  const sitesViewSelected = currentView(VIEWS.SOLAR_SITES);

  // Sites API data
  const {
    data: allSitesData,
    isLoading: allSitesLoading,
    isValidating: allSitesValidating,
    error: allSitesError
  } = useLoadDataFromApi<AllSites>(`${SITES_API_PREFIX}/sites`, {
    isPaused: () => {
      console.log("Sites API data paused?", !sitesViewSelected);
      return false;
    }
  });
  const slicedSitesData = useMemo(
    () => allSitesData?.site_list.slice(0, 100) || [],
    [allSitesData]
  );
  const siteUuids = slicedSitesData.map((site) => site.site_uuid);
  const siteUuidsString = siteUuids?.join(",") || "";
  const {
    data: sitePvForecastData,
    isLoading: sitePvForecastLoading,
    isValidating: sitePvForecastValidating,
    error: sitePvForecastError
  } = useLoadDataFromApi<SitesPvForecast>(
    `${SITES_API_PREFIX}/sites/pv_forecast?site_uuids=${siteUuidsString}`,
    {
      // isPaused: () => {
      //   console.log(
      //     "Sites Forecast API data paused",
      //     !siteUuidsString?.length || !sitesViewSelected
      //   );
      //   return !siteUuidsString?.length;
      //   // return !siteUuidsString?.length || !sitesViewSelected;
      // }
    }
  );

  const {
    data: sitesPvActualData,
    isLoading: sitePvActualLoading,
    isValidating: sitePvActualValidating,
    error: sitePvActualError
  } = useLoadDataFromApi<SitesPvActual>(
    `${SITES_API_PREFIX}/sites/pv_actual?site_uuids=${siteUuidsString}`,
    {
      // isPaused: () => {
      //   console.log(
      //     "Sites Actual API data paused",
      //     !siteUuidsString?.length || !currentView(VIEWS.SOLAR_SITES)
      //   );
      //   return !siteUuidsString?.length;
      //   // return !siteUuidsString?.length || !currentView(VIEWS.SOLAR_SITES);
      // }
    }
  );

  const sitesData: CombinedSitesData = {
    allSitesData: slicedSitesData,
    sitesPvForecastData: useMemo(
      () => sitePvForecastData?.filter((d): d is SitePvForecast => !!d) || [],
      [sitePvForecastData]
    ),
    sitesPvActualData: useMemo(
      () => sitesPvActualData?.filter((d): d is SitePvActual => !!d) || [],
      [sitesPvActualData]
    )
  };

  const sitesCombinedLoading = useMemo(
    () => ({
      allSitesLoading,
      sitePvForecastLoading,
      sitePvActualLoading
    }),
    [allSitesLoading, sitePvForecastLoading, sitePvActualLoading]
  );

  const sitesCombinedValidating = useMemo(
    () => ({
      allSitesValidating,
      sitePvForecastValidating,
      sitePvActualValidating
    }),
    [allSitesValidating, sitePvForecastValidating, sitePvActualValidating]
  );

  const sitesCombinedErrors = {
    allSitesError,
    sitesPvForecastError: sitePvForecastError,
    sitesPvActualError: sitePvActualError
  };

  const aggregatedSitesData = useAggregateSitesDataForTimestamp(sitesData, selectedISOTime);

  const combinedErrorsLength = Object.values(combinedErrors).filter((e) => !!e).length;
  // Watch and update loading state
  useEffect(() => {
    setLoadingState(
      computeLoadingState(combinedLoading, combinedValidating, combinedErrors, combinedData)
    );
  }, [combinedLoading, combinedValidating, combinedErrorsLength, setLoadingState]);

  const sitesCombinedErrorsLength = Object.values(sitesCombinedErrors).filter((e) => !!e).length;

  // Watch and update sites loading state
  useEffect(() => {
    setSitesLoadingState(
      getSitesLoadingState(
        sitesCombinedLoading,
        sitesCombinedValidating,
        sitesCombinedErrors,
        sitesData
      )
    );
  }, [
    sitesCombinedLoading,
    sitesCombinedValidating,
    sitesCombinedErrorsLength,
    setSitesLoadingState
  ]);

  // const closedWidth = combinedDashboardModeActive ? "50%" : "56%";
  const closedWidth = "50%";

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
            combinedLoading={combinedLoading}
            combinedValidating={combinedValidating}
            combinedErrors={combinedErrors}
            activeUnit={activeUnit}
            setActiveUnit={setActiveUnit}
          />
          {!isProduction && (
            <SitesMap
              className={currentView(VIEWS.SOLAR_SITES) ? "" : "hidden"}
              sitesData={sitesData}
              aggregatedSitesData={aggregatedSitesData}
              sitesErrors={sitesCombinedErrors}
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

        <SideLayout
          bottomPadding={!currentView(VIEWS.SOLAR_SITES)}
          dashboardModeActive={combinedDashboardModeActive}
        >
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
        {isOldNowcastingDomain && (
          // Tailwind popup with deprecated domain message
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-mapbox-black bg-opacity-75">
            <div className="flex flex-col items-center justify-center">
              <div className="flex flex-col items-center text-xs text-ocf-gray-500 px-8 py-12 bg-mapbox-black rounded-md">
                <h3 className="text-xl mb-4 font-bold">We have moved.</h3>
                <div className="text-lg mr-1 mb-6">nowcasting.io has now become Quartz Solar.</div>
                <div className="text-lg mr-1 mb-6">
                  This URL is deprecated, please move over to the new Quartz domain.
                </div>
                <div>
                  <a
                    className="text-lg uppercase btn hover:bd-ocf-yellow-500"
                    href="https://app.quartz.solar"
                  >
                    Go to Quartz.solar
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export const getServerSideProps =
  process.env.NEXT_PUBLIC_DEV_MODE === "true"
    ? (context: any) => {
        const cookies = new Cookies(context.req, context.res);
        return {
          props: {
            dashboardModeServer: cookies.get(CookieStorageKeys.DASHBOARD_MODE) || false
          }
        };
      }
    : withPageAuthRequired({
        async getServerSideProps(context) {
          const cookies = new Cookies(context.req, context.res);
          return {
            props: {
              dashboardModeServer: cookies.get(CookieStorageKeys.DASHBOARD_MODE) || false
            }
          };
        }
      });
