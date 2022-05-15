import Head from "next/head";
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

// Assuming first item in the array is the latest
const latestForecastValue = 0;

export default function Home() {

  const { data: forecastData, error: forecastError } = useSWR(
    `${API_PREFIX}/GB/solar/gsp/forecast/all`,
    fetcher,
    // every 5 minutes
    { refreshInterval: 300000 }
  );
  
  if (forecastError) {
    console.log(forecastError);
    return <div>Failed to load</div>;
  }
  if (!forecastData) return <div>loading...</div>;

  const filteredForcastData = forecastData?.forecasts?.slice(1);

  const forecastGeoJson = {
    ...gspShapeData,
    features: gspShapeData.features.map((featureObj, index) => (
      {
        ...featureObj,
        properties: {
          ...featureObj.properties,
          expectedPowerGenerationMegawatts: Math.floor(filteredForcastData[index].forecastValues[latestForecastValue].expectedPowerGenerationMegawatts)
        }
      }
    ))
  };

  const getPaintPropsForFC = () => {
    const allValues = filteredForcastData.map((item) => {
      return Math.floor(item.forecastValues[latestForecastValue].expectedPowerGenerationMegawatts);
    })
   
    const extent = d3.extent([...allValues]);

    return {     
      "fill-color": "#eab308",
      "fill-opacity": 
      [
        "interpolate",
        ["linear"],
        ['get', 'expectedPowerGenerationMegawatts'],
        extent[0],
        0,
        extent[1],
        1,
      ],
    };
  };

  const addFCData = (map) => {
    map.current.addSource("latestPV", {
      type: "geojson",
      data: forecastGeoJson
    });

    map.current.addLayer({
      id: "latestPV-forecast",
      type: "fill",
      source: "latestPV",
      layout: {visibility: "visible"},
      paint: getPaintPropsForFC(),
    });
  };

  return (
    <Layout>
      <div>
        <Head>
          <title>Nowcasting App</title>
        </Head>
        <main>
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
        </main>
      </div>
    </Layout>
  );
}

export const getServerSideProps = withPageAuthRequired();
