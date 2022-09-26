interface ISolarMap {
  mapHeight?: string;
  circles?: boolean;
}

// import React, { useRef } from "react";

import { GeoJsonObject } from "geojson";
import { Circle, GeoJSON } from "react-leaflet";
import { LeafletMouseEvent, GeoJSON as LeafletGeoJSON } from "leaflet";
import * as d3 from "d3";
import { MapContainer, TileLayer } from "react-leaflet";

// import {
//   getForecastAccessorForTimeHorizon,
//   allForecastsAccessor,
//   getTimeFromDate,
// } from "./utils";

import { useEffect, useRef } from "react";

import gspRegionData from "../data/gspRegions.json";
import forecastDataGSP from "../data/gspError.json";

const SHADES_OF_YELLOW = {
  DEFAULT: "#FFC425",
  "50": "#FFF6DD",
  "100": "#FFF0C8",
  "200": "#FFE59F",
  "300": "#FFDA77",
  "400": "#FFCF4E",
  "500": "#FFC425",
  "600": "#ECAC00",
  "700": "#B48300",
  "800": "#7C5A00",
  "900": "#443100",
};

const SolarMap = ({
  mapHeight = "calc(100vh - 2rem - 1rem)",
  circles = false,
}: ISolarMap) => {
  const getForecastDataByGSPId = (gspId) => forecastDataGSP[gspId - 1];
  const getForecastColorForGSP = (id) => {
    const colorScale = d3.scaleQuantize().domain([10, 1000]).range([
      // SHADES_OF_YELLOW["100"],
      SHADES_OF_YELLOW["300"],
      // SHADES_OF_YELLOW["500"],
      SHADES_OF_YELLOW["700"],
      // SHADES_OF_YELLOW["900"],
    ]);

    return colorScale(getForecastDataByGSPId(getForecastDataByGSPId(id)));
  };

  const addColorToEachGSP = (feature) => {
    return {
      fillColor: getForecastColorForGSP(feature.properties.gsp_id),
      // fillColor: "red",
      fillOpacity: 1,
      color: "white",
      weight: 1,
    };
  };

  const BBOX = {
    xMin: -5.181921848720619,
    xMax: 0.6515741240632,
    yMin: 50.69113131422758,
    yMax: 58.77665632199607,
  };

  // const getRandomGPSCoordsInGB = () => {
  const randomCoords = [];
  for (let step = 0; step < 500; step++) {
    randomCoords.push([
      Math.random() * (BBOX.yMax - BBOX.yMin + 1) + BBOX.yMin,
      Math.random() * (BBOX.xMax - BBOX.xMin + 1) + BBOX.xMin,
    ]);
  }
  // };
  // const  = ;

  return (
    <div className="h-full bg-yellow-600">
      <MapContainer
        center={[55.00366, -2.547855]}
        zoom={5.5}
        scrollWheelZoom={false}
        style={{ height: mapHeight }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {circles ? (
          randomCoords.map((coord, i) => (
            <Circle
              key={i}
              center={coord}
              pathOptions={{ fillColor: "blue" }}
              radius={10000}
            />
          ))
        ) : (
          <GeoJSON
            // ref={geoJsonLayerRef}
            // @ts-ignore
            data={gspRegionData}
            // onEachFeature={addPopupToEachGSP}
            style={addColorToEachGSP}
          />
        )}
      </MapContainer>
    </div>
  );
};

export default SolarMap;
