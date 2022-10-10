import { withPageAuthRequired } from "@auth0/nextjs-auth0";
import Layout from "../components/layout/layout";
import { PvLatestMap } from "../components/map";
import SideLayout from "../components/side-layout";
import PvRemixChart from "../components/charts/pv-remix-chart";
import useAndUpdateSelectedTime from "../components/hooks/use-and-update-selected-time";
import React, { useState } from "react";
import Header from "../components/layout/header";

export default function Home() {
  useAndUpdateSelectedTime();

  return (
    <Layout>
      <div className="h-full relative pt-16">
        <Header />
        <div id="map-container" className="relative float-right h-full" style={{ width: "56%" }}>
          <PvLatestMap />
        </div>

        <SideLayout>
          <PvRemixChart />
        </SideLayout>
      </div>
    </Layout>
  );
}

export const getServerSideProps = withPageAuthRequired();
