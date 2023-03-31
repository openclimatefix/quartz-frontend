import { useUser, withPageAuthRequired } from "@auth0/nextjs-auth0";
import Layout from "../components/layout/layout";
import { PvLatestMap } from "../components/map";
import SideLayout from "../components/side-layout";
import PvRemixChart from "../components/charts/pv-remix-chart";
import useAndUpdateSelectedTime from "../components/hooks/use-and-update-selected-time";
import React, { useEffect, useMemo, useState } from "react";
import Header from "../components/layout/header";
import DeltaViewChart from "../components/charts/delta-view/delta-view-chart";
import { API_PREFIX, DELTA_BUCKET, getAllForecastUrl, SITES_API_PREFIX, VIEWS } from "../constant";
import useGlobalState from "../components/helpers/globalState";
import useSWRImmutable from "swr/immutable";
import {
  AllGspRealData,
  AllSites,
  CombinedData,
  CombinedErrors,
  CombinedSitesData,
  FcAllResData,
  ForecastData,
  GspAllForecastData,
  National4HourData,
  PvRealData,
  SitePvActual,
  SitePvForecast,
  SitesPvActual,
  SitesPvForecast
} from "../components/types";
import {
  axiosFetcher,
  axiosFetcherAuth,
  formatISODateString,
  getDeltaBucket
} from "../components/helpers/utils";
import useSWR from "swr";
import { ActiveUnit } from "../components/map/types";
import DeltaMap from "../components/map/deltaMap";
import * as Sentry from "@sentry/nextjs";
import SolarSiteChart from "../components/charts/solar-site-view/solar-site-chart";
import SitesMap from "../components/map/sitesMap";
import { useFormatSitesData } from "../components/hooks/useFormatSitesData";

