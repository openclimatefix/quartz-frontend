interface ISolarMap {
  data: GeoJsonObject;
}

import { GeoJsonObject } from "geojson";
import { LatLng } from "leaflet";
import { useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";

const SolarMap = ({ data }: ISolarMap) => {
  console.log(data);
  const [mousePosition, setMousePosition] = useState<LatLng>();

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
      <GeoJSON
        attribution=""
        data={data}
        eventHandlers={{
          mousemove: ({ latlng }) => {
            console.log("hovered");
            console.log(latlng);
            setMousePosition(latlng);
          },
        }}
      ></GeoJSON>
    </MapContainer>
  );
};

export default SolarMap;
