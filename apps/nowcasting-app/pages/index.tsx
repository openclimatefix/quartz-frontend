import Head from "next/head";
import { withPageAuthRequired } from "@auth0/nextjs-auth0";
import useSWR from "swr";

import Layout from "../components/layout";
import Map from "../components/map";
import { API_PREFIX } from "../constant";
import ButtonGroup from "../components/button-group";
import gspShapeData from "../data/gsp-regions.json";
import * as d3 from "d3";


const fetcher = (input: RequestInfo, init: RequestInit) =>
  fetch(input, init).then((res) => res.json());

// Assuming first item in the array is the latest
const latestForecastValue = 0;

export default function Home() {

  const { data: initForecastData, error: forecastError, mutate } = useSWR(
    `${API_PREFIX}/GB/solar/gsp/forecast/all`,
    fetcher,
  );

  if (forecastError) {
    console.log(forecastError);
    return <div>Failed to load</div>;
  }
  if (!initForecastData) return <div>loading...</div>;

  const generateGeoJsonForecastData = (forecastData) => {
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

    return {filteredForcastData, forecastGeoJson};
  }

  const getPaintPropsForFC = (filteredForcastData) => {
    const allValues = filteredForcastData.map((item) => {
      return Math.floor(item.forecastValues[latestForecastValue].expectedPowerGenerationMegawatts);
    })
   
    const extent = d3.extent([...allValues]);

    return {     
      "fill-color": "#eab308",
      "fill-opacity": 
      [
        "interpolate",
        ["exponential", 1],
        ['get', 'expectedPowerGenerationMegawatts'],
        extent[0],
        0,
        extent[1],
        1,
      ],
    };
  };

  const addFCData = (map) => {
    const {filteredForcastData, forecastGeoJson} = generateGeoJsonForecastData(initForecastData);

    map.current.addSource("latestPV", {
      type: "geojson",
      data: forecastGeoJson
    });

    map.current.addLayer({
      id: "latestPV-forecast",
      type: "fill",
      source: "latestPV",
      layout: {visibility: "visible"},
      paint: getPaintPropsForFC(filteredForcastData),
    });

    const updateSource = setInterval(async () => {
      try {
        const updatedForecastData = await mutate(
          `${API_PREFIX}/GB/solar/gsp/forecast/all`,
        );
  
        // console.log("sucess");
        const {forecastGeoJson} = generateGeoJsonForecastData(updatedForecastData);
        map.current.getSource('latestPV').setData(forecastGeoJson);
      }catch{
        if (updateSource) clearInterval(updateSource);
      }
      // every 5 minutes
    }, 300000);
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
