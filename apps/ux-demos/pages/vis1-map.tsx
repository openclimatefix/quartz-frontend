import { NextPage } from "next";
import { useRouter } from "next/router";
import { useState } from "react";
import RemixLine from "../components/charts/remix-line";
import DataAttribution from "../components/data-attribution";
import Layout from "../components/layout";
import Map from "../components/map";
import useSWR from "swr";

const PV_GENERATION_MIN = 0;
const PV_GENERATION_MAX = 3000;

const Vis1MapPage: NextPage = () => {
  const INITIAL_TIME_STEP = 23;
  const [selectedTimeStep, setSelectedTimeStep] = useState(INITIAL_TIME_STEP);

  // Add support for dynamic data
  const router = useRouter();
  const date = router.query.date || "2021-06-10";
  const bearing = router.query.noRotate ? 0 : 90;

  //@ts-ignore
  const fetcher = (...args) => fetch(...args).then((res) => res.json());
  const { data: generationForecastData, error } = useSWR(
    `/api/generation-forecast?date=${date}`,
    fetcher
  );
  const { data: pvMapData, error: error2 } = useSWR(
    `/api/generation-passiv?date=${date}`,
    fetcher
  );

  if (error || error2) return <div>failed to load</div>;
  if (!generationForecastData || !pvMapData) return <div>loading...</div>;

  // Continue as normal below

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
        "circle-color": "#eab308",
        "circle-opacity": [
          "interpolate",
          ["linear"],
          ["get", "solarGeneration"],
          PV_GENERATION_MIN,
          0,
          PV_GENERATION_MAX,
          0.75,
        ],
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
            bearing={bearing}
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
                    <div className="h-3 mb-2 bg-gradient-to-r from-transparent to-yellow-500"></div>
                  </div>
                </>
              );
            }}
          />
        </div>
        <div className="border-t border-black h-60 bg-mapbox-black">
          <RemixLine
            timeOfInterest={timeSteps[selectedTimeStep]}
            timeSteps={timeSteps}
            data={generationForecastData}
          />
        </div>
      </div>
    </Layout>
  );
};

export default Vis1MapPage;
