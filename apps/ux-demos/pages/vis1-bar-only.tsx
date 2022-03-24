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
            <MyResponsiveLine
              // TODO: replace with real pv forecast
              timeOfInterest={timeSteps[selectedTimeStep]}
              timeSteps={timeSteps}
              hideAfterTOI={true}
              data={[
                {
                  // PV_GSP_ASL_20210610002152
                  // 14010326
                  id: "Forecast (NG-ESO)",
                  color: "black",
                  data: [
                    { x: "03:30", y: 1 },
                    { x: "04:00", y: 42 },
                    { x: "04:30", y: 95 },
                    { x: "05:00", y: 202 },
                    { x: "05:30", y: 372 },
                    { x: "06:00", y: 549 },
                    { x: "06:30", y: 811 },
                    { x: "07:00", y: 1356 },
                    { x: "07:30", y: 1791 },
                    { x: "08:00", y: 2292 },
                    { x: "08:30", y: 2903 },
                    { x: "09:00", y: 3566 },
                    { x: "09:30", y: 4238 },
                    { x: "10:00", y: 4678 },
                    { x: "10:30", y: 5198 },
                    { x: "11:00", y: 4904 },
                    { x: "11:30", y: 5118 },
                    { x: "12:00", y: 4400 },
                    { x: "12:30", y: 4253 },
                    { x: "13:00", y: 3685 },
                    { x: "13:30", y: 3682 },
                    { x: "14:00", y: 4404 },
                    { x: "14:30", y: 3959 },
                    { x: "15:00", y: 3452 },
                    { x: "15:30", y: 3116 },
                    { x: "16:00", y: 2952 },
                    { x: "16:30", y: 2483 },
                    { x: "17:00", y: 1835 },
                    { x: "17:30", y: 1341 },
                    { x: "18:00", y: 997 },
                    { x: "18:30", y: 641 },
                    { x: "19:00", y: 392 },
                    { x: "19:30", y: 211 },
                    { x: "20:00", y: 114 },
                    { x: "20:30", y: 15 },
                    { x: "21:00", y: 0 },
                    { x: "21:30", y: 0 },
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
