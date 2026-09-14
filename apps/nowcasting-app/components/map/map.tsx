import mapboxgl, { Expression } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as Sentry from "@sentry/nextjs";
import { Dispatch, FC, SetStateAction, useEffect, useRef, useState } from "react";
import { IMap } from "./types";
import useUpdateMapStateOnClick from "./use-update-map-state-on-click";
import useGlobalState, { get30MinNow } from "../helpers/globalState";
import QuickLRU from "quick-lru";
import { ResetIcon } from "../icons/icons";
import {
  AGGREGATION_LEVEL_MIN_ZOOM,
  AGGREGATION_LEVELS,
  MAX_POWER_GENERATED,
  VIEWS
} from "../../constant";
import {
  SATELLITE_CHANNELS,
  SATELLITE_CHANNEL_LABELS,
  SatelliteChannel,
  TifLayerData,
  fetchAndDecodeSatelliteTif,
  applyTifLayerToMap,
  setVisibleSatelliteChannels,
  warmPresignedUrlHistory,
  isCompositeChannel
} from "../helpers/satelliteLayer";
import { addMinutesToISODate } from "../helpers/utils";

mapboxgl.accessToken =
  "pk.eyJ1IjoiZmxvd2lydHoiLCJhIjoiY2tlcGhtMnFnMWRzajJ2bzhmdGs5ZXVveSJ9.Dq5iSpi54SaajfdMyM_8fQ";

// Yellow PV/GSP forecast fill layers added by pvLatestMap/deltaMap that can obscure the cloud layer
const PV_LAYER_IDS = [
  "latestPV-forecast",
  "latestPV-forecast-borders",
  "latestPV-forecast-select-borders"
];

const applyPvLayerVisibility = (m: mapboxgl.Map, visible: boolean) => {
  PV_LAYER_IDS.forEach((id) => {
    if (m.getLayer(id)) {
      m.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    }
  });
};

// The bottom-most forecast/boundary layer that satellite layers should sit under.
const SAT_BELOW_LAYER_IDS = [...PV_LAYER_IDS, "boundary-data"];
const getSatelliteBeforeId = (m: mapboxgl.Map): string | undefined =>
  SAT_BELOW_LAYER_IDS.find((id) => m.getLayer(id));

// Prefetch one timestep either side, for smooth scrubbing.
const PREFETCH_STEPS = 1;

// SEVIRI lands roughly every 5 minutes.
const LATEST_REFRESH_MS = 5 * 60 * 1000;