export default function Home() {
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

  // Assuming first item in the array is the latest
  const useGetForecastsData = (isNormalized: boolean) => {
    const [forecastLoading, setForecastLoading] = useState(true);
    const [, setForecastCreationTime] = useGlobalState("forecastCreationTime");
    const bareForecastData = useSWRImmutable<FcAllResData>(
      () => getAllForecastUrl(false, false),
      axiosFetcherAuth,
      {
        onSuccess: (data) => {
          if (data.forecasts?.length)
            setForecastCreationTime(data.forecasts[0].forecastCreationTime);
          setForecastLoading(false);
        }
      }
    );

    const allForecastData = useSWR<FcAllResData>(
      () => getAllForecastUrl(true, true),
      axiosFetcherAuth,
      {
        refreshInterval: 1000 * 60 * 5, // 5min
        isPaused: () => forecastLoading,
        onSuccess: (data) => {
          setForecastCreationTime(data.forecasts[0].forecastCreationTime);
        }
      }
    );
    useEffect(() => {
      if (!forecastLoading) {
        allForecastData.mutate();
      }
    }, [forecastLoading]);

    if (isNormalized) return allForecastData;
    else return allForecastData.data ? allForecastData : bareForecastData;
  };

  // const { data: nationalForecastData, error: nationalForecastError } = useSWR<ForecastData>(
  //   `${API_PREFIX}/solar/GB/national/forecast?historic=false&only_forecast_values=true`,
  //   axiosFetcherAuth,
  //   {
  //     refreshInterval: 60 * 1000 * 5 // 5min
  //   }
  // );
  // const { data: pvRealDayInData, error: pvRealDayInError } = useSWR<PvRealData>(
  //   `${API_PREFIX}/solar/GB/national/pvlive?regime=in-day`,
  //   axiosFetcherAuth,
  //   {
  //     refreshInterval: 60 * 1000 * 5 // 5min
  //   }
  // );
  // const { data: pvRealDayAfterData, error: pvRealDayAfterError } = useSWR<PvRealData>(
  //   `${API_PREFIX}/solar/GB/national/pvlive?regime=day-after`,
  //   axiosFetcherAuth,
  //   {
  //     refreshInterval: 60 * 1000 * 5 // 5min
  //   }
  // );
  // const { data: national4HourData, error: national4HourError } = useSWR<National4HourData>(
  //   show4hView
  //     ? `${API_PREFIX}/solar/GB/national/forecast?forecast_horizon_minutes=240&historic=true&only_forecast_values=true`
  //     : null,
  //   axiosFetcherAuth,
  //   {
  //     refreshInterval: 60 * 1000 * 5 // 5min
  //   }
  // );
  // const { data: allGspForecastData, error: allGspForecastError } = useSWR<GspAllForecastData>(
  //   `${API_PREFIX}/solar/GB/gsp/forecast/all/?historic=true`,
  //   axiosFetcherAuth,
  //   {
  //     refreshInterval: 60 * 1000 * 5 // 5min
  //   }
  // );
  // const { data: allGspRealData, error: allGspRealError } = useSWR<AllGspRealData>(
  //   `${API_PREFIX}/solar/GB/gsp/pvlive/all?regime=in-day`,
  //   axiosFetcherAuth,
  //   {
  //     refreshInterval: 60 * 1000 * 5 // 5min
  //   }
  // );
  //
  // const currentYields =
  //   allGspRealData?.map((datum) => {
  //     const gspYield = datum.gspYields.find((yieldDatum, index) => {
  //       return yieldDatum.datetimeUtc === `${selectedTime}:00+00:00`;
  //     });
  //     return {
  //       gspId: datum.gspId,
  //       gspRegion: datum.regionName,
  //       gspCapacity: datum.installedCapacityMw,
  //       yield: gspYield?.solarGenerationKw || 0
  //     };
  //   }) || [];
  // const gspDeltas = useMemo(() => {
  //   let tempGspDeltas = new Map();
  //
  //   for (let i = 0; i < currentYields.length; i++) {
  //     const currentYield = currentYields[i];
  //     let gspForecastData = allGspForecastData?.forecasts[i];
  //     if (gspForecastData?.location.gspId !== currentYield.gspId) {
  //       gspForecastData = allGspForecastData?.forecasts.find((gspForecastDatum) => {
  //         return gspForecastDatum.location.gspId === currentYield.gspId;
  //       });
  //     }
  //     const currentGspForecast = gspForecastData?.forecastValues.find((forecastValue) => {
  //       return forecastValue.targetTime === `${selectedTime}:00+00:00`;
  //     });
  //     const isFutureOrNoYield = `${selectedTime}:00.000Z` >= timeNow || !currentYield.yield;
  //     const delta = isFutureOrNoYield
  //       ? 0
  //       : currentYield.yield / 1000 - (currentGspForecast?.expectedPowerGenerationMegawatts || 0);
  //     const deltaNormalized = isFutureOrNoYield
  //       ? 0
  //       : (currentYield.yield / 1000 -
  //           (currentGspForecast?.expectedPowerGenerationMegawatts || 0)) /
  //           currentYield.gspCapacity || 0;
  //     const deltaBucket = getDeltaBucket(delta);
  //     tempGspDeltas.set(currentYield.gspId, {
  //       gspId: currentYield.gspId,
  //       gspRegion: currentYield.gspRegion,
  //       gspCapacity: currentYield.gspCapacity,
  //       currentYield: currentYield.yield / 1000,
  //       forecast: currentGspForecast?.expectedPowerGenerationMegawatts || 0,
  //       delta,
  //       deltaPercentage:
  //         (currentYield.yield /
  //           1000 /
  //           (currentGspForecast?.expectedPowerGenerationMegawatts || 0)) *
  //         100,
  //       deltaNormalized,
  //       deltaBucket: deltaBucket,
  //       deltaBucketKey: DELTA_BUCKET[deltaBucket]
  //     });
  //   }
  //   console.log("gspDeltas calculated");
  //   console.log(
  //     "gspDeltas",
  //     Array.from(tempGspDeltas)
  //       .filter((gspDelta) => gspDelta[1].delta > 0)
  //       .map((gspDelta, index) => {
  //         const delta = gspDelta[1].delta;
  //         return delta;
  //       })
  //   );
  //   return tempGspDeltas;
  // }, [allGspForecastData, allGspRealData, selectedTime]);

  // // code for site specific aggregated values
  // const dnoAggregations = sitesArray.reduce((acc, group) => {
  //   let { installed_capacity_kw, dno } = group
  //   return { ...acc, [dno]: [...(acc[dno] || []), installed_capacity_kw] }
  // }, {}
  // )

  // const gspAggregations = sitesArray.reduce((acc, group) => {
  //   let { site_uuid, gsp } = group
  //   return { ...acc, [gsp]: [...(acc[gsp] || []), site_uuid] }
  // }, {}
  // )

  // console.log(dnoAggregations)
  // console.log(gspAggregations)

  // const combinedData: CombinedData = {
  //   nationalForecastData,
  //   pvRealDayInData,
  //   pvRealDayAfterData,
  //   national4HourData,
  //   allGspForecastData,
  //   allGspRealData,
  //   gspDeltas
  // };
  // const combinedErrors: CombinedErrors = {
  //   nationalForecastError,
  //   pvRealDayInError,
  //   pvRealDayAfterError,
  //   national4HourError,
  //   allGspForecastError,
  //   allGspRealError
  // };

  // Sites API data
  const selectedSiteId = "725a8670-d012-474d-b901-1179f43e7182";
  const selectedSiteId2 = "9570f807-fc9e-47e9-b5e3-5915ddddef3d";
  const userSites = [selectedSiteId, selectedSiteId2];
  // const userSites = [selectedSiteId];
  const { data: allSitesData, error: allSitesError } = useSWR<AllSites>(
    `${SITES_API_PREFIX}/sites`,
    axiosFetcher
  );
  const slicedSitesData = allSitesData?.site_list.slice(0, 100) || [];
  const siteUuids = slicedSitesData.map((site) => site.site_uuid);
  const siteUuidsString = siteUuids?.join(",");
  // const siteUuidsString = userSites?.join(",");
  const { data: sitePvForecastData, error: sitePvForecastError } = useSWR<SitesPvForecast, any>(
    `${SITES_API_PREFIX}/sites/pv_forecast?site_uuids=${siteUuidsString}`,
    axiosFetcher,
    {
      isPaused: () => !siteUuidsString?.length,
      // dedupingInterval: 10000,
      refreshInterval: 60 * 1000 * 5 // 5min
    }
  );
  // console.log("sitesUuids", siteUuids);
  // console.log("siteUuidsString", siteUuidsString);

  // console.log("allSitesData", allSitesData);
  //
  // const { data: sitePvForecastData2, error: sitePvForecastError2 } = useSWR<SitesPvForecast>(
  //   `${SITES_API_PREFIX}/sites/pv_forecast/${selectedSiteId2}`,
  //   axiosFetcher,
  //   {
  //     refreshInterval: 60 * 1000 * 5 // 5min
  //   }
  // );
  const { data: sitesPvActualData, error: sitePvActualError } = useSWR<SitesPvActual>(
    `${SITES_API_PREFIX}/sites/pv_actual?site_uuids=${siteUuidsString}`,
    axiosFetcher,
    {
      isPaused: () => !siteUuidsString?.length,
      refreshInterval: 60 * 1000 * 5 // 5min
    }
  );
  // const { data: sitePvActualData2, error: sitePvActualError2 } = useSWR<SitesPvActual>(
  //   `${SITES_API_PREFIX}/sites/pv_actual/${selectedSiteId2}`,
  //   axiosFetcher,
  //   {
  //     refreshInterval: 60 * 1000 * 5 // 5min
  //   }
  // );
  //allSitesData?.site_list.filter((site) => userSites.includes(site.site_uuid)) || undefined,
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

  const currentView = (v: VIEWS) => v === view;

  const aggregatedSitesData = useFormatSitesData(sitesData, selectedISOTime);

  return (
    <Layout>
      <div className="h-full relative pt-16">
        <Header view={view} setView={setView} />
        <div id="map-container" className={`relative float-right h-full`} style={{ width: "56%" }}>
          {/*<PvLatestMap*/}
          {/*  className={currentView(VIEWS.FORECAST) ? "" : "hidden"}*/}
          {/*  getForecastsData={useGetForecastsData}*/}
          {/*  activeUnit={activeUnit}*/}
          {/*  setActiveUnit={setActiveUnit}*/}
          {/*/>*/}
          <SitesMap
            className={currentView(VIEWS.SOLAR_SITES) ? "" : "hidden"}
            getForecastsData={useGetForecastsData}
            sitesData={sitesData}
            aggregatedSitesData={aggregatedSitesData}
            sitesErrors={sitesErrors}
            activeUnit={activeUnit}
            setActiveUnit={setActiveUnit}
          />
          {/*<DeltaMap*/}
          {/*  className={currentView(VIEWS.DELTA) ? "" : "hidden"}*/}
          {/*  getForecastsData={useGetForecastsData}*/}
          {/*  combinedData={combinedData}*/}
          {/*  combinedErrors={combinedErrors}*/}
          {/*  activeUnit={activeUnit}*/}
          {/*  setActiveUnit={setActiveUnit}*/}
          {/*/>*/}
        </div>

        <SideLayout>
          {/*<PvRemixChart*/}
          {/*  combinedData={combinedData}*/}
          {/*  combinedErrors={combinedErrors}*/}
          {/*  className={currentView(VIEWS.FORECAST) ? "" : "hidden"}*/}
          {/*/>*/}
          <SolarSiteChart
            combinedSitesData={sitesData}
            aggregatedSitesData={aggregatedSitesData}
            className={currentView(VIEWS.SOLAR_SITES) ? "" : "hidden"}
          />
          {/*<DeltaViewChart*/}
          {/*  combinedData={combinedData}*/}
          {/*  combinedErrors={combinedErrors}*/}
          {/*  className={currentView(VIEWS.DELTA) ? "" : "hidden"}*/}
          {/*/>*/}
        </SideLayout>
      </div>
    </Layout>
  );
}

export const getServerSideProps = withPageAuthRequired();
