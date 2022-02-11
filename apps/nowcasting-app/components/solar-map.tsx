interface ISolarMap {
  gspregionData: GeoJsonObject;
  forecastData: object;
}

import { GeoJsonObject } from "geojson";
import { GeoJSON } from "react-leaflet";
import { LeafletMouseEvent } from "leaflet";
import * as d3 from "d3";
import { MapContainer, TileLayer } from "react-leaflet";

const SolarMap = ({ gspregionData, forecastData }: ISolarMap) => {
  // GET THE COLORS FOR THE SHAPES
  const forecastAccessor = (d) =>
    d.forecastValues[0].expectedPowerGenerationMegawatts;
  const colorScale = d3
    .scaleQuantize()
    .domain(d3.extent(forecastData, forecastAccessor))
    .range([
      // '#FFF6DD',
      "#FFF0C8",
      // '#FFE59F',
      "#FFDA77",
      // '#FFCF4E',
      "#FFC425",
      // '#ECAC00',
      "#B48300",
      // '#7C5A00',
      "#443100",
    ]);
  console.log(d3.extent(forecastData, forecastAccessor));
  console.log(colorScale(2000));

  const getForecastColorForGSP = (id) => {
    forecastAccessor(forecastData[id]);
    return colorScale(forecastAccessor(forecastData[id]));
  };

  // other stuff

  const onEachGSP = (feature, layer) => {
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

  const styliseGSP = (feature) => {
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
        onEachFeature={onEachGSP}
        style={styliseGSP}
      />
    </MapContainer>
  );
};

export default SolarMap;
