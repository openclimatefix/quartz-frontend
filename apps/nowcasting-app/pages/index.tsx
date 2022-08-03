import { withPageAuthRequired } from "@auth0/nextjs-auth0";
import Layout from "../components/layout";
import { PvLatestMap } from "../components/map";
import SideLayout from "../components/side-layout";
import PvRemixChart from "../components/charts/pv-remix-chart";
import useAndUpdateSelectedTime from "../components/hooks/use-and-update-selected-time";
import { useState } from "react";

const OCFlogo = () => (
  <a
    className="absolute bottom-0 left-0 bg-mapbox-black p-2 z-20"
    href="https://www.openclimatefix.org/"
    target="_blank"
    rel="noreferrer"
  >
    <img src="/OCF_icon_wht.svg" alt="ofc" width={100} />
  </a>
);
export default function Home() {
  useAndUpdateSelectedTime();

  return (
    <Layout>
      <div className="h-full relative">
        <div id="map-container" className="relative float-right h-full" style={{ width: "56%" }}>
          <PvLatestMap />
          <OCFlogo />
        </div>

        <SideLayout>
          <PvRemixChart />
        </SideLayout>
      </div>
      <a
        className="bg-black text-white text-sm py-2 px-3"
        href="https://docs.google.com/forms/d/e/1FAIpQLSf08XJPFwsNHxYiHUTV4g9CHWQzxAn0gSiAXXFkaI_3wjpNWw/viewform"
        target="_blank"
        rel="noreferrer"
      >
        Give Feedback
      </a>
    </Layout>
  );
}

export const getServerSideProps = withPageAuthRequired();
