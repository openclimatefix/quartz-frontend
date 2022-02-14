import Head from "next/head";
import { withPageAuthRequired } from "@auth0/nextjs-auth0";
import useSWR from "swr";
import dynamic from "next/dynamic";

// import { Button } from "@openclimatefix/nowcasting-ui";

import Layout from "../components/layout";
import Chart from "../components/chart";
import TimeHorizonSelector from "../components/TimeHorizonSelector";
import { useState } from "react";
import GSPOrNationalSelector from "../components/gsp-or-national-selector";

const fetcher = (input: RequestInfo, init: RequestInit) =>
  fetch(input, init).then((res) => res.json());

const API_PREFIX_LOCAL = "/api";
const API_PREFIX_REMOTE = "https://api-dev.nowcasting.io/v0";
const IS_LOCAL_REQ = true;
const API_PREFIX = IS_LOCAL_REQ ? API_PREFIX_LOCAL : API_PREFIX_REMOTE;

const DynamicSolarMapWithNoSSR = dynamic(
  () => import("../components/solar-map"),
  { ssr: false }
);

export default function Home() {
  const [selectedTimeHorizon, setSelectedTimeHorizon] = useState(0);
  const [showGSPForecast, setShowGSPForecast] = useState(true);

  const { data: forecastData, error: forecastError } = useSWR(
    `${API_PREFIX}/forecasts/GB/pv/gsp`,
    fetcher
  );
  const { data: gspregionData, error: gspregionError } = useSWR(
    `${API_PREFIX}/forecasts/GB/pv/gsp_boundaries`,
    fetcher
  );

  if (forecastError || gspregionError) {
    console.log(forecastError || gspregionError);
    return <div>Failed to load</div>;
  }

  return (
    <Layout environment={IS_LOCAL_REQ ? "local" : "dev"}>
      <div className="container min-h-screen">
        <Head>
          <title>Nowcasting App</title>
        </Head>

        <main className="py-20">
          {gspregionData && forecastData && (
            <>
              <div className="flex justify-center w-full gap-6">
                <GSPOrNationalSelector
                  showGSPForecast={showGSPForecast}
                  setShowGSPForecast={setShowGSPForecast}
                />
                <TimeHorizonSelector
                  selectedTimeHorizon={selectedTimeHorizon}
                  setSelectedTimeHorizon={setSelectedTimeHorizon}
                  targetTimes={forecastData.forecasts[0].forecastValues}
                />
              </div>
              <div className="my-6">
                <DynamicSolarMapWithNoSSR
                  gspregionData={
                    // TODO(nowcasting_infrastructure#35): Remove parse once fixed
                    IS_LOCAL_REQ ? gspregionData : JSON.parse(gspregionData)
                  }
                  // TODO: don't pop last element once NATIONAL fc not in GSP
                  forecastDataGSP={forecastData.forecasts.slice(0, -1)}
                  forecastDataNational={
                    forecastData.forecasts[forecastData.forecasts.length - 1]
                  }
                  selectedTimeHorizon={selectedTimeHorizon}
                  showGSPForecast={showGSPForecast}
                />
              </div>
            </>
          )}

          {!forecastData ? (
            <p>Loading...</p>
          ) : (
            <>
              <div className="my-6 border-2 border-black h-72">
                {/* TODO: don't pop last element once NATIONAL fc not in GSP */}
                <Chart
                  data={forecastData.forecasts.slice(0, -1)}
                  selectedTimeHorizon={selectedTimeHorizon}
                />
              </div>
            </>
          )}
        </main>
      </div>
    </Layout>
  );
}

export const getServerSideProps = withPageAuthRequired();
