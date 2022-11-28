import { withPageAuthRequired } from "@auth0/nextjs-auth0";
import Layout from "../components/layout/layout";
import { PvLatestMap } from "../components/map";
import SideLayout from "../components/side-layout";
import PvRemixChart from "../components/charts/pv-remix-chart";
import useAndUpdateSelectedTime from "../components/hooks/use-and-update-selected-time";
import React, { useEffect, useState } from "react";
import Header from "../components/layout/header";
import ForecastHeader from "../components/charts/forecast-header";
import DeltaViewComponent from "../components/charts/delta-view/delta-view-chart";
import { getAllForecastUrl, VIEWS } from "../constant";
import useGlobalState from "../components/helpers/globalState";
import useSWRImmutable from "swr/immutable";
import { FcAllResData } from "../components/types";
import { axiosFetcherAuth } from "../components/helpers/utils";
import useSWR from "swr";
import { ActiveUnit } from "../components/map/types";
import DeltaMap from "../components/map/deltaMap";

export default function Home() {
  useAndUpdateSelectedTime();
  const [view, setView] = useState<VIEWS>(VIEWS.FORECAST);
  const [activeUnit, setActiveUnit] = useState<ActiveUnit>(ActiveUnit.MW);

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

  const currentView = (v: VIEWS) => v === view;
  return (
    <Layout>
      <div className="h-full relative pt-16">
        <Header view={view} setView={setView} />
        <div id="map-container" className={`relative float-right h-full`} style={{ width: "56%" }}>
          <PvLatestMap
            className={currentView(VIEWS.FORECAST) ? "" : "hidden"}
            getForecastsData={useGetForecastsData}
            activeUnit={activeUnit}
            setActiveUnit={setActiveUnit}
          />
          <DeltaMap
            className={currentView(VIEWS.DELTA) ? "" : "hidden"}
            getForecastsData={useGetForecastsData}
            activeUnit={activeUnit}
            setActiveUnit={setActiveUnit}
          />
        </div>

        <SideLayout>
          <PvRemixChart className={currentView(VIEWS.FORECAST) ? "" : "hidden"} />
          <DeltaViewComponent className={currentView(VIEWS.DELTA) ? "" : "hidden"} />
        </SideLayout>
      </div>
    </Layout>
  );
}

export const getServerSideProps = withPageAuthRequired();
