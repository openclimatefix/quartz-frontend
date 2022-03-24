import { NextPage } from "next";
import dynamic from "next/dynamic";
import { useState } from "react";
import DataAttribution from "../components/data-attribution";
import Layout from "../components/layout";
import Map from "../components/map";
import RemixLine from "../components/charts/remix-line";

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

  const filterBy = (timeStep) => {
    // if (!map.current) return; // wait for map to initialize

    // const filters = ["==", "time", timeStep];
    // map.current.setFilter("pvgeneration-circles", filters);
    setSelectedTimeStep(timeStep);
  };

  return (
    <Layout title="National Forecast vs Actual">
      <div className="w-full h-full bg-mapbox-black">
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
          ]}
        />
        <div className="flex flex-col h-full max-w-6xl pt-24 mx-auto">
          <div className="text-white">
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
                filterBy(timeStep);
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
                      return filterBy(timeSteps.length - 1);
                    }
                    filterBy(selectedTimeStep - 1);
                  }}
                >
                  &lt;
                </button>
                <button
                  className="px-2 py-1 border-2 border-white select-none"
                  onClick={() => {
                    // Incrememnt timeStep or go back to 0
                    if (selectedTimeStep === timeSteps.length - 1) {
                      return filterBy(0);
                    }
                    filterBy(selectedTimeStep + 1);
                  }}
                >
                  &gt;
                </button>
              </div>
            </div>
          </div>
          <div className="mt-24 border-t border-white h-96">
            <RemixLine
              timeOfInterest={timeSteps[selectedTimeStep]}
              timeSteps={timeSteps}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Vis1MapPage;
