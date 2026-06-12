import mapboxgl, { Expression } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Dispatch, FC, SetStateAction, useEffect, useRef, useState } from "react";
import { IMap } from "./types";
import useUpdateMapStateOnClick from "./use-update-map-state-on-click";
import useGlobalState from "../helpers/globalState";
import { ResetIcon } from "../icons/icons";
import {
  AGGREGATION_LEVEL_MIN_ZOOM,
  AGGREGATION_LEVELS,
  MAX_POWER_GENERATED,
  VIEWS
} from "../../constant";
import {
  SATELLITE_CHANNELS,
  SatelliteChannel,
  TifLayerData,
  fetchAndDecodeSatelliteTif,
  applyTifLayerToMap,
  setSatelliteLayerVisibility
} from "../helpers/satelliteLayer";
import { addMinutesToISODate } from "../helpers/utils";

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
  const resetButtonDiv = useRef<HTMLDivElement | null>(null);
  const [selectedISOTime] = useGlobalState("selectedISOTime");
  const [showCloudLayer, setShowCloudLayer] = useGlobalState("showCloudLayer");
  const [activeChannel, setActiveChannel] = useGlobalState("activeChannel");
  const showCloudRef = useRef(showCloudLayer);
  const channelRef = useRef(activeChannel);
  const tifCache = useRef<globalThis.Map<string, TifLayerData>>(new globalThis.Map());
  const currentKeyRef = useRef<string | null>(null);
  const [isSatelliteLoading, setIsSatelliteLoading] = useState(false);

  const SAT_LAYER_ID = "satellite-layer";
  const SAT_SOURCE_ID = "satellite-source";

  useEffect(() => {
    showCloudRef.current = showCloudLayer;
    if (!map.current) return;
    setSatelliteLayerVisibility(map.current, showCloudLayer, SAT_LAYER_ID);
  }, [showCloudLayer]);

  useEffect(() => {
    channelRef.current = activeChannel;
    currentKeyRef.current = null;
    if (isMapReady && selectedISOTime) {
      applyForTimestamp(activeChannel, selectedISOTime);
    }
  }, [activeChannel, isMapReady]);

  const satCacheKey = (ch: SatelliteChannel, ts: string) => `${ch}__${ts}`;

  const fetchIntoCache = async (ch: SatelliteChannel, ts: string): Promise<TifLayerData | null> => {
    const key = satCacheKey(ch, ts);
    if (tifCache.current.has(key)) return tifCache.current.get(key)!;
    const data = await fetchAndDecodeSatelliteTif(ch, ts);
    if (data) tifCache.current.set(key, data);
    return data;
  };

  const applyForTimestamp = async (ch: SatelliteChannel, ts: string) => {
    if (!map.current || !showCloudRef.current) return;
    const key = satCacheKey(ch, ts);
    if (currentKeyRef.current === key) return;
    setIsSatelliteLoading(true);
    try {
      const data = await fetchIntoCache(ch, ts);
      if (!map.current) return;
      currentKeyRef.current = key;
      applyTifLayerToMap(map.current, data, SAT_LAYER_ID, SAT_SOURCE_ID, showCloudRef.current);
    } finally {
      setIsSatelliteLoading(false);
    }
  };

  useEffect(() => {
    if (!showCloudLayer || !isMapReady || !selectedISOTime) return;
    applyForTimestamp(activeChannel, selectedISOTime);
    for (let offset = -3; offset <= 3; offset++) {
      if (offset === 0) continue;
      const ts = addMinutesToISODate(selectedISOTime, offset * 30);
      fetchIntoCache(activeChannel, ts).catch(() => {});
    }
  }, [selectedISOTime, activeChannel, showCloudLayer, isMapReady]);

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
    if (process.env.NEXT_PUBLIC_CI === "true") return;

    const onMoveEnd = () => {
      console.log("setting map state");
      const currentZoom = map.current?.getZoom() || 0;
      const center = map.current?.getCenter();

      setLng(Number(center?.lng.toFixed(4)));
      setLat(Number(center?.lat.toFixed(4)));
      setZoom(Number(currentZoom.toFixed(2)));

      setAggregationLevelByCurrentZoom(currentZoom, autozoomRef.current, setAggregation);

      // Check if map has been modified from default state
      const mapModified =
        currentZoom !== zoom || // Check if zoom has changed
        center?.lng.toFixed(4) !== lng.toFixed(4) || // Check if longitude has changed
        center?.lat.toFixed(4) !== lat.toFixed(4); // Check if latitude has changed

      if (mapModified) {
        resetButtonDiv.current?.style.setProperty("display", "block");
      }
    };

    if (map.current) return; // initialize map only once
    if (mapContainer.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v10",
        center: [lng, lat],
        boxZoom: false,
        zoom,
        bearing: 0,
        pitch: 0,
        dragRotate: false,
        touchPitch: false,
        keyboard: false
      });
      // Updater function to prevent state updates overriding each other in race condition on load
      setMaps((m) => [...m, map.current!]);

      const nav = new mapboxgl.NavigationControl({ showCompass: false });
      map.current.addControl(nav, "bottom-right");
      map.current.addControl(
        {
          onAdd: function (m) {
            const div = document.createElement("div");
            div.className = "mapboxgl-ctrl mapboxgl-ctrl-group";
            div.style.setProperty("display", "none");
            div.innerHTML = `<button title="Reset Zoom" style="padding:7px;">${ResetIcon()}</button>`;
            div.onclick = () => {
              m.flyTo({
                center: [lng, lat],
                zoom: zoom,
                pitch: 0,
                bearing: 0,
                duration: 1500,
                essential: true
              });
              div.style.setProperty("display", "none");
            };
            resetButtonDiv.current = div;
            return div;
          },
          onRemove: function () {}
        },
        "bottom-right"
      );

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
      <div className="absolute top-0 left-0 z-10 p-4 min-w-[20rem] w-full flex flex-col gap-1 pointer-events-none">
        <div className="pointer-events-auto">{controlOverlay(map)}</div>
        <div
          className={`pointer-events-auto flex flex-row items-center justify-end gap-2 transition-all duration-300 ${
            title === VIEWS.SOLAR_SITES ? "mt-[240px]" : "mt-3"
          }`}
        >
          {showCloudLayer && (
            <select
              value={activeChannel}
              onChange={(e) => setActiveChannel(e.target.value as SatelliteChannel)}
              className="w-24 bg-black text-white text-xs font-semibold py-1 px-1.5 border border-gray-600 outline-none cursor-pointer focus:border-ocf-yellow"
            >
              {SATELLITE_CHANNELS.map((ch) => (
                <option key={ch} value={ch}>
                  {ch}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => setShowCloudLayer((c) => !c)}
            className={`relative inline-flex items-center px-3 py-0.5 text-sm dash:text-lg dash:tracking-wide font-extrabold hover:bg-ocf-yellow hover:text-mapbox-black-700 border border-gray-600 transition-all active:scale-95 ${
              showCloudLayer ? "text-black bg-ocf-yellow" : "text-white bg-black"
            }`}
          >
            {isSatelliteLoading && (
              <svg
                className="animate-spin -ml-1 mr-1.5 h-3.5 w-3.5 text-current"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            )}
            Clouds
          </button>
        </div>
      </div>

      <div ref={mapContainer} id={`Map-${title}`} data-title={title} className="h-full w-full" />
      <div className="map-overlay top">{children}</div>
    </div>
  );
};

export default Map;
