import mapboxgl, { Expression } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Dispatch, FC, SetStateAction, useEffect, useRef, useState } from "react";
import { IMap } from "./types";
import useUpdateMapStateOnClick from "./use-update-map-state-on-click";
import useGlobalState from "../helpers/globalState";
import {
  AGGREGATION_LEVEL_MIN_ZOOM,
  AGGREGATION_LEVELS,
  MAX_POWER_GENERATED
} from "../../constant";

mapboxgl.accessToken =
  "pk.eyJ1IjoiZmxvd2lydHoiLCJhIjoiY2tlcGhtMnFnMWRzajJ2bzhmdGs5ZXVveSJ9.Dq5iSpi54SaajfdMyM_8fQ";

const setAggregationLevelByCurrentZoom = (
  currentZoom: number,
  autoZoom: boolean,
  setAggregation: Dispatch<SetStateAction<AGGREGATION_LEVELS>>
) => {
  if (currentZoom && autoZoom) {
    if (currentZoom < AGGREGATION_LEVEL_MIN_ZOOM.REGION) {
      console.log("setting aggregation to national");
      setAggregation(AGGREGATION_LEVELS.NATIONAL);
    } else if (currentZoom < AGGREGATION_LEVEL_MIN_ZOOM.GSP) {
      console.log("setting aggregation to region");
      setAggregation(AGGREGATION_LEVELS.REGION);
    } else if (currentZoom < AGGREGATION_LEVEL_MIN_ZOOM.SITE) {
      console.log("setting aggregation to gsp");
      setAggregation(AGGREGATION_LEVELS.GSP);
    } else {
      console.log("setting aggregation to site");
      setAggregation(AGGREGATION_LEVELS.SITE);
    }
  }
};

/**
 * Mapbox wrapper.
 * @param loadDataOverlay Function that gets called to load the data.
 * @param controlOverlay Can pass additional JSX components to render on top of the map.
 * @param bearing Rotation of the map. Defaults to 0 degrees
 * @param updateData Object with a boolean to indicate whether to update the map data and a function to update the map data.
 * @param children Children to render on top of the map.
 * @param title Title of the map.
 */
const Map: FC<IMap> = ({
  loadDataOverlay,
  controlOverlay,
  bearing = 0,
  updateData,
  children,
  title
}) => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map>();
  const [isMapReady, setIsMapReady] = useState(false);
  const [lng, setLng] = useGlobalState("lng");
  const [lat, setLat] = useGlobalState("lat");
  const [zoom, setZoom] = useGlobalState("zoom");
  const [maps, setMaps] = useGlobalState("maps");
  const [currentAggregation, setAggregation] = useGlobalState("aggregationLevel");
  const [autoZoom] = useGlobalState("autoZoom");

  // Keep the latest autoZoom value available inside Mapbox event handlers (avoid stale closures)
  const autozoomRef = useRef(autoZoom);
  useEffect(() => {
    autozoomRef.current = autoZoom;
    const currentZoom = map.current?.getZoom() || 0;
    setAggregationLevelByCurrentZoom(currentZoom, autozoomRef.current, setAggregation);
  }, [autoZoom]);

  useUpdateMapStateOnClick({ map: map.current, isMapReady });
  useEffect(() => {
    if (map.current && updateData.newData) {
      updateData.updateMapData(map.current);
    }
  }, [updateData]);

  useEffect(() => {
    const onMoveEnd = () => {
      console.log("setting map state");
      const currentZoom = map.current?.getZoom() || 0;
      const center = map.current?.getCenter();

      setLng(Number(center?.lng.toFixed(4)));
      setLat(Number(center?.lat.toFixed(4)));
      setZoom(Number(currentZoom.toFixed(2)));

      setAggregationLevelByCurrentZoom(currentZoom, autozoomRef.current, setAggregation);
    };

    if (map.current) return; // initialize map only once
    const isCypressEnv = window.Cypress !== undefined;
    if (mapContainer.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v10",
        center: [lng, lat],
        boxZoom: false,
        zoom,
        bearing,
        keyboard: false,
        preserveDrawingBuffer: isCypressEnv // Only set this in E2E tests to allow canvas rendering
      });
      // Updater function to prevent state updates overriding each other in race condition on load
      setMaps((m) => [...m, map.current!]);

      const nav = new mapboxgl.NavigationControl({ showCompass: false });
      map.current.addControl(nav, "bottom-right");

      map.current.on("load", (event) => {
        setIsMapReady(true);
        if (map.current?.getCanvas()?.width === 800) {
          map.current?.resize();
        }
        loadDataOverlay(map);
      });

      map.current.on("dataloading", () => {
        if (map.current?.getCanvas()?.width === 400) {
          map.current?.resize();
        }
      });

      map.current.on("moveend", onMoveEnd);
    }
    // TODO: unsure as to whether react cleans up/ends up with multiple maps when re-rendering
    // or whether removing will cause more issues elsewhere in the app.
    // Will just keep an eye on performance etc. for now.
    //
    // Clean up moveend listener
    return () => {
      if (map.current) {
        map.current.off("moveend", onMoveEnd);
      }
    };
  }, []);

  return (
    <div className="relative h-full overflow-hidden bg-ocf-gray-900">
      <div className="absolute top-0 left-0 z-10 p-4 min-w-[20rem] w-full">
        {controlOverlay(map)}
      </div>
      <div ref={mapContainer} id={`Map-${title}`} data-title={title} className="h-full w-full" />
      <div className="map-overlay top">{children}</div>
    </div>
  );
};

export default Map;
