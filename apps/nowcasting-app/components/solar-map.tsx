interface ISolarMap {
  gspregionData: GeoJsonObject;
  forecastData: object;
}

import { GeoJsonObject } from "geojson";
import { GeoJSON } from "react-leaflet";
import { LeafletMouseEvent } from "leaflet";
import * as d3 from "d3";
import { MapContainer, TileLayer } from "react-leaflet";
import { forecastAccessor } from "./utils";

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

const SolarMap = ({ gspregionData, forecastData }: ISolarMap) => {
  const getForecastColorForGSP = (id) => {
    const colorScale = d3
      .scaleQuantize()
      .domain(d3.extent(forecastData, forecastAccessor))
      .range([
        SHADES_OF_YELLOW["100"],
        SHADES_OF_YELLOW["300"],
        SHADES_OF_YELLOW["500"],
        SHADES_OF_YELLOW["700"],
        SHADES_OF_YELLOW["900"],
      ]);

    return colorScale(forecastAccessor(forecastData[id]));
  };

  const addPopupToEachGSP = (feature, layer) => {
    const {
      gsp_id,
      region_name: regionName,
      gsp_name: gspName,
    } = feature.properties;
    layer.on("mouseover", function (e: LeafletMouseEvent) {
      layer
        .bindPopup(
          `${regionName} (${gspName}) will produce ${forecastAccessor(
            forecastData[gsp_id]
          )}MW`
        )
        .openPopup();
    });
  };

  const addColorToEachGSP = (feature) => {
    return {
      fillColor: getForecastColorForGSP(feature.properties.gsp_id),
      fillOpacity: 1,
      color: "white",
      weight: 1,
    };
  };

  return (
    <MapContainer
      center={[55.00366, -2.547855]}
      zoom={5.5}
      scrollWheelZoom={false}
      className="h-[52rem]"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <GeoJSON
        data={gspregionData}
        onEachFeature={addPopupToEachGSP}
        style={addColorToEachGSP}
      />
    </MapContainer>
  );
};

export default SolarMap;
