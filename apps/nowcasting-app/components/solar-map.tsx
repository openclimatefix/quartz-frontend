interface ISolarMap {
  data: GeoJsonObject;
}

import { GeoJsonObject } from "geojson";
import { LeafletMouseEvent } from "leaflet";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";

const SolarMap = ({ data }: ISolarMap) => {
  const onEachGSP = (feature, layer) => {
    const { region_name: regionName, gsp_name: gspName } = feature.properties;
    layer.on("mouseover", function (e: LeafletMouseEvent) {
      layer.bindPopup(`${regionName} (${gspName})`).openPopup();
    });
  };

  return (
    <MapContainer
      center={[55.00366, -2.547855]}
      zoom={6}
      scrollWheelZoom={false}
      style={{ height: "48rem" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <GeoJSON data={data} onEachFeature={onEachGSP}></GeoJSON>
    </MapContainer>
  );
};

export default SolarMap;
