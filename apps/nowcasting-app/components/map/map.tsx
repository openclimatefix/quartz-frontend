interface IMap {
  loadDataOverlay: any;
  controlOverlay: any;
  updateFCData?: any;
  bearing?: number;
}

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";

mapboxgl.accessToken =
  "pk.eyJ1IjoiZmxvd2lydHoiLCJhIjoiY2tlcGhtMnFnMWRzajJ2bzhmdGs5ZXVveSJ9.Dq5iSpi54SaajfdMyM_8fQ";

/**
 * Mapbox wrapper.
 * @param loadDataOverlay Function that gets called to load the data.
 * @param controlOverlay Can pass additional JSX components to render on top of the map.
 * @param bearing Rotation of the map. Defaults to 0 degrees
 */
const Map = ({ loadDataOverlay, controlOverlay, updateFCData, bearing = 0 }: IMap) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng, setLng] = useState(-2.31756010);
  const [lat, setLat] = useState(54.70534432);
  const [zoom, setZoom] = useState(5);

  useEffect(() => {
    if (map.current) return; // initialize map only once

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v10",
      center: [lng, lat],
      zoom,
      bearing,
    });

    const nav = new mapboxgl.NavigationControl({showCompass: false})
    map.current.addControl(nav, 'bottom-right');
  }, []);

  useEffect(() => {
    if (!map.current) return; // wait for map to initialize

    map.current.on("move", () => {
      setLng(map.current.getCenter().lng.toFixed(4));
      setLat(map.current.getCenter().lat.toFixed(4));
      setZoom(map.current.getZoom().toFixed(2));
    });

    map.current.on("load", (event) => {
      loadDataOverlay(map);
    });

    // Indecated that data source updates every
    map.current.on("sourcedata", (event) => {
      if(event.isSourceLoaded && event.sourceCacheId && event.source.data){
        console.log('A data event occurred.', event.source.data.features);
      }
    });

  }, [map]);

  return (
    <div className="relative h-full">
      <div className="absolute top-0 left-0 z-10 px-2 py-3 m-3 min-w-[20rem]">
        {controlOverlay(map)}
      </div>
      <div ref={mapContainer} className="h-full" />
      <div className="map-overlay top"></div>
    </div>
  );
};

export default Map;