// Timesteps of scrub history to retain (QuickLRU keeps up to 2x this resident).
const TIF_CACHE_SIZE = 6;

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
  const [timeNow] = useGlobalState("timeNow");
  const [showCloudLayer, setShowCloudLayer] = useGlobalState("showCloudLayer");
  const [activeChannel, setActiveChannel] = useGlobalState("activeChannel");
  const [showPvLayer, setShowPvLayer] = useGlobalState("showPvLayer");
  const showPvRef = useRef(showPvLayer);
  const showCloudRef = useRef(showCloudLayer);
  const channelRef = useRef(activeChannel);
  const tifCache = useRef(new QuickLRU<string, TifLayerData>({ maxSize: TIF_CACHE_SIZE }));
  const currentKeyRef = useRef<string | null>(null);
  const requestedKeyRef = useRef<string | null>(null);
  const [isSatelliteLoading, setIsSatelliteLoading] = useState(false);
  const [satelliteError, setSatelliteError] = useState<string | null>(null);
  const [webGlSupported, setWebGlSupported] = useState<boolean>(true);

  // Show the selected channel and hide the rest.
  const applySatelliteVisibility = (m: mapboxgl.Map, visible: boolean) => {
    setVisibleSatelliteChannels(m, visible ? channelRef.current : undefined);
  };

  useEffect(() => {
    showCloudRef.current = showCloudLayer;
    if (!map.current) return;
    applySatelliteVisibility(map.current, showCloudLayer);
    if (!showCloudLayer) {
      // Drop the scrub-ahead cache when the layer is switched off.
      tifCache.current.clear();
      currentKeyRef.current = null;
      requestedKeyRef.current = null;
    }
  }, [showCloudLayer]);

  useEffect(() => {
    showPvRef.current = showPvLayer;
    if (!map.current) return;
    applyPvLayerVisibility(map.current, showPvLayer);
  }, [showPvLayer]);

  useEffect(() => {
    channelRef.current = activeChannel;
    currentKeyRef.current = null;
    // Hide layers dropped by the new selection before the fetch resolves.
    if (map.current) applySatelliteVisibility(map.current, showCloudRef.current);
  }, [activeChannel]);

  const satelliteTimestampFor = (ts: string) => addMinutesToISODate(ts, -15);
  const isFutureTimestamp = (ts: string) => new Date(ts).getTime() > Date.now();

  const satCacheKey = (ch: SatelliteChannel, ts: string) => `${ch}__${ts}`;

  const fetchIntoCache = async (
    ch: SatelliteChannel,
    satTs: string,
    latest = false
  ): Promise<TifLayerData | null> => {
    if (!latest && isFutureTimestamp(satTs)) return null;
    const key = satCacheKey(ch, satTs);
    if (!latest && tifCache.current.has(key)) return tifCache.current.get(key)!;
    const data = await fetchAndDecodeSatelliteTif(ch, satTs, latest);
    if (data && !latest) tifCache.current.set(key, data);
    return data;
  };

  // `silent` suppresses the spinner, for the background refresh below.
  const applyForTimestamp = async (ch: SatelliteChannel, ts: string, silent = false) => {
    if (!map.current) return;
    const setLoading = (loading: boolean) => {
      if (!silent) setIsSatelliteLoading(loading);
    };
    const satTs = satelliteTimestampFor(ts);
    // Derived directly rather than trusting `timeNow`, which can lag `selectedISOTime`
    // across a half-hour boundary and misread the new slot as future.
    const isNow = ts === timeNow || ts === get30MinNow();
    if (!isNow && isFutureTimestamp(satTs)) {
      applySatelliteVisibility(map.current, false);
      currentKeyRef.current = null;
      requestedKeyRef.current = null;
      setLoading(false);
      setSatelliteError("Satellite not yet available for future");
      return;
    }
    const key = satCacheKey(ch, satTs);
    requestedKeyRef.current = key;
    if (!isNow && currentKeyRef.current === key) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchIntoCache(ch, satTs, isNow);
      // Bail if the channel or timestamp moved on while we were fetching.
      if (requestedKeyRef.current !== key || !map.current) return;
      currentKeyRef.current = key;
      const beforeId = getSatelliteBeforeId(map.current);
      applyTifLayerToMap(map.current!, data, ch, showCloudRef.current, beforeId);
      setSatelliteError(data ? null : "Satellite unavailable for this time");
    } catch (err) {
      Sentry.captureException(err, {
        tags: { error: "satellite tif fetch/decode failed" }
      });
      setSatelliteError("Couldn't load satellite imagery");
      // Let a retry of this key through, rather than stranding it as "current".
      if (requestedKeyRef.current === key) currentKeyRef.current = null;
    } finally {
      if (requestedKeyRef.current === key) setLoading(false);
    }
  };

  // One effect owns all satellite loading, keyed on both selectedISOTime and
  // timeNow so a half-hour rollover triggers exactly one fetch, not two.
  useEffect(() => {
    if (title !== VIEWS.FORECAST || !showCloudLayer || !isMapReady || !selectedISOTime) return;
    let cancelled = false;
    (async () => {
      // Load the visible frame first, then warm neighbours in the background.
      await applyForTimestamp(activeChannel, selectedISOTime);
      if (cancelled) return;
      for (let offset = -PREFETCH_STEPS; offset <= PREFETCH_STEPS; offset++) {
        if (offset === 0) continue;
        const satTs = satelliteTimestampFor(addMinutesToISODate(selectedISOTime, offset * 30));
        if (isFutureTimestamp(satTs)) continue;
        fetchIntoCache(activeChannel, satTs).catch(() => {});
      }
    })();

    // Parked on "now": poll for fresher imagery (SEVIRI lands every ~5min, slots every 30).
    const refresh =
      selectedISOTime === timeNow
        ? setInterval(
            () => applyForTimestamp(activeChannel, selectedISOTime, true),
            LATEST_REFRESH_MS
          )
        : undefined;

    return () => {
      cancelled = true;
      if (refresh) clearInterval(refresh);
    };
  }, [selectedISOTime, activeChannel, isMapReady, showCloudLayer, timeNow, title]);

  // Warm the presigned-URL cache for the whole scrubbable history, once per
  // channel selection, so scrubbing back lands on a cached URL.
  const historyWarmedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (title !== VIEWS.FORECAST || !isMapReady) return;
    if (historyWarmedForRef.current === activeChannel) return;
    historyWarmedForRef.current = activeChannel;

    const anchor = get30MinNow();
    const start = addMinutesToISODate(anchor, -2880);
    warmPresignedUrlHistory(activeChannel, start, anchor);
  }, [activeChannel, isMapReady, title]);

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
      applyPvLayerVisibility(map.current, showPvRef.current);
    }
  }, [updateData]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_CI === "true") return;

    // check if webgl is supported
    if (!mapboxgl.supported()) {
      setWebGlSupported(false);
      return;
    }

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

  if (!webGlSupported) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-ocf-black-500 p-6 text-center">
        <div>
          <h3 className="text-lg font-semibold text-ocf-yellow">Map Unavailable</h3>
          <p className="mt-2 text-sm text-ocf-gray-600">
            Your browser does not support WebGL, which is required to display the map. <br />
            Please update your browser or use the latest version of Chrome.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-hidden bg-ocf-gray-900">
      <div className="absolute top-0 left-0 z-10 p-4 min-w-[20rem] w-full flex flex-col gap-1 pointer-events-none">
        <div className="pointer-events-auto">{controlOverlay(map)}</div>
        {title === VIEWS.FORECAST && (
          <div
            className={`pointer-events-auto flex flex-row items-start justify-end gap-2 transition-all duration-300 mt-3`}
          >
            {showCloudLayer && (
              <select
                value={activeChannel}
                onChange={(e) => setActiveChannel(e.target.value as SatelliteChannel)}
                disabled={!!satelliteError}
                className="min-w-[10rem] w-auto bg-black text-white text-xs font-semibold py-1 px-1.5 border-none outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
              >
                {satelliteError ? (
                  <option value={activeChannel}>{satelliteError}</option>
                ) : (
                  <>
                    <optgroup label="Composites">
                      {SATELLITE_CHANNELS.filter(isCompositeChannel).map((ch) => (
                        <option key={ch} value={ch}>
                          {SATELLITE_CHANNEL_LABELS[ch]}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Individual bands">
                      {SATELLITE_CHANNELS.filter((ch) => !isCompositeChannel(ch)).map((ch) => (
                        <option key={ch} value={ch}>
                          {SATELLITE_CHANNEL_LABELS[ch]}
                        </option>
                      ))}
                    </optgroup>
                  </>
                )}
              </select>
            )}

            <div className="flex flex-row items-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const turningOff = showCloudLayer;
                  setShowCloudLayer(!showCloudLayer);
                  if (turningOff) setShowPvLayer(true);
                }}
                className={`relative inline-flex items-center px-3 py-0.5 text-sm dash:text-lg dash:tracking-wide font-extrabold transition-all active:scale-95 ${
                  showCloudLayer
                    ? "text-black bg-ocf-yellow"
                    : "text-white bg-black hover:bg-ocf-yellow hover:text-mapbox-black-700"
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

              <button
                type="button"
                title="Toggle the yellow PV forecast overlay so clouds are easier to see"
                onClick={() => setShowPvLayer((v) => !v)}
                className={`relative inline-flex items-center px-3 py-0.5 text-sm dash:text-lg dash:tracking-wide font-extrabold transition-all active:scale-95 ${
                  showPvLayer
                    ? "text-black bg-ocf-yellow"
                    : "text-white bg-black hover:bg-ocf-yellow hover:text-mapbox-black-700"
                }`}
              >
                PV
              </button>
            </div>
          </div>
        )}
      </div>

      <div ref={mapContainer} id={`Map-${title}`} data-title={title} className="h-full w-full" />
      <div className="map-overlay top">{children}</div>
    </div>
  );
};

export default Map;
