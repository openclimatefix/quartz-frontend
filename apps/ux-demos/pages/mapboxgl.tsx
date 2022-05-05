import { NextPage } from "next";
import React, { useState } from "react";
import Map from "../components/map";

import fakeMapData from "../data/fake-map.json";

const PV_MIN = 0;
const PV_MAX = 100;

const MapboxPage: NextPage = () => {
  const [selectedTimeStep, setSelectedTimeStep] = useState(0);

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

    const filters = ["==", "timeStep", timeStep];
    map.current.setFilter("pvgeneration-circles", filters);
  };

  const addPVData = (map) => {
    map.current.addSource("pvgeneration", {
      type: "geojson",
      data: fakeMapData,
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
          PV_MIN,
          "#eab308",
          PV_MAX,
          "#ef4444",
        ],
        "circle-opacity": 0.75,
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["get", "solarGeneration"],
          PV_MIN,
          0,
          PV_MAX,
          30,
        ],
      },
    });

    filterBy(map, 0);
  };

  return (
    <div className="h-[80vh]">
      <Map
        loadDataOverlay={addPVData}
        controlOverlay={(map) => {
          return (
            <div className="pt-2 mt-2 border-t border-white">
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
                  setSelectedTimeStep(timeStep);
                }}
              />
              <div>
                Time: <span>{timeSteps[selectedTimeStep]}</span>
              </div>
            </div>
          );
        }}
      />
    </div>
  );
};

export default MapboxPage;
