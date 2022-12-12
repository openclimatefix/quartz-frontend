import { useUser, withPageAuthRequired } from "@auth0/nextjs-auth0";
import Layout from "../components/layout/layout";
import { PvLatestMap } from "../components/map";
import SideLayout from "../components/side-layout";
import PvRemixChart from "../components/charts/pv-remix-chart";
import useAndUpdateSelectedTime from "../components/hooks/use-and-update-selected-time";
import React, { useEffect, useState } from "react";
import Header from "../components/layout/header";
import ForecastHeader from "../components/charts/forecast-header";
import { VIEWS } from "../constant";
import * as Sentry from "@sentry/nextjs";

export default function Home() {
  useAndUpdateSelectedTime();
  const [view, setView] = useState<VIEWS>(VIEWS.FORECAST);
  const { user, isLoading, error } = useUser();

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

  const currentView = (v: VIEWS) => v === view;
  return (
    <Layout>
      <div className="h-full relative pt-16">
        <Header view={view} setView={setView} />
        <div
          id="map-container"
          className={`relative float-right h-full ${currentView(VIEWS.FORECAST)}`}
          style={{ width: "56%" }}
        >
          <PvLatestMap />
        </div>

        <SideLayout>
          <PvRemixChart className={`${currentView(VIEWS.FORECAST)}`} />
        </SideLayout>
      </div>
    </Layout>
  );
}

export const getServerSideProps = withPageAuthRequired();
