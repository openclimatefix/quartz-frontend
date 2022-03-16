import { NextPage } from "next";
import dynamic from "next/dynamic";
import { useState } from "react";
import DataAttribution from "../components/data-attribution";
import Layout from "../components/layout";
import Map from "../components/map";

import pvMapData from "../data/pv/generation-2021-06-10.json";
import pvLiveGenerationData from "../data/pv/pvlive-2021-06-10.json";

const PV_GENERATION_MIN = 0;
const PV_GENERATION_MAX = 3000;

const MyResponsiveLine = dynamic(() => import("../components/charts/line"), {
  ssr: false,
});

const Vis1MapPage: NextPage = () => {
  const INITIAL_TIME_STEP = 23;
  const [selectedTimeStep, setSelectedTimeStep] = useState(INITIAL_TIME_STEP);

  const timeSteps = [
    "00:30",
    "01:00",
    "01:30",
    "02:00",
    "02:30",
    "03:00",
    "03:30",
    "04:00",
    "04:30",
    "05:00",
    "05:30",
    "06:00",
    "06:30",
    "07:00",
    "07:30",
    "08:00",
    "08:30",
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "12:30",
    "13:00",
    "13:30",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
    "17:00",
    "17:30",
    "18:00",
    "18:30",
    "19:00",
    "19:30",
    "20:00",
    "20:30",
    "21:00",
    "21:30",
    "22:00",
    "22:30",
    "23:00",
    "23:30",
  ];

  const filterBy = (map, timeStep) => {
    if (!map.current) return; // wait for map to initialize

    const filters = ["==", "time", timeStep];
    map.current.setFilter("pvgeneration-circles", filters);
    setSelectedTimeStep(timeStep);
  };

  const addPVData = (map) => {
    map.current.addSource("pvgeneration", {
      type: "geojson",
      data: pvMapData,
    });

    map.current.addLayer({
      id: "pvgeneration-circles",
      type: "circle",
      source: "pvgeneration",
      paint: {
        "circle-color": [
          "interpolate",
          ["linear"],
          ["get", "solarGeneration"],
          PV_GENERATION_MIN,
          "#eab308",
          PV_GENERATION_MAX,
          "#ef4444",
        ],
        "circle-opacity": 0.75,
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["get", "solarGeneration"],
          PV_GENERATION_MIN,
          0,
          PV_GENERATION_MAX,
          30,
        ],
      },
    });

    filterBy(map, INITIAL_TIME_STEP);
  };

  return (
    <Layout title="Solar Generation Data by Site">
      <DataAttribution
        datasets={[
          {
            title: "PV Generation",
            sourceName: "PV_Live, Sheffield Solar",
            sourceUrl: "https://www.solar.sheffield.ac.uk/pvlive/",
            displayedWhere: "Line Chart",
            isPublic: true,
          },
          {
            title: "PV Forecast",
            sourceName: "National Grid ESO",
            displayedWhere: "Line Chart",
            isPublic: false,
          },
          {
            title: "PV Generation by Site (Obfuscated)",
            sourceName: "Passiv",
            sourceUrl: "https://huggingface.co/datasets/openclimatefix/uk_pv",
            displayedWhere: "Map",
            isPublic: true,
          },
        ]}
      />
      <div className="flex flex-col h-full">
        <div className="flex-grow">
          <Map
            loadDataOverlay={addPVData}
            controlOverlay={(map) => {
              return (
                <>
                  <h2 className="font-bold">Solar Generation Data by Site</h2>
                  <label id="timeStep"></label>
                  <input
                    id="slider"
                    type="range"
                    min="0"
                    max="46"
                    step="1"
                    value={selectedTimeStep}
                    className="w-full mt-3"
                    onChange={(e) => {
                      const timeStep = parseInt(e.target.value, 10);
                      filterBy(map, timeStep);
                    }}
                  />
                  <div className="flex">
                    <div className="flex-grow">
                      Time: <span>{timeSteps[selectedTimeStep]}</span>
                    </div>
                    <div className="">
                      <button
                        className="px-2 py-1 mr-1 border-2 border-white select-none"
                        onClick={() => {
                          // Decrement timeStep or go back to max
                          if (selectedTimeStep === 0) {
                            return filterBy(map, timeSteps.length - 1);
                          }
                          filterBy(map, selectedTimeStep - 1);
                        }}
                      >
                        &lt;
                      </button>
                      <button
                        className="px-2 py-1 border-2 border-white select-none"
                        onClick={() => {
                          // Incrememnt timeStep or go back to 0
                          if (selectedTimeStep === timeSteps.length - 1) {
                            return filterBy(map, 0);
                          }
                          filterBy(map, selectedTimeStep + 1);
                        }}
                      >
                        &gt;
                      </button>
                    </div>
                  </div>
                  <div className="pt-4 my-2 border-t border-white">
                    <div className="h-3 mb-2 bg-red-200 bg-gradient-to-r from-yellow-500 to-red-500"></div>
                  </div>
                </>
              );
            }}
          />
        </div>
        <div className="border-t border-black h-60">
          <MyResponsiveLine
            // TODO: replace with real pv forecast
            timeOfInterest={timeSteps[selectedTimeStep]}
            data={[
              {
                // PV_GSP_ASL_20210610002152
                // 14010326
                id: "Forecast (NG-ESO)",
                color: "black",
                data: [
                  { x: "00:30", y: 0 },
                  { x: "01:00", y: 0 },
                  { x: "01:30", y: 0 },
                  { x: "02:00", y: 0 },
                  { x: "02:30", y: 0 },
                  { x: "03:00", y: 0 },
                  { x: "03:30", y: 0 },
                  { x: "04:00", y: 0 },
                  { x: "04:30", y: 0 },
                  { x: "05:00", y: 365.44 },
                  { x: "05:30", y: 618.4 },
                  { x: "06:00", y: 933.12 },
                  { x: "06:30", y: 1169.51 },
                  { x: "07:00", y: 1677.84 },
                  { x: "07:30", y: 2484.21 },
                  { x: "08:00", y: 3112.8 },
                  { x: "08:30", y: 3686.4 },
                  { x: "09:00", y: 4272.83 },
                  { x: "09:30", y: 4840.79 },
                  { x: "10:00", y: 5272.84 },
                  { x: "10:30", y: 5643.19 },
                  { x: "11:00", y: 5832.48 },
                  { x: "11:30", y: 5765.5 },
                  { x: "12:00", y: 5746.54 },
                  { x: "12:30", y: 5810.25 },
                  { x: "13:00", y: 5640.4 },
                  { x: "13:30", y: 5144.3 },
                  { x: "14:00", y: 4914.74 },
                  { x: "14:30", y: 4870.64 },
                  { x: "15:00", y: 4595.41 },
                  { x: "15:30", y: 4314.91 },
                  { x: "16:00", y: 3855.1 },
                  { x: "16:30", y: 3448.35 },
                  { x: "17:00", y: 2766.6 },
                  { x: "17:30", y: 1430.14 },
                  { x: "18:00", y: 836.33 },
                  { x: "18:30", y: 816.89 },
                  { x: "19:00", y: 500.42 },
                  { x: "19:30", y: 171.54 },
                  { x: "20:00", y: 33.89 },
                  { x: "20:30", y: 13.53 },
                  { x: "21:00", y: 3.06 },
                  { x: "21:30", y: 0.04 },
                  { x: "22:00", y: 0 },
                  { x: "22:30", y: 0 },
                  { x: "23:00", y: 0 },
                  { x: "23:30", y: 0 },
                ],
              },
              pvLiveGenerationData,
            ]}
          />
        </div>
      </div>
    </Layout>
  );
};

export default Vis1MapPage;
