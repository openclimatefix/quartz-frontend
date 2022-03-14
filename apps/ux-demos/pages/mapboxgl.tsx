import { NextPage } from "next";
import React, { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import fakeMapData from "../data/fake-map.json";

mapboxgl.accessToken =
  "pk.eyJ1IjoiZmxvd2lydHoiLCJhIjoiY2tlcGhtMnFnMWRzajJ2bzhmdGs5ZXVveSJ9.Dq5iSpi54SaajfdMyM_8fQ";

const PV_MIN = 0;
const PV_MAX = 100;

const MapboxPage: NextPage = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng, setLng] = useState(-2.547855);
  const [lat, setLat] = useState(55.00366);
  const [zoom, setZoom] = useState(5.5);

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

  useEffect(() => {
    if (map.current) return; // initialize map only once

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v10",
      center: [lng, lat],
      zoom: zoom,
    });
  });

  useEffect(() => {
    if (!map.current) return; // wait for map to initialize

    map.current.on("move", () => {
      setLng(map.current.getCenter().lng.toFixed(4));
      setLat(map.current.getCenter().lat.toFixed(4));
      setZoom(map.current.getZoom().toFixed(2));
    });

    map.current.on("load", () => {
      addPVData();
    });
  });

  const filterBy = (timeStep) => {
    if (!map.current) return; // wait for map to initialize

    const filters = ["==", "timeStep", timeStep];
    map.current.setFilter("pvgeneration-circles", filters);
    // map.current.setFilter("pvgeneration-labels", filters);
  };

  const addPVData = () => {
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

    // map.current.addLayer({
    //   id: "pvgeneration-labels",
    //   type: "symbol",
    //   source: "pvgeneration",
    //   layout: {
    //     "text-field": ["concat", ["to-string", ["get", "mag"]], "m"],
    //     "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
    //     "text-size": 12,
    //   },
    //   paint: {
    //     "text-color": "rgba(0,0,0,0.5)",
    //   },
    // });

    // Set filter to first month of the year
    // 0 = January
    filterBy(0);
  };

  return (
    <div className="relative h-screen">
      <div className="absolute top-0 left-0 z-10 px-2 py-3 m-3 font-mono text-white bg-gray-600 rounded">
        <div>
          Longitude: {lng} | Latitude: {lat} | Zoom: {zoom}
        </div>
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
              filterBy(timeStep);
              setSelectedTimeStep(timeStep);
            }}
          />
          <div>
            Time: <span>{timeSteps[selectedTimeStep]}</span>
          </div>
        </div>
        <div className="pt-4 my-2 border-t border-white">
          <div className="h-3 max-w-xs mb-2 bg-red-200 bg-gradient-to-r from-yellow-500 to-red-500"></div>
          {/* <div>Magnitude (m)</div> */}
        </div>
      </div>
      <div ref={mapContainer} className="h-full" />
      <div className="map-overlay top"></div>
    </div>
  );
};

export default MapboxPage;
