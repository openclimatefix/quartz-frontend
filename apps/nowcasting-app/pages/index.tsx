import { withPageAuthRequired } from "@auth0/nextjs-auth0";
import Layout from "../components/layout/layout";
import { PvLatestMap } from "../components/map";
import SideLayout from "../components/side-layout";
import PvRemixChart from "../components/charts/pv-remix-chart";
import useAndUpdateSelectedTime from "../components/hooks/use-and-update-selected-time";
import React, { useState } from "react";
import Header from "../components/layout/header";
import { VIEWS } from "../constant";
import DeltaViewMainComponent from "../components/charts/delta-view/delta-view-large-component";

export default function Home() {
  useAndUpdateSelectedTime();
  const [view, setView] = useState<VIEWS>(VIEWS.FORECAST);

  const currentView = (v: VIEWS) => v === view;
  return (
    <Layout>
      <div className="h-full relative pt-16">
        <Header view={view} setView={setView} />
        <div
          id="map-container"
          className={`relative float-right h-full ${currentView(VIEWS.FORECAST) ? "" : "hidden"}`}
          style={{ width: "56%" }}
        >
          <PvLatestMap />
        </div>

        <SideLayout>
          <PvRemixChart className={currentView(VIEWS.FORECAST) ? "" : "hidden"} />
          <DeltaViewMainComponent className={currentView(VIEWS.DELTA) ? "" : "hidden"}/>
        </SideLayout>
      </div>
    </Layout>
  );
}

export const getServerSideProps = withPageAuthRequired();
