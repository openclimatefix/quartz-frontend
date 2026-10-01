import mapboxgl, { Expression } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as Sentry from "@sentry/nextjs";
import { Dispatch, FC, SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import { IMap, MAP_TITLE_MAIN } from "./types";
import useUpdateMapStateOnClick from "./use-update-map-state-on-click";
import useGlobalState, {
  useCountryState,
  getCursorCadenceMinutes,
  getCursorNow
} from "../helpers/globalState";
import QuickLRU from "quick-lru";
import {
  AGGREGATION_LEVEL_MIN_ZOOM,
  AGGREGATION_LEVELS,
  MAX_POWER_GENERATED
} from "../../constant";
import {
  SatelliteChannel,
  SatelliteStack,
  TifLayerData,
  fetchAndDecodeSatelliteTif,
  fetchSatelliteStack,
  renderStackFrame,
  stackKey,
  applyTifLayerToMap,
  setVisibleSatelliteChannels,
  setSatelliteLayerVisibility,
  positionSatelliteLayer,
  satLayerId,
  satSourceId
} from "../helpers/satelliteLayer";
import { addMinutesToISODate } from "../helpers/utils";
import { useEnabledCountries } from "../../hooks/data/use-countries";
import { getCountryConfig } from "../../config/countries";
import { framePadding, unionBounds, type Bounds } from "./frame-countries";

/**
 * The enabled-country set this session has already framed the camera for, or `null` before the
 * first framing. Module-level so it survives a remount of the map component — see the framing
 * effect in `Map` for why that matters.
 */
let framedFor: string | null = null;

// Moved to env by Phase 5 Track E — this was a hardcoded credential in source. See
// `.env.example` / `docs/phase5-track-e-notes.md`.
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

// The region fill layers added by `pvLatestMap.tsx` that can obscure the cloud layer. Their ids
// are unchanged by the delta merge: one set of layers, repainted, is what the merge is.
const PV_LAYER_IDS = [
  "latestPV-forecast",
  "latestPV-forecast-borders",
  "latestPV-forecast-select-borders"
];

/**
 * The base style's label font, swapped for something nearer the brand's.
 *
 * **Mapbox does not use the page's fonts.** Labels are rendered from pre-generated SDF glyph
 * atlases fetched from the style's `glyphs` URL, and `mapbox/dark-v10`'s points at Mapbox's own
 * font namespace — so the only faces reachable without either uploading Matter to a Mapbox
 * account or self-hosting our own glyph PBFs are the ones Mapbox hosts. This is the cheap half
 * of that question: see whether the map's typography is worth the licensing work at all before
 * anyone reads a font licence.
 *
 * `MAP_LABEL_FONT` is a Mapbox-hosted family name. Candidates, closest first by letterform —
 * Matter is a geometric sans with a tall x-height and straight terminals:
 *
 *   "Work Sans"  — grotesque/geometric hybrid, tall x-height, straight terminals. Closest.
 *   "Manrope"    — semi-geometric, tall x-height. Closer still if Mapbox hosts it.
 *   "Rubik"      — geometric and warm, but its rounded corners are a tell Matter does not have.
 *   "Poppins"    — monoline geometric; rounder and wider than Matter.
 *   "Montserrat" — wide, which costs a lot of room in map labels.
 *
 * **If the labels vanish, the name is wrong.** Mapbox composites a font stack server-side, so a
 * family it does not host 404s the whole glyph range rather than falling back — which is also
 * why `Arial Unicode MS Regular` trails every stack below: it is Mapbox's universal fallback and
 * carries the glyphs the Latin faces do not.
 */
const MAP_LABEL_FONT = "Manrope";

/**
 * The weight the layer already asked for, kept. dark-v10 uses several DIN Pro weights to
 * separate countries from cities from water, and flattening them all to Regular would throw
 * away a hierarchy the style spent them on.
 */
const matchingWeight = (existing: string): string => {
  if (/bold/i.test(existing)) return "Bold";
  if (/medium|semibold/i.test(existing)) return "Medium";
  if (/light/i.test(existing)) return "Light";
  return "Regular";
};

const applyBrandLabelFont = (m: mapboxgl.Map) => {
  for (const layer of m.getStyle()?.layers ?? []) {
    if (layer.type !== "symbol") continue;
    const existing = (layer.layout as { "text-font"?: unknown })?.["text-font"];
    // Only a plain array is safe to rewrite: `text-font` can also be a zoom expression, and
    // replacing one of those with a flat stack would drop whatever it was varying.
    if (!Array.isArray(existing) || typeof existing[0] !== "string") continue;
    m.setLayoutProperty(layer.id, "text-font", [
      `${MAP_LABEL_FONT} ${matchingWeight(existing[0])}`,
      "Arial Unicode MS Regular"
    ]);
  }
};

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
const STACK_REFRESH_MS = 15 * 60 * 1000;

// Retain roughly this many distinct timesteps of scrub history — one decoded entry
// per timestep, since one channel is shown at a time. (QuickLRU keeps up to 2x
// maxSize resident, and the cache is cleared when the cloud layer is switched off —
// see the showCloudLayer effect.) Kept modest as each decoded entry is ~0.5MB and
// this runs on always-on wallboards.
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
  const [lng, setLng] = useCountryState("lng");
  const [lat, setLat] = useCountryState("lat");
  const [zoom, setZoom] = useCountryState("zoom");
  const [maps, setMaps] = useGlobalState("maps");
  const [, setMapFramingModified] = useGlobalState("mapFramingModified");
  const [, setResetMapFraming] = useGlobalState("resetMapFraming");
  const [currentAggregation, setAggregation] = useCountryState("aggregationLevel");
  const [autoZoom] = useGlobalState("autoZoom");
  const [focusedCountry] = useGlobalState("focusedCountry");

  // Read through a ref so panning (which writes lng/lat/zoom continuously) cannot re-run any
  // camera effect below.
  const viewportRef = useRef({ lng, lat, zoom });
  viewportRef.current = { lng, lat, zoom };

  /**
   * The camera frames the countries that are **enabled**, and moves only when that set changes.
   *
   * It used to jump to the *focused* country's stored viewport whenever focus changed. Since
   * Track F the map draws every enabled country at once, which made that wrong twice over: it
   * threw away the view of the countries still on screen, and — because selecting a region in
   * the other country sets focus (contract §1) — it fired on ordinary region clicks, yanking
   * the camera to NL mid-interaction. Focus is now about whose numbers the chart shows, not
   * where the camera points.
   *
   * Keyed on the enabled set alone, so nothing else moves the camera: not focus, not a region
   * selection, not an aggregation-level change. Once framed, the view is the user's to pan.
   *
   * **`framedFor` is module state, not a ref, and that is the point** (2026-08-15). It was a
   * `useRef`, which meant it died with the component — and `pages/index.tsx` used to swap
   * `PvLatestMap` for `DeltaMap` on selecting a comparison, unmounting this map and building a new
   * one. The fresh instance started at `null`, decided it had never framed anything, and threw
   * away the user's pan and zoom on every switch between forecast and delta. The viewport itself
   * was never lost: `lng`/`lat`/`zoom` are country-scoped global state and restore correctly;
   * it was this effect overwriting them a moment later.
   *
   * "Have we already framed this enabled set?" is a fact about the *session*, not about a
   * particular React instance, so it lives where a remount cannot reach it. It is deliberately
   * not global state: nothing renders from it, and writing it in an effect would cost a render
   * for something no one reads.
   *
   * The forecast/delta swap that exposed it is gone (the two maps are one component now), so
   * that particular remount can no longer happen — but it would still be wrong to lose framing
   * across any other remount, so the fix stands on its own.
   */
  const enabledCountries = useEnabledCountries();
  const enabledKey = enabledCountries.join(",");

  const frameToBounds = useCallback((bounds: Bounds, duration: number) => {
    if (!map.current) return;

    // Read at call time, not at mount: the chart is drag-resizable, so its width is only known
    // now. Both callers go through here, so the toggle framing and the reset button always
    // compensate for the same chart — the disagreement between them was exactly this sum being
    // computed in one place and not the other.
    const canvas = map.current.getContainer().getBoundingClientRect();
    const chart = document.querySelector('[aria-label="Chart"]')?.getBoundingClientRect();

    map.current.fitBounds(
      [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]]
      ],
      { padding: framePadding(chart?.width ?? 0, canvas.width), duration }
    );
  }, []);

  /**
   * The framing the "Reset Zoom" button performs. Held in a ref because that button is built
   * once, inside the map-init effect, so anything it closes over is frozen at mount — which is
   * precisely how it came to fly to a stale centre and zoom in the first place. A ref is read at
   * click time, so it always frames the set that is enabled *now*.
   */
  const resetFramingRef = useRef<() => void>(() => {});
  resetFramingRef.current = () => {
    const union = unionBounds(enabledCountries);
    if (union) frameToBounds(union, 1500);
    setMapFramingModified(false);
  };

  /**
   * Publish the framing action so the dock's reset button can call it.
   *
   * A holder around the *ref*, not around `resetFramingRef.current` — the ref is re-pointed on
   * every render so it always frames the countries enabled now, and that was the whole reason
   * it is a ref. Registering the current value instead would freeze the enabled set at mount,
   * which is exactly the bug the ref exists to prevent.
   */
  useEffect(() => {
    setResetMapFraming({ run: () => resetFramingRef.current() });
    return () => setResetMapFraming(null);
  }, [setResetMapFraming]);

  useEffect(() => {
    if (!map.current || !isMapReady) return;
    if (framedFor === enabledKey) return;

    const union = unionBounds(enabledCountries);
    if (!union) return;

    const isFirstFraming = framedFor === null;
    framedFor = enabledKey;
    setMapFramingModified(false);

    // The first framing is the initial view and should not animate in; later ones are a response
    // to the user toggling a country, where the movement is what explains the change.
    frameToBounds(union, isFirstFraming ? 0 : 700);
  }, [enabledKey, enabledCountries, isMapReady, frameToBounds, setMapFramingModified]);
  const [selectedISOTime] = useGlobalState("selectedISOTime");
  const [timeNow] = useGlobalState("timeNow");
  // Setters for these three are no longer called here — the Clouds/PV buttons and the channel
  // select that used to write them moved to `map-layer-controls.tsx` (Track I). Read-only here;
  // this component still consumes the values to drive the fetch/decode pipeline and the PV fill
  // layer's visibility.
  const [showCloudLayer] = useGlobalState("showCloudLayer");
  const [activeChannel] = useGlobalState("activeChannel");
  const [showPvLayer] = useGlobalState("showPvLayer");
  const showPvRef = useRef(showPvLayer);
  const showCloudRef = useRef(showCloudLayer);
  const channelRef = useRef(activeChannel);
  const tifCache = useRef(new QuickLRU<string, TifLayerData>({ maxSize: TIF_CACHE_SIZE }));
  const currentKeyRef = useRef<string | null>(null);
  const requestedKeyRef = useRef<string | null>(null);
  const stackRef = useRef<SatelliteStack | null>(null);
  // Lifted to global state (Phase 6 followup, Track I) so `map-layer-controls.tsx` — now
  // mounted in the consolidated top-right panel rather than inside this component — can show
  // the spinner and error text it used to render itself. See globalState.tsx's doc comment.
  const [isSatelliteLoading, setIsSatelliteLoading] = useGlobalState("isSatelliteLoading");
  const [satelliteError, setSatelliteError] = useGlobalState("satelliteError");
  const [satellitePartialComposite, setSatellitePartialComposite] = useGlobalState(
    "satellitePartialComposite"
  );
  const [webGlSupported, setWebGlSupported] = useState<boolean>(true);

  const renderedFramesRef = useRef<Record<string, TifLayerData>>({});
  const stackFrameLayerIds = useRef<SatelliteChannel[]>([]);
  const shownFrameLayerIds = useRef<SatelliteChannel[]>([]);
  const teardownStackFrames = () => {
    const m = map.current;
    stackFrameLayerIds.current.forEach((id) => {
      if (m?.getLayer(satLayerId(id))) m.removeLayer(satLayerId(id));
      if (m?.getSource(satSourceId(id))) m.removeSource(satSourceId(id));
    });
    stackFrameLayerIds.current = [];
    shownFrameLayerIds.current = [];
  };
  const [stackReadyTick, setStackReadyTick] = useState(0);
  const selectedTimeRef = useRef(selectedISOTime);
  selectedTimeRef.current = selectedISOTime;

  const lastLoadingRef = useRef(isSatelliteLoading);
  const lastErrorRef = useRef<string | null>(satelliteError);
  const lastPartialRef = useRef<string>(satellitePartialComposite?.join(",") ?? "");
  const setLoadingDeduped = (v: boolean) => {
    if (lastLoadingRef.current !== v) {
      lastLoadingRef.current = v;
      setIsSatelliteLoading(v);
    }
  };
  const setErrorDeduped = (e: string | null) => {
    if (lastErrorRef.current !== e) {
      lastErrorRef.current = e;
      setSatelliteError(e);
    }
  };
  const setPartialDeduped = (missing: string[] | null) => {
    const k = missing && missing.length ? missing.join(",") : "";
    if (lastPartialRef.current !== k) {
      lastPartialRef.current = k;
      setSatellitePartialComposite(missing && missing.length ? missing : null);
    }
  };

  // Show the selected channel and hide the rest.
  const applySatelliteVisibility = (m: mapboxgl.Map, visible: boolean) => {
    setVisibleSatelliteChannels(m, visible ? [channelRef.current] : []);
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
      teardownStackFrames();
      currentKeyRef.current = null;
      requestedKeyRef.current = null;
      setPartialDeduped(null);
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
    // The stack, its rendered textures, and its uploaded frame layers are per-channel; drop them
    // all so the new channel starts clean (the stack effect refetches, the build effect re-uploads).
    teardownStackFrames();
    stackRef.current = null;
    renderedFramesRef.current = {};
    // Hide layers dropped by the new selection before the fetch resolves.
    if (map.current) applySatelliteVisibility(map.current, showCloudRef.current);
  }, [activeChannel]);

  const satelliteTimestampFor = (ts: string) => addMinutesToISODate(ts, -15);
  const isFutureTimestamp = (ts: string) => new Date(ts).getTime() > Date.now();

  // The per-channel cache key, also used as the in-flight request key.
  const satCacheKey = (ch: SatelliteChannel, ts: string) => `${ch}__${ts}`;

  // Render one slot from the active channel's stack, memoised in `renderedFramesRef` (unbounded),
  // or null if the stack doesn't cover it. The WebP encode happens once per slot, ever.
  const renderFromStack = (ch: SatelliteChannel, satTs: string): TifLayerData | null => {
    const stack = stackRef.current;
    if (!stack || stack.channel !== ch) return null;
    const k = stackKey(satTs);
    if (!stack.bands[k]) return null;
    const cached = renderedFramesRef.current[k];
    if (cached) return cached;
    const frame = renderStackFrame(stack, k);
    if (frame) renderedFramesRef.current[k] = frame;
    return frame;
  };

  const stackCovers = (ch: SatelliteChannel, satTs: string) =>
    stackRef.current?.channel === ch && !!stackRef.current.bands[stackKey(satTs)];

  const showStackFrame = (ts: string | undefined) => {
    const m = map.current;
    if (!m) return;
    shownFrameLayerIds.current.forEach((id) => setSatelliteLayerVisibility(m, false, id));
    const suffix = ts ? `@${stackKey(satelliteTimestampFor(ts))}` : null;
    shownFrameLayerIds.current = suffix
      ? stackFrameLayerIds.current.filter((id) => id.endsWith(suffix))
      : [];
    shownFrameLayerIds.current.forEach((id) => setSatelliteLayerVisibility(m, true, id));
  };

  const slotHasStackLayer = (ch: SatelliteChannel, ts: string) => {
    if (ts === timeNow || ts === getCursorNow()) return false;
    const id = `${ch}@${stackKey(satelliteTimestampFor(ts))}` as SatelliteChannel;
    return stackFrameLayerIds.current.includes(id);
  };

  const showFrameInstant = (ch: SatelliteChannel, ts: string) => {
    const m = map.current;
    if (!m) return;
    requestedKeyRef.current = null;
    currentKeyRef.current = null;
    setSatelliteLayerVisibility(m, false, ch);
    showStackFrame(ts);
    const miss = stackRef.current?.missing[stackKey(satelliteTimestampFor(ts))];
    setPartialDeduped(miss && miss.length ? miss : null);
    setErrorDeduped(null);
    setLoadingDeduped(false);
  };

  const fetchIntoCache = async (
    ch: SatelliteChannel,
    satTs: string,
    latest = false
  ): Promise<TifLayerData | null> => {
    if (!latest && isFutureTimestamp(satTs)) return null;
    // Stack primary: render locally (cached unbounded per channel), no network.
    if (!latest) {
      const frame = renderFromStack(ch, satTs);
      if (frame) return frame;
    }
    // Network fallback (small LRU): a slot beyond the 48 h window, a gap, or stack not loaded yet.
    const key = satCacheKey(ch, satTs);
    if (!latest && tifCache.current.has(key)) return tifCache.current.get(key)!;
    const data = await fetchAndDecodeSatelliteTif(ch, satTs, latest);
    if (data && !latest) tifCache.current.set(key, data);
    return data;
  };

  // Put one decoded frame on the channel's layer, if it is still the one being requested.
  const applyFrame = (channel: SatelliteChannel, key: string, data: TifLayerData | null) => {
    if (requestedKeyRef.current !== key || !map.current) return;
    currentKeyRef.current = key;
    const beforeId = getSatelliteBeforeId(map.current);
    applyTifLayerToMap(map.current, data, channel, showCloudRef.current, beforeId);
    // Re-assert the layer's position: a lazily-created layer won't sit under the forecast/PV
    // layers on its own.
    positionSatelliteLayer(map.current, channel, beforeId);
    setErrorDeduped(data ? null : "Satellite unavailable for this time");
    // Flag a partial composite (some member bands missing from this frame).
    setPartialDeduped(data?.missingChannels ?? null);
  };

  // `silent` suppresses the spinner: used by the background refresh below, where a frame is
  // already on screen and flashing a loader every few minutes on an always-on wallboard is noise.
  const applyForTimestamp = async (channel: SatelliteChannel, ts: string, silent = false) => {
    if (!map.current) return;
    const satTs = satelliteTimestampFor(ts);
    // `timeNow` and `selectedISOTime` are written by two independent 60s timers
    // (use-time-now, mounted via ForecastHeader, and use-and-update-selected-time
    // in pages/index) whose phase isn't locked — ForecastHeader unmounts on a view
    // switch and restarts its timer at a fresh offset. Across a slot boundary
    // that leaves a window where selectedISOTime has advanced but timeNow hasn't,
    // and trusting `timeNow` alone would read the new slot as a future timestamp:
    // clouds hidden behind "not yet available", healing itself a minute later.
    // Deriving the slot directly makes this path independent of that race.
    // Scrubbing to a genuinely future slot still fails the check, as it should.
    const isNow = ts === timeNow || ts === getCursorNow();
    if (!isNow && isFutureTimestamp(satTs)) {
      applySatelliteVisibility(map.current, false);
      currentKeyRef.current = null;
      requestedKeyRef.current = null;
      if (!silent) setLoadingDeduped(false);
      setErrorDeduped("Satellite not yet available for future");
      setPartialDeduped(null);
      return;
    }
    const key = satCacheKey(channel, satTs);
    requestedKeyRef.current = key;
    if (!isNow && currentKeyRef.current === key) return;

    // Hot path — a frame already in memory: apply synchronously, no spinner, no await. This is
    // what makes scrubbing and playback smooth once the stack frames are rendered.
    if (!isNow) {
      const ready = renderedFramesRef.current[stackKey(satTs)] ?? tifCache.current.get(key);
      if (ready) {
        if (!silent) setLoadingDeduped(false);
        applyFrame(channel, key, ready);
        return;
      }
      if (stackCovers(channel, satTs)) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (requestedKeyRef.current !== key) return;
        if (!silent) setLoadingDeduped(false);
        applyFrame(channel, key, renderFromStack(channel, satTs));
        return;
      }
    }

    // Slow path — needs the network. Show the spinner (unless silent); re-check staleness after.
    if (!silent) setLoadingDeduped(true);
    try {
      const data = await fetchIntoCache(channel, satTs, isNow);
      // Bail if the channel or timestamp moved on while we were fetching.
      if (requestedKeyRef.current !== key || !map.current) return;
      applyFrame(channel, key, data);
    } catch (err) {
      Sentry.captureException(err, {
        tags: { error: "satellite tif fetch/decode failed" }
      });
      if (requestedKeyRef.current === key) {
        setErrorDeduped("Couldn't load satellite imagery");
        setPartialDeduped(null);
        // Let a retry of this key through, rather than stranding it as "current".
        currentKeyRef.current = null;
      }
    } finally {
      if (!silent && requestedKeyRef.current === key) setLoadingDeduped(false);
    }
  };

  // One effect owns all satellite loading. It used to be two — one keyed on
  // selectedISOTime, one on timeNow — but both of those change in the same commit
  // when the half-hour rolls over, so both fired and each did a full uncached
  // fetch/decode (the `latest` path deliberately bypasses the
  // cache, so the second pass was not free). Folding them together makes the
  // boundary cost exactly one pass.
  useEffect(() => {
    // Nothing satellite-related runs until the user actually enables clouds, so a
    // visitor who never turns the layer on pays no satellite requests at all.
    // The gate is `MAIN`, not "the forecast view": clouds are the dominant driver of forecast
    // error, so they are if anything *more* useful under the delta fill than under the forecast
    // one (FB-020, NESO — "attribute a change in forecast to a thickening or thinning of the
    // cloud cover in a particular area", a delta-shaped question). What it still excludes is
    // `sitesMap`, which has no satellite layers to drive.
    if (title !== MAP_TITLE_MAIN || !showCloudLayer || !isMapReady || !selectedISOTime) return;
    const m = map.current;

    if (m && slotHasStackLayer(activeChannel, selectedISOTime)) {
      showFrameInstant(activeChannel, selectedISOTime);
      return;
    }

    if (m) showStackFrame(undefined);

    let cancelled = false;
    (async () => {
      // Load the frame the user is actually looking at first, then warm the
      // neighbours in the background — so the visible frame is never queued behind
      // speculative prefetches.
      await applyForTimestamp(activeChannel, selectedISOTime);
      if (cancelled) return;
      for (let offset = -PREFETCH_STEPS; offset <= PREFETCH_STEPS; offset++) {
        if (offset === 0) continue;
        // One cursor step per offset, not a fixed half hour — on a 15-minute grid the old
        // stride prefetched every *other* neighbour and left the ones in between cold.
        const satTs = satelliteTimestampFor(
          addMinutesToISODate(selectedISOTime, offset * getCursorCadenceMinutes())
        );
        if (isFutureTimestamp(satTs)) continue;
        // Skip slots the stack covers — the idle build uploads them as frame layers, so a network
        // prefetch would be wasted work. Only warm genuine fallbacks.
        if (stackCovers(activeChannel, satTs)) continue;
        fetchIntoCache(activeChannel, satTs).catch(() => {});
      }
    })();

    // Parked on "now": poll for a fresher image. Both selectedISOTime and timeNow
    // only advance one cursor slot at a time (`getCursorNow` rounds to the slot, so the
    // string is identical in between and React bails out of the re-render), which would
    // otherwise leave the displayed frame up to a whole slot behind imagery that lands
    // every ~5 minutes. Silent, so the spinner doesn't flash on a wallboard.
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

  useEffect(() => {
    if (title !== MAP_TITLE_MAIN || !isMapReady) return;
    const channel = activeChannel;
    let cancelled = false;
    const load = () => {
      fetchSatelliteStack(channel)
        .then((stack) => {
          // Guard against a channel switch or unmount during the fetch/decode.
          if (cancelled || !stack || channelRef.current !== channel) return;
          stackRef.current = stack;
          // Wake the idle frame-layer build (a ref assignment alone wouldn't). On a refresh it
          // prunes aged-out frames, keeps the uploaded ones, and only builds genuinely new slots.
          setStackReadyTick((n) => n + 1);
        })
        .catch(() => {});
    };
    load();
    const refresh = setInterval(load, STACK_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(refresh);
    };
  }, [activeChannel, isMapReady, title]);

  useEffect(() => {
    const m = map.current;
    if (!m || title !== MAP_TITLE_MAIN || !showCloudLayer || !isMapReady) return;
    const stack = stackRef.current;
    if (!stack || stack.channel !== activeChannel) return;

    const beforeId = getSatelliteBeforeId(m);
    const keys = Object.keys(stack.bands).sort(); // stackKey is chronological as a string

    const live = new Set(keys);
    const slotOf = (id: string) => id.slice(id.indexOf("@") + 1);
    const stale = stackFrameLayerIds.current.filter((id) => !live.has(slotOf(id)));
    if (stale.length) {
      stale.forEach((id) => {
        if (m.getLayer(satLayerId(id))) m.removeLayer(satLayerId(id));
        if (m.getSource(satSourceId(id))) m.removeSource(satSourceId(id));
        delete renderedFramesRef.current[slotOf(id)];
      });
      const isLive = (id: string) => live.has(slotOf(id));
      stackFrameLayerIds.current = stackFrameLayerIds.current.filter(isLive);
      shownFrameLayerIds.current = shownFrameLayerIds.current.filter(isLive);
    }

    const cursorKey = selectedTimeRef.current
      ? stackKey(satelliteTimestampFor(selectedTimeRef.current))
      : null;
    const cursorIdx =
      cursorKey && keys.includes(cursorKey) ? keys.indexOf(cursorKey) : keys.length - 1;
    const pending = keys
      .map((k, i) => ({ k, d: Math.abs(i - cursorIdx) }))
      .filter(
        ({ k }) => !stackFrameLayerIds.current.includes(`${activeChannel}@${k}` as SatelliteChannel)
      )
      .sort((a, b) => a.d - b.d)
      .map(({ k }) => k);
    if (!pending.length) return;

    let cancelled = false;
    let i = 0;
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void) => number })
      .requestIdleCallback;
    const schedule = (cb: () => void) => (ric ? ric(cb) : window.setTimeout(cb, 16));
    const step = () => {
      if (cancelled || !map.current || stackRef.current !== stack) return;
      const stop = Math.min(i + 4, pending.length);
      for (; i < stop; i++) {
        const k = pending[i];
        // Reuse a texture already encoded (by the fallback path, or before a clouds-off teardown)
        // so re-enabling clouds re-uploads from memory instead of re-encoding every frame.
        const frame = renderedFramesRef.current[k] ?? renderStackFrame(stack, k);
        if (!frame) continue;
        renderedFramesRef.current[k] = frame;
        const id = `${activeChannel}@${k}` as SatelliteChannel;
        applyTifLayerToMap(map.current, frame, id, false, beforeId);
        stackFrameLayerIds.current.push(id);
      }
      const cursor = selectedTimeRef.current;
      if (cursor && slotHasStackLayer(activeChannel, cursor)) {
        const cursorId = `${activeChannel}@${stackKey(satelliteTimestampFor(cursor))}`;
        if (!shownFrameLayerIds.current.includes(cursorId as SatelliteChannel)) {
          showFrameInstant(activeChannel, cursor);
        }
      }
      if (i < pending.length) schedule(step);
    };
    schedule(step);
    return () => {
      cancelled = true;
    };
  }, [stackReadyTick, activeChannel, showCloudLayer, isMapReady, title]);

  useEffect(() => () => teardownStackFrames(), []);

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
        setMapFramingModified(true);
      }
    };

    if (map.current) return; // initialize map only once
    if (mapContainer.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/bradbdf/cm7yvv7y400wk01sdfdi4ep7l",
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

      // No `addControl` for zoom or reset. Mapbox would position them against the map, in a
      // box the shell cannot see or lay out beside — see `map-zoom-controls.tsx`, which renders
      // both in the control dock instead. The attribution stays Mapbox's, as it must.

      map.current.on("load", (event) => {
        setIsMapReady(true);
        if (map.current) applyBrandLabelFont(map.current);
        loadDataOverlay(map);
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

  /**
   * Keep the canvas the size of its container.
   *
   * Mapbox sizes its canvas when it initialises and then never again on its own — it has no way
   * to know the box around it moved. Every time the shell's layout changes height or width
   * without the window changing (chrome mounting or unmounting, the chart being dragged, a
   * banner appearing) the map keeps the canvas it was born with and renders short, leaving bare
   * ground along whichever edge grew. That is not a hypothetical: it is what the scrub-placement
   * spike hit the moment the cursor footer stopped rendering.
   *
   * This replaces two guesses that were doing the same job by coincidence — `resize()` calls on
   * `load` and `dataloading`, each gated on the canvas being exactly 800 or 400 pixels wide.
   * They fired when a mid-init canvas happened to match one of those numbers and did nothing at
   * any other size, which is why the symptom came and went. A `ResizeObserver` on the element
   * Mapbox actually renders into needs no such number.
   *
   * `requestAnimationFrame` coalesces the callback to one resize per frame: a pointer-driven
   * chart drag fires the observer on every frame of the gesture, and `resize()` re-reads layout
   * and repaints.
   */
  useEffect(() => {
    const element = mapContainer.current;
    if (!element) return;
    let frame: number | null = null;
    const observer = new ResizeObserver(() => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        map.current?.resize();
      });
    });
    observer.observe(element);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  if (!webGlSupported) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface p-6 text-center">
        <div>
          <h3 className="text-lg font-semibold text-status-alert">Map Unavailable</h3>
          <p className="mt-2 text-sm text-content-secondary">
            Your browser does not support WebGL, which is required to display the map. <br />
            Please update your browser or use the latest version of Chrome.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-hidden bg-surface-raised">
      {/* The Clouds/PV layer toggles and the satellite channel select used to render here —
          moved to `map-layer-controls.tsx`, mounted inside the consolidated top-right panel
          (Phase 6 followup, Track I). This component keeps the fetch/decode pipeline, since it
          needs the live Mapbox instance; `showCloudLayer`/`activeChannel`/`showPvLayer` were
          already global state for the same cross-component reason, and `isSatelliteLoading`/
          `satelliteError` joined them so the panel can read what this effect is doing. */}
      <div className="absolute top-0 left-0 z-10 p-4 min-w-[20rem] w-full flex flex-col gap-1 pointer-events-none">
        <div className="pointer-events-auto">{controlOverlay(map)}</div>
      </div>

      <div ref={mapContainer} id={`Map-${title}`} data-title={title} className="h-full w-full" />
      <div className="map-overlay top">{children}</div>
    </div>
  );
};

export default Map;
