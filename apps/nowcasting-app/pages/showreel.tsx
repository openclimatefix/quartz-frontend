import React from "react";
import dynamic from "next/dynamic";
import { withPageAuthRequired } from "@auth0/nextjs-auth0";
import "mapbox-gl/dist/mapbox-gl.css";

// TEMP: the GB + NL regional forecast as a looping animation out of black. No shell, no controls.
// Client-only — the component owns a Mapbox instance.
const ForecastShowreel = dynamic(() => import("../components/showreel/forecast-showreel"), {
  ssr: false
});

export default function Showreel() {
  return <ForecastShowreel />;
}

// Same auth gate as the dashboard, minus the cookie reads it does not need.
export const getServerSideProps =
  process.env.NEXT_PUBLIC_DEV_MODE === "true"
    ? async () => ({ props: {} })
    : withPageAuthRequired({
        async getServerSideProps() {
          return { props: {} };
        }
      });
