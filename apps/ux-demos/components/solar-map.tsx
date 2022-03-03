interface ISolarMap {
  gspregionData: GeoJsonObject;
  forecastDataGSP: object;
  forecastDataNational: object;
  selectedTimeHorizon: number;
  showGSPForecast: boolean;
}

// import React, { useRef } from "react";

import { GeoJsonObject } from "geojson";
import { GeoJSON } from "react-leaflet";
import { LeafletMouseEvent, GeoJSON as LeafletGeoJSON } from "leaflet";
import * as d3 from "d3";
import { MapContainer, TileLayer } from "react-leaflet";

import {
  getForecastAccessorForTimeHorizon,
  allForecastsAccessor,
  getTimeFromDate,
} from "./utils";

import { useEffect, useRef } from "react";

import gspRegionData from "../data/gspRegions.json";

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
  // gspregionData,
  forecastDataGSP,
  forecastDataNational,
  selectedTimeHorizon,
}: ISolarMap) => {
  const getForecastDataByGSPId = (gspId) => forecastDataGSP[gspId - 1];
  const forecastAccessor =
    getForecastAccessorForTimeHorizon(selectedTimeHorizon);
  const getForecastColorForGSP = (id) => {
    const colorScale = d3
      .scaleQuantize()
      .domain(d3.extent(forecastDataGSP, forecastAccessor))
      .range([
        SHADES_OF_YELLOW["100"],
        SHADES_OF_YELLOW["300"],
        SHADES_OF_YELLOW["500"],
        SHADES_OF_YELLOW["700"],
        SHADES_OF_YELLOW["900"],
      ]);

    return colorScale(forecastAccessor(getForecastDataByGSPId(id)));
  };

  const generateTableRow = ({
    targetTime,
    expectedPowerGenerationMegawatts,
  }) => {
    return `
        <tr>
          <td class="border border-slate-400 p-1">${getTimeFromDate(
            new Date(targetTime)
          )}</td>
          <td class="border border-slate-400 p-1">${
            Math.round(expectedPowerGenerationMegawatts * 100) / 100
          } MW</td>
        </tr>
      `;
  };

  const addPopupToEachGSP = (feature, layer) => {
    const {
      gsp_id: gspId,
      region_name: regionName,
      gsp_name: gspName,
    } = feature.properties || {};

    const isGSPForecast = feature.type !== "GeometryCollection";

    const allForecasts = allForecastsAccessor(
      isGSPForecast ? getForecastDataByGSPId(gspId) : forecastDataNational
    );

    layer.on("mouseover", function (e: LeafletMouseEvent) {
      layer
        .bindPopup(
          `
          <h2 class="text-xl font-bold">${
            isGSPForecast ? regionName : "National-GB"
          }${isGSPForecast ? ` (${gspName})` : ""}</h2>

          <table class="text-base table-auto border border-slate-400 mt-4">
              <tr>
                <th class="border border-slate-400 p-1">Target Time</th>
                <th class="border border-slate-400 p-1">Expected Power Generation</th>
              </tr>
              ${generateTableRow(allForecasts[0])}
              ${generateTableRow(allForecasts[1])}
              ${generateTableRow(allForecasts[2])}
          </table>
        `
        )
        .openPopup();
    });
  };

  const addColorToEachGSP = (feature) => {
    return {
      // fillColor: getForecastColorForGSP(feature.properties.gsp_id),
      fillColor: "red",
      fillOpacity: 1,
      color: "white",
      weight: 1,
    };
  };

  return (
    <div className="h-full bg-yellow-600">
      <MapContainer
        center={[55.00366, -2.547855]}
        zoom={5.5}
        scrollWheelZoom={false}
        style={{ height: "calc(100vh - 2rem - 1rem)" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <GeoJSON
          // ref={geoJsonLayerRef}
          data={gspRegionData}
          // onEachFeature={addPopupToEachGSP}
          style={addColorToEachGSP}
        />
      </MapContainer>
    </div>
  );
};

export default SolarMap;
