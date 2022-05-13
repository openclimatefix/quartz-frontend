import Head from "next/head";
import {useEffect, useState} from "react";
import { withPageAuthRequired } from "@auth0/nextjs-auth0";
import useSWR from "swr";

import Layout from "../components/layout";
import Map from "../components/map";
import ButtonGroup from "../components/button-group";
import gspShapeData from "../data/gsp-regions.json";
import * as d3 from "d3";


const fetcher = (input: RequestInfo, init: RequestInit) =>
  fetch(input, init).then((res) => res.json());

const API_PREFIX = "http://nowcasting-api-development.eu-west-1.elasticbeanstalk.com/v0";

export default function Home() {

  const { data: forecastData, error: forecastError } = useSWR(
    `${API_PREFIX}/GB/solar/gsp/forecast/all`,
    fetcher
  );
  
  if (forecastError) {
    console.log(forecastError);
    return <div>Failed to load</div>;
  }
  if (!forecastData) return <div>loading...</div>;

  console.log("forecastData", forecastData);
 
  const getPaintPropsForFC = () => {
    if (!forecastData.forecasts) {
      return;
    }

    const allValues = forecastData?.forecasts?.map((item, index) => {
      return Math.floor(item.forecastValues[0].expectedPowerGenerationMegawatts);
    })
   
    console.log("allValues", allValues);
    const extent = d3.extent([...allValues]);
    console.log("extent", extent);
    return {
      "fill-color": "#eab308",
      "fill-opacity": 
      [
        "interpolate",
        ["exponential", 1],
        ["get", "expectedPowerGenerationMegawatts"],
        extent[0],
        0,
        extent[1],
        0.9,
      ],
    };
  };

  const addFCData = (map) => {
    map.current.addSource("pverrorbygsp", {
      type: "geojson",
      data: gspShapeData
    });

    map.current.addLayer({
      id: "pverrorbygsp-forecast",
      type: "fill",
      source: "pverrorbygsp",
      layout: {visibility: "visible"},
      paint: getPaintPropsForFC(),
    });

    // map.current.addLayer({
    //   'id': 'pverrorbygsp',
    //   'type': 'fill',
    //   'source': 'pverrorbygsp', // reference the data source
    //   'layout':  {visibility: "visible"},
    //   'paint': {
    //     'fill-color': '#0080ff', // blue color fill
    //     'fill-opacity': 0.5
    //     }
    // });
  };

  return (
    <Layout>
      <div>
        <Head>
          <title>Nowcasting App</title>
        </Head>

        <main className="pb-20">
          <div className="w-full h-screen mb-20">
            <Map
              loadDataOverlay={addFCData}
              controlOverlay={(map) => (
                <>
                  <ButtonGroup />
                </>
              )}
            />
          </div>

          <h1>
            Fetching real data from{" "}
            <a href={API_PREFIX} className="hover:underline">
              {API_PREFIX}
            </a>
            :
          </h1>
          <pre className="p-2 mt-4 text-white bg-gray-800 rounded-md">
            <code>{JSON.stringify(forecastData, null, 2)}</code>
          </pre>
        </main>
      </div>
    </Layout>
  );
}

export const getServerSideProps = withPageAuthRequired();
