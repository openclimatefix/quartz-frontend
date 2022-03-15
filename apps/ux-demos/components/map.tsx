interface IMap {
  loadDataOverlay: any;
  controlOverlay: any;
}

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";

mapboxgl.accessToken =
  "pk.eyJ1IjoiZmxvd2lydHoiLCJhIjoiY2tlcGhtMnFnMWRzajJ2bzhmdGs5ZXVveSJ9.Dq5iSpi54SaajfdMyM_8fQ";

const Map = ({ loadDataOverlay, controlOverlay }: IMap) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng, setLng] = useState(-2.547855);
  const [lat, setLat] = useState(55.00366);
  const [zoom, setZoom] = useState(5.3);

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
      loadDataOverlay(map);
    });
  });

  return (
    <div className="relative h-full">
      <div className="absolute top-0 left-0 z-10 px-2 py-3 m-3 font-mono text-white bg-gray-600 rounded">
        <div>
          Longitude: {lng} | Latitude: {lat} | Zoom: {zoom}
        </div>
        {controlOverlay(map)}
        <div className="pt-4 my-2 border-t border-white">
          <div className="h-3 mb-2 bg-red-200 bg-gradient-to-r from-yellow-500 to-red-500"></div>
        </div>
      </div>
      <div ref={mapContainer} className="h-full" />
      <div className="map-overlay top"></div>
    </div>
  );
};

export default Map;
