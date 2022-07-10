import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";
import useUpdateMapStateOnClick from "./use-update-map-state-on-click";

mapboxgl.accessToken =
  "pk.eyJ1IjoiZmxvd2lydHoiLCJhIjoiY2tlcGhtMnFnMWRzajJ2bzhmdGs5ZXVveSJ9.Dq5iSpi54SaajfdMyM_8fQ";

interface IMap {
  loadDataOverlay: any;
  controlOverlay: any;
  bearing?: number;
  updateData: { newData: boolean; updateMapData: (map: mapboxgl.Map) => void };
}

/**
 * Mapbox wrapper.
 * @param loadDataOverlay Function that gets called to load the data.
 * @param controlOverlay Can pass additional JSX components to render on top of the map.
 * @param bearing Rotation of the map. Defaults to 0 degrees
 */
const Map = ({ loadDataOverlay, controlOverlay, bearing = 0, updateData }: IMap) => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map>();
  const [isMapReady, setIsMapReady] = useState(false);
  const [isSourceLoaded, setIsSourceLoaded] = useState(false);
  const [lng, setLng] = useState(-2.3175601);
  const [lat, setLat] = useState(54.70534432);
  const [zoom, setZoom] = useState(5);

  useUpdateMapStateOnClick({ map: map.current, isMapReady });
  useEffect(() => {
    if (map.current && updateData.newData) {
      updateData.updateMapData(map.current);
    }
  }, [updateData]);

  useEffect(() => {
    if (map.current) return; // initialize map only once
    if (mapContainer.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v10",
        center: [lng, lat],
        zoom,
        bearing,
        keyboard: false,
      });

      const nav = new mapboxgl.NavigationControl({ showCompass: false });
      map.current.addControl(nav, "bottom-right");
      map.current.on("load", () => setIsMapReady(true));
    }
  }, []);

  useEffect(() => {
    if (!map.current) return; // wait for map to initialize

    map.current.on("move", () => {
      setLng(Number(map.current?.getCenter().lng.toFixed(4)));
      setLat(Number(map.current?.getCenter().lat.toFixed(4)));
      setZoom(Number(map.current?.getZoom().toFixed(2)));
    });
    map.current.on("sourcedata", (e) => {
      if (e.sourceId === "latestPV" && e.sourceCacheId === "other:latestPV") {
        setIsSourceLoaded(e.isSourceLoaded && (e.source as any).data);
      }
    });
  }, [map]);

  useEffect(() => {
    if (loadDataOverlay && map.current)
      map.current.on("load", (event) => {
        loadDataOverlay(map);
      });
  }, [loadDataOverlay]);

  return (
    <div className="relative h-full bg-mapbox-black-500">
      {isSourceLoaded && <span data-e2e="map-loaded"></span>}
      <div className="absolute top-0 left-0 z-10 p-6 min-w-[20rem] w-full">
        {controlOverlay(map)}
      </div>
      <div ref={mapContainer} className="h-full" />
      <div className="map-overlay top"></div>
    </div>
  );
};

export default Map;
