import mapboxgl, { Expression } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as Sentry from "@sentry/nextjs";
import { Dispatch, FC, SetStateAction, useEffect, useRef, useState } from "react";
import { IMap } from "./types";
import useUpdateMapStateOnClick from "./use-update-map-state-on-click";
import useGlobalState from "../helpers/globalState";
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
  ChannelSelection,
  COMPOSITE_SELECTIONS,
  MAX_COMPOSITE_CHANNELS,
  channelsForSelection,
  TifLayerData,
  fetchAndDecodeSatelliteTif,
  applyTifLayerToMap,
  setVisibleSatelliteChannels,
  orderSatelliteLayers
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

// Prefetch one timestep either side — enough to keep single-step scrubbing and
// the play button smooth, without front-loading speculative frames the forecast
// latency would mask anyway.
const PREFETCH_STEPS = 1;

// How often to re-pull the latest frame while parked on "now". SEVIRI lands
// roughly every 5 minutes, so polling faster mostly re-decodes an image we
// already have.
const LATEST_REFRESH_MS = 5 * 60 * 1000;

// Retain roughly this many distinct timesteps of scrub history. A selection costs
// up to MAX_COMPOSITE_CHANNELS entries per timestep, so the cache is sized to fit.
// (QuickLRU keeps up to 2x maxSize resident, and the cache is cleared when the
// cloud layer is switched off — see the showCloudLayer effect.) Kept modest as
// each decoded entry is ~0.5MB and this runs on always-on wallboards.
const CACHE_TIMESTEPS = 6;
const TIF_CACHE_SIZE = MAX_COMPOSITE_CHANNELS * CACHE_TIMESTEPS;

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

  // Show the selected channel(s) and hide the rest. A composite selection resolves
  // to several channels, each with its own layer, so they stack.
  const applySatelliteVisibility = (m: mapboxgl.Map, visible: boolean) => {
    setVisibleSatelliteChannels(m, visible ? channelsForSelection(channelRef.current) : []);
  };

  useEffect(() => {
    showCloudRef.current = showCloudLayer;
    if (!map.current) return;
    applySatelliteVisibility(map.current, showCloudLayer);
    if (!showCloudLayer) {
      // Drop the scrub-ahead cache when the layer is switched off — the visible
      // frame stays on its (now hidden) map layer, so re-enabling is still instant,
      // but we stop holding decoded frames a user has chosen not to see. Reset the
      // keys so re-enabling re-applies the currently-selected timestep afresh.
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

  // Doubles as the per-channel cache key and the per-selection request key.
  const satCacheKey = (sel: ChannelSelection, ts: string) => `${sel}__${ts}`;

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

  // `silent` suppresses the spinner: used by the background refresh below, where
  // a frame is already on screen and flashing a loader every few minutes on an
  // always-on wallboard is just noise.
  const applyForTimestamp = async (sel: ChannelSelection, ts: string, silent = false) => {
    if (!map.current) return;
    const setLoading = (loading: boolean) => {
      if (!silent) setIsSatelliteLoading(loading);
    };
    const satTs = satelliteTimestampFor(ts);
    const isNow = ts === timeNow;
    if (!isNow && isFutureTimestamp(satTs)) {
      applySatelliteVisibility(map.current, false);
      currentKeyRef.current = null;
      requestedKeyRef.current = null;
      setLoading(false);
      setSatelliteError("Satellite not yet available for future");
      return;
    }
    // Key on the whole selection, since a composite applies several channels as
    // one unit and must be superseded as one unit.
    const key = satCacheKey(sel, satTs);
    requestedKeyRef.current = key;
    if (!isNow && currentKeyRef.current === key) {
      setLoading(false);
      return;
    }
    const channels = channelsForSelection(sel);
    setLoading(true);
    try {
      const results = await Promise.all(
        channels.map(async (ch) => ({ ch, data: await fetchIntoCache(ch, satTs, isNow) }))
      );
      // Bail if the selection or timestamp moved on while we were fetching.
      if (requestedKeyRef.current !== key || !map.current) return;
      currentKeyRef.current = key;
      const beforeId = getSatelliteBeforeId(map.current);
      results.forEach(({ ch, data }) =>
        applyTifLayerToMap(map.current!, data, ch, showCloudRef.current, beforeId)
      );
      // `channels` is ordered bottom-most first; enforce it explicitly since
      // lazily-created layers won't be in the right order on their own.
      orderSatelliteLayers(map.current, channels, beforeId);
      setSatelliteError(results.some((r) => r.data) ? null : "Satellite unavailable for this time");
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

  // One effect owns all satellite loading. It used to be two — one keyed on
  // selectedISOTime, one on timeNow — but both of those change in the same commit
  // when the half-hour rolls over, so both fired and each did a full uncached
  // fetch/decode of every channel (the `latest` path deliberately bypasses the
  // cache, so the second pass was not free). Folding them together makes the
  // boundary cost exactly one pass.
  useEffect(() => {
    // Nothing satellite-related runs until the user actually enables clouds, so a
    // visitor who never turns the layer on pays no satellite requests at all.
    if (title !== VIEWS.FORECAST || !showCloudLayer || !isMapReady || !selectedISOTime) return;
    let cancelled = false;
    (async () => {
      // Load the frame the user is actually looking at first, then warm the
      // neighbours in the background — so the visible frame is never queued behind
      // speculative prefetches.
      await applyForTimestamp(activeChannel, selectedISOTime);
      if (cancelled) return;
      const channels = channelsForSelection(activeChannel);
      for (let offset = -PREFETCH_STEPS; offset <= PREFETCH_STEPS; offset++) {
        if (offset === 0) continue;
        const satTs = satelliteTimestampFor(addMinutesToISODate(selectedISOTime, offset * 30));
        if (isFutureTimestamp(satTs)) continue;
        channels.forEach((ch) => fetchIntoCache(ch, satTs).catch(() => {}));
      }
    })();

    // Parked on "now": poll for a fresher image. Both selectedISOTime and timeNow
    // only advance on the half hour (get30MinNow rounds to the slot, so the string
    // is identical in between and React bails out of the re-render), which would
    // otherwise leave the displayed frame up to 30 minutes behind imagery that
    // lands every ~5. Silent, so the spinner doesn't flash on a wallboard.
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
                onChange={(e) => setActiveChannel(e.target.value as ChannelSelection)}
                disabled={!!satelliteError}
                className="min-w-[10rem] w-auto bg-black text-white text-xs font-semibold py-1 px-1.5 border-none outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
              >
                {satelliteError ? (
                  <option value={activeChannel}>{satelliteError}</option>
                ) : (
                  <>
                    <optgroup label="Composites">
                      {Object.entries(COMPOSITE_SELECTIONS).map(([key, { label }]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Single channels">
                      {SATELLITE_CHANNELS.map((ch) => (
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
