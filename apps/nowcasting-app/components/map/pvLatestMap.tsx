import React, { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, { LngLatLike } from "mapbox-gl";

import { FailedStateMap, LoadStateMap, Map } from "./";
import { ActiveUnit, MAP_TITLE_MAIN } from "./types";
import useGlobalState from "../helpers/globalState";
import { useFocusedCountry } from "../../hooks/data";
import { getCountryConfig } from "../../config/countries";
import { loadGeoAsset } from "../../lib/geo/assets";
import { theme } from "../../tailwind.config";
import {
  getActiveUnitFromMap,
  getBoundingBoxFromPoint,
  safelyUpdateMapData,
  setActiveUnitOnMap
} from "../helpers/mapUtils";
import throttle from "lodash/throttle";
import Spinner from "../icons/spinner";
import { FeatureCollection } from "geojson";
import * as turf from "@turf/turf";
import useEnabledCountryMapData from "./use-enabled-country-map-data";
import {
  PV_SOURCE_ID,
  applyFeatureStates,
  deltaFillColorExpression,
  deltaFillOpacityExpression,
  fillColorExpression,
  fillOpacityExpression
} from "./feature-state";
import { FEATURE_KEY_PROPERTY, REGION_COUNTRY_PROPERTY } from "./country-features";
import CountryCoverageBanner from "./country-coverage-banner";
import type { MapFeatureState } from "../helpers/data";

const orange = theme.extend.colors["ocf-orange"].DEFAULT;

/**
 * What the PV source is created with, before any boundary file has arrived.
 *
 * Geometry became asynchronous in Phase 5, and the source is added **unconditionally** with
 * this rather than being created once geometry exists. That is not defensiveness: layer
 * order in Mapbox is creation order, and `map.tsx` inserts the satellite raster layers
 * *beneath* whichever of the PV layers already exists (`getSatelliteBeforeId`). A source
 * created conditionally means the PV layers are created late, after the satellite layers,
 * and the yellow forecast fill ends up under the clouds instead of over them — intermittent,
 * dependent on network timing, and invisible until someone turns clouds on.
 *
 * Module-level so the identity is stable: `appliedGeometryRef` compares by identity to
 * decide whether `setData` is needed.
 */
const EMPTY_GEOMETRY: FeatureCollection = { type: "FeatureCollection", features: [] };

type PvLatestMapProps = {
  className?: string;
  activeUnit: ActiveUnit;
  setActiveUnit: Dispatch<SetStateAction<ActiveUnit>>;
};

/**
 * The dashboard's map — forecast fill or delta fill, one Mapbox instance either way.
 *
 * `deltaMap.tsx` used to be a second component, swapped in by `pages/index.tsx` when a
 * comparison was selected. Each owned its own `<Map>`, so every switch constructed a
 * `new mapboxgl.Map`: the GL context, the source, the parsed boundary geometry and any decoded
 * satellite frames were torn down and rebuilt, which is the flash Brad described. They were
 * never two maps — they agreed on the data hook, the source id, all three layer ids and the
 * fact that both already updated paint through `setPaintProperty`. They were one map with two
 * paint configurations, split by history.
 *
 * So `comparison` selects the paint expressions and adds a line to the popup, and nothing else
 * about the instance changes. What the merge buys beyond the flash is everything the delta view
 * was missing by accident rather than by intent (contract §2 says delta "differs by *what the
 * map's fill encodes*", which makes the rest accident by definition): clouds, the constraints
 * overlay, the PV fill toggle and a free aggregation level all now work in both modes, because
 * they belong to the instance rather than to the encoding.
 */
const PvLatestMap: React.FC<PvLatestMapProps> = ({ className, activeUnit, setActiveUnit }) => {
  const [selectedISOTime] = useGlobalState("selectedISOTime");
  const country = useFocusedCountry();
  const [showConstraints] = useGlobalState("showConstraints");
  const [showPvLayer] = useGlobalState("showPvLayer");
  // The one thing that differs between the two modes. `null` is the forecast fill; any preset
  // is the delta fill (contract §2).
  const [comparison] = useGlobalState("comparison");
  const isDelta = comparison !== null;

  const showConstraintsRef = useRef(showConstraints);
  useEffect(() => {
    showConstraintsRef.current = showConstraints;
  }, [showConstraints]);

  const mapRef = useRef<mapboxgl.Map | null>(null);

  // Every ENABLED country, not just the focused one (contract §1/§3). One instance of the
  // value pipeline per country, merged into one source; `loaders` are those instances and
  // must be rendered. See `use-enabled-country-map-data.tsx`.
  const {
    featureStates,
    geometry,
    capacityByCountry,
    observerLabelByCountry,
    hasValues,
    isLoading,
    error,
    loaders,
    countryStatus
  } = useEnabledCountryMapData(selectedISOTime);

  // The network constraint overlay. Fetched rather than imported since Phase 5 — it was
  // 430 KB of GeoJSON in the bundle of every page that imports this module, for a layer that
  // is off by default. The URL is the registry's, so a country with no constraints file
  // simply never fetches one.
  const constraintsUrl = getCountryConfig(country)?.overlays.find(
    (overlay) => overlay.id === "constraints"
  )?.url;
  const [boundariesData, setBoundariesData] = useState<FeatureCollection | undefined>(undefined);
  useEffect(() => {
    if (!constraintsUrl) {
      setBoundariesData(undefined);
      return;
    }
    let cancelled = false;
    loadGeoAsset<FeatureCollection>(constraintsUrl)
      .then((data) => {
        if (!cancelled) setBoundariesData(data);
      })
      // A missing overlay must not take the map down with it: the constraints layer is
      // decoration over the forecast, and the forecast is the page.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [constraintsUrl]);

  // The last geometry and value set actually pushed to Mapbox. Geometry is handed to
  // `setData` only when its identity changes — i.e. when the aggregation level or the region
  // list moves, never when a value does. Values go out through `setFeatureState`.
  const appliedGeometryRef = useRef<FeatureCollection | null>(null);
  const appliedStatesRef = useRef<Map<string | number, MapFeatureState> | null>(null);
  const statesRef = useRef(featureStates);
  statesRef.current = featureStates;
  const appliedPaintRef = useRef<unknown>(null);
  // Set on every `addSource`/`setData`, cleared by the first `sourcedata` that reports the
  // source loaded. `setData` is asynchronous and `isSourceLoaded` can still be true for the
  // *previous* data for a tick, so an apply made immediately after it can succeed against
  // geometry that is about to be replaced — and Mapbox drops the state when the new data
  // lands. This forces exactly one re-apply per geometry load. Re-applying is idempotent.
  const pendingGeometryReloadRef = useRef(false);
  const constraintHandlersRef = useRef(false);

  useEffect(() => {
    // Add unit to map container so that it can be accessed by popup in the map event listeners
    const map: HTMLDivElement | null = document.querySelector(`#Map-${MAP_TITLE_MAIN}`);
    if (map) {
      setActiveUnitOnMap(map, activeUnit);
    }
  }, [activeUnit]);

  // Capacity per country, not one figure: the "% of national" popup on an NL province must
  // divide by NL's installed capacity, and with both countries drawn a single value would
  // silently report NL regions as a percentage of GB.
  const capacityByCountryRef = useRef(capacityByCountry);
  capacityByCountryRef.current = capacityByCountry;

  // Same shape, same reason as capacity above: the popup names the observer its "actual" came
  // from, and that is a per-country fact. Through a ref because the popup handler is built
  // once, on the first effect run, and closes over whatever it can see at that moment.
  const observerLabelByCountryRef = useRef(observerLabelByCountry);
  observerLabelByCountryRef.current = observerLabelByCountry;

  // Same reason again: the popup handler is registered once, on the effect run that creates the
  // fill layer, so which mode is showing has to reach it through a ref rather than a closure.
  // The unit does not need one — it is read off the container's data attribute at hover time
  // (`getActiveUnitFromMap`), which is what that attribute exists for.
  const isDeltaRef = useRef(isDelta);
  isDeltaRef.current = isDelta;

  // Toggle constraints visibility on map
  useEffect(() => {
    if (mapRef.current) {
      safelyUpdateMapData(mapRef.current, (m) => {
        if (m.getLayer("boundary-data")) {
          m.setLayoutProperty("boundary-data", "visibility", showConstraints ? "visible" : "none");
        }
        if (m.getLayer("boundary-data-labels")) {
          m.setLayoutProperty(
            "boundary-data-labels",
            "visibility",
            showConstraints ? "visible" : "none"
          );
        }
      });
    }
  }, [showConstraints]);

  // The two paint configurations, as one memo.
  //
  // Forecast: the ten-times MW bands belong to the client-side rollups (GB's DNO / NG zone).
  // That is a branch on the level's *kind*, not on its name — and since each drawn country is
  // on its own level it is a per-FEATURE fact rather than a per-map one, carried as feature
  // state and read inside the expression. See `feature-state.ts`.
  //
  // Delta: the sequential ramp becomes a diverging one, and both expressions step on the same
  // bucket field, so they are built from one flag and must be pushed together — setting only
  // the colour would draw percentage hues at megawatt strengths.
  //
  // One object rather than two values so `appliedPaintRef` has a single identity to compare:
  // with a second axis (the mode) feeding the same two expressions, guarding on the opacity
  // alone would have missed any change that moved the colour and not the opacity.
  const paint = useMemo(() => {
    if (isDelta) {
      // Capacity cannot reach here — `setComparison` moves the active unit off it when a
      // comparison is selected, and `UnitToggle` greys it out for as long as one is. The
      // `=== percentage` test therefore falls back to MW as a defensive default, not as a
      // claim that capacity means megawatts.
      const normalized = activeUnit === ActiveUnit.percentage;
      return {
        color: deltaFillColorExpression(normalized),
        opacity: deltaFillOpacityExpression(normalized)
      };
    }
    return { color: fillColorExpression(activeUnit), opacity: fillOpacityExpression(activeUnit) };
  }, [isDelta, activeUnit]);

  // Create a popup, but don't add it to the map yet.
  const popup = useMemo(() => {
    return new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      anchor: "bottom-right",
      maxWidth: "none"
    });
  }, []);

  const addOrUpdateMapData = (map: mapboxgl.Map) => {
    //////////////////////////
    // FORECAST DATA LAYERS //
    //////////////////////////
    const forecastSource = map.getSource(PV_SOURCE_ID) as unknown as mapboxgl.GeoJSONSource;

    // Undefined geometry is the pre-arrival state, not an absence of data. It draws as an
    // empty collection so the source and its three layers exist from the first frame.
    const data = geometry ?? EMPTY_GEOMETRY;

    if (!forecastSource) {
      map.addSource(PV_SOURCE_ID, {
        type: "geojson",
        data,
        // The country-qualified key, not the bare region id: one source carries every enabled
        // country and GB's `5` is not Germany's `5`. See `country-features.ts`.
        promoteId: FEATURE_KEY_PROPERTY
      });
      appliedGeometryRef.current = data;
      appliedStatesRef.current = null;
      pendingGeometryReloadRef.current = true;
    } else if (appliedGeometryRef.current !== data) {
      // Geometry genuinely changed (the boundary file landed, the aggregation level moved, or
      // the region list arrived). This is the only path that re-parses boundaries; a scrub
      // tick never reaches it.
      forecastSource.setData(data);
      appliedGeometryRef.current = data;
      appliedStatesRef.current = null;
      pendingGeometryReloadRef.current = true;
    }

    // Feature state is (re)applied whenever EITHER side moved — values or geometry. Clearing
    // `appliedStatesRef` above is what makes the geometry side count: a value set that
    // arrived while the boundary file was still in flight was applied to an empty source and
    // silently dropped by Mapbox, and this is what puts it back. `applyFeatureStates`
    // returning false (source not loaded yet) leaves the ref alone so the `sourcedata`
    // handler below retries.
    if (appliedStatesRef.current !== statesRef.current) {
      if (applyFeatureStates(map, statesRef.current, appliedStatesRef.current)) {
        appliedStatesRef.current = statesRef.current;
      }
    }

    const pvForecastLayer = map.getLayer("latestPV-forecast");
    if (!pvForecastLayer) {
      map.addLayer({
        id: "latestPV-forecast",
        type: "fill",
        source: PV_SOURCE_ID,
        layout: { visibility: "visible" },
        paint: {
          "fill-color": paint.color,
          "fill-opacity": paint.opacity
        }
      });
      appliedPaintRef.current = paint;

      // Also add map event listeners but only the first time
      const popupFunction = throttle(
        (e) => {
          const bbox = getBoundingBoxFromPoint(e.point);
          const overBoundary = map.queryRenderedFeatures(bbox, { layers: ["boundary-data"] });
          if (overBoundary.length) return; // let the boundary handler handle the popup

          // Change the cursor style as a UI indicator.
          map.getCanvas().style.cursor = "pointer";
          const currentActiveUnit = getActiveUnitFromMap(map);

          const feature = e.features?.[0];
          if (!feature) return;
          const properties = feature.properties;
          const state = (feature.state ?? {}) as Partial<MapFeatureState>;
          const capacity = state.capacity ?? 0;

          // "not published yet", "reported nothing" and "zero" are three different answers
          // and the popup says which one it is rather than printing 0 for all three.
          const forecastText =
            state.dataState === "value"
              ? (state.power ?? 0).toFixed(0)
              : state.dataState === "no-data"
              ? "no data"
              : "awaiting";
          const forecastPercentText =
            state.dataState === "value" ? ((state.normalized ?? 0) * 100).toFixed(0) : forecastText;
          const actualText = state.actual === null || state.actual === undefined ? "-" : "";

          // Hoisted out of the capacity branch, which used to be the only thing that needed it:
          // the observer label is per country too, so every unit needs to know whose region
          // this is.
          const featureCountry = String(properties?.[REGION_COUNTRY_PROPERTY] ?? "").toUpperCase();
          // What the left-hand number actually is. Falls back to "Actual" only while the
          // manifest is still in flight — never as a permanent name for it, which is the whole
          // point of the change.
          const actualLabel = observerLabelByCountryRef.current[featureCountry] ?? "Actual";

          let actualValue = "";
          let forecastValue = "";
          let unit = "";
          if (currentActiveUnit === ActiveUnit.MW) {
            actualValue = actualText || (state.actual as number).toFixed(0);
            forecastValue = forecastText;
            unit = "MW";
          } else if (currentActiveUnit === ActiveUnit.percentage) {
            actualValue =
              actualText ||
              (capacity > 0 ? (((state.actual as number) / capacity) * 100).toFixed(0) : "-");
            forecastValue = forecastPercentText;
            unit = "%";
          } else if (currentActiveUnit === ActiveUnit.capacity) {
            // This region's own country's national capacity, off the feature.
            const nationalCapacity = capacityByCountryRef.current[featureCountry] ?? 0;
            actualValue =
              nationalCapacity > 0 ? ((capacity / nationalCapacity) * 100).toFixed(1) : "-";
            forecastValue = "-";
            unit = "MW";
          }

          // Was "Actual / Forecast", which named neither of GB's two observers and so let the
          // in-day estimate read as "the actual". The heading is the stream's own label now.
          let actualAndForecastSection = `<span class="text-2xs uppercase tracking-wide text-content-muted">${actualLabel} / Forecast</span>
              <div>
                <span class="">${actualValue}</span>  /
                <span class="text-solar">${forecastValue}</span>  <span class="text-2xs text-content-muted">${unit}</span>
              </div>`;
          if (currentActiveUnit === ActiveUnit.capacity) {
            actualAndForecastSection = `<span class="text-2xs uppercase tracking-wide text-content-muted">% of National</span>
            <div><span>${actualValue}</span> <span class="text-2xs text-content-muted">%</span></div>`;
          }

          // The delta line, in delta mode only.
          //
          // One popup rather than two — the merged map has one hover target, and the old delta
          // popup showed *only* the difference, so reading a delta meant knowing neither number
          // it was the difference of. This is the forecast popup plus a line, which is why the
          // forecast mode is unchanged: the difference is only worth a row when the user has
          // asked to see differences.
          //
          // No delta is a different statement from a delta of zero: a future slot, or a region
          // whose forecast or observed value has not published, has nothing to compare.
          // Reported in whichever unit the toggle is on, and only that one — showing both would
          // be the safer-looking choice and the wrong one, since the point of the unit control
          // is that the user has said which question they are asking.
          let deltaSection = "";
          if (isDeltaRef.current) {
            const asPercentage = currentActiveUnit === ActiveUnit.percentage;
            const deltaValue = asPercentage ? (state.deltaNormalized ?? 0) * 100 : state.delta ?? 0;
            const deltaBody = !state.hasDelta
              ? `<span class="text-content-muted">no delta yet</span>`
              : `<span class="font-bold">${
                  deltaValue > 0
                    ? `<span class="up-arrow"></span>`
                    : `<span class="down-arrow"></span>`
                }</span>
                <span class="mr-1 ${
                  deltaValue > 0 ? "text-ocf-delta-900" : "text-ocf-delta-100"
                }">${deltaValue.toFixed(1)}</span><small class="text-xs">${
                  asPercentage ? "% of capacity" : "MW"
                }</small>`;

            // Which observed stream the delta is measured against, and in which direction. The
            // order matters and is easy to get backwards (it was, on first writing): the value
            // is `generationMw - forecastMw` (`helpers/data.ts`), so **positive means the actual
            // came in above the forecast** — an under-forecast. Stated as the subtraction itself
            // rather than as "vs", because "forecast vs actual" does not say which way a `+`
            // points and the colour ramp cannot say it either.
            const deltaCaption = observerLabelByCountryRef.current[featureCountry]
              ? `${observerLabelByCountryRef.current[featureCountry]} &minus; forecast`
              : "Difference";
            deltaSection = `<div class="mt-1 flex items-center justify-between gap-3 border-t border-content/10 pt-1 text-xs">
            <span class="text-2xs uppercase tracking-wide text-content-muted">${deltaCaption}</span>
            <div>${deltaBody}</div>
          </div>`;
          }

          const popupContent = `<div class="flex flex-col min-w-[16rem] text-content">
          <div class="flex justify-between gap-3 items-center mb-1">
            <div class="text-sm font-semibold">${state.label || ""}</div>
            <div class="text-xs text-content-muted">${properties?.GSPs || ""}</div>
          </div>
          <div class="flex justify-between items-center">

            <div class="flex flex-col text-xs">
              <span class="text-2xs uppercase tracking-wide text-content-muted">Capacity</span>
              <div><span>${capacity.toFixed(
                0
              )}</span> <span class="text-2xs text-content-muted">MW</span></div>
            </div>
            <div class="flex flex-col text-xs items-end">
              ${actualAndForecastSection}
            </div>
          </div>
          ${deltaSection}
        </div>`;

          // Populate the popup and set its coordinates
          // based on the feature found.
          popup.setHTML(popupContent).trackPointer().addTo(map);
        },
        32,
        {}
      );
      map.on("mousemove", "latestPV-forecast", popupFunction);

      map.on("mouseleave", "latestPV-forecast", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });

      // A GeoJSON source drops feature state set before it has finished loading, so re-apply
      // once it reports loaded. Without this the very first paint after a geometry swap is
      // unstyled and stays that way until the next value change — which, now that the
      // boundary file arrives over the network well after the values do, is the normal case
      // rather than a corner one.
      map.on("sourcedata", (e) => {
        if (e.sourceId !== PV_SOURCE_ID || !e.isSourceLoaded) return;
        if (pendingGeometryReloadRef.current) {
          pendingGeometryReloadRef.current = false;
          appliedStatesRef.current = null;
        }
        if (appliedStatesRef.current === statesRef.current) return;
        if (applyFeatureStates(map, statesRef.current, appliedStatesRef.current)) {
          appliedStatesRef.current = statesRef.current;
        }
      });
    } else if (appliedPaintRef.current !== paint) {
      // Only when the unit or the encoding changed. The `Map` wrapper re-invokes this on every
      // render, so an unguarded pair of `setPaintProperty` calls would re-validate the style on
      // every scrub tick for no reason.
      //
      // **This is the whole of switching between forecast and delta.** Two `setPaintProperty`
      // calls against layers that already exist, over a source that is never touched — no new
      // GL context, no re-parsed geometry, no re-decoded satellite frames, and the user's pan
      // and zoom left exactly where they were.
      map.setPaintProperty("latestPV-forecast", "fill-color", paint.color);
      map.setPaintProperty("latestPV-forecast", "fill-opacity", paint.opacity);
      appliedPaintRef.current = paint;
    }

    const pvForecastBordersLayer = map.getLayer("latestPV-forecast-borders");
    if (!pvForecastBordersLayer) {
      map.addLayer({
        id: "latestPV-forecast-borders",
        type: "line",
        source: PV_SOURCE_ID,
        paint: {
          "line-color": "#ffffff",
          "line-width": 0.6,
          "line-opacity": 0.2
        }
      });
    }

    const pvForecastSelectBordersLayer = map.getLayer("latestPV-forecast-select-borders");
    if (!pvForecastSelectBordersLayer) {
      map.addLayer({
        id: "latestPV-forecast-select-borders",
        type: "line",
        source: PV_SOURCE_ID,
        paint: {
          "line-color": "#ffffff",
          "line-width": 2,
          "line-opacity": 1
        },
        filter: ["in", FEATURE_KEY_PROPERTY, ""]
      });
    }

    //////////////////////////////////////
    // CONSTRAINT BOUNDARIES DATA LAYER //
    //////////////////////////////////////
    if (boundariesData) {
      let boundarySource = map.getSource("boundary-data") as mapboxgl.GeoJSONSource;
      if (!boundarySource) {
        map.addSource("boundary-data", {
          type: "geojson",
          data: boundariesData as FeatureCollection,
          promoteId: "id"
        });
      }

      if (!map.getLayer("boundary-data")) {
        map.addLayer({
          id: "boundary-data",
          type: "line",
          source: "boundary-data",
          filter: ["==", ["get", "Constraint"], "TBC"],
          layout: { visibility: showConstraintsRef ? "visible" : "none" },
          paint: {
            "line-color": ["case", ["==", ["get", "Constraint"], "TBC"], orange, orange],
            "line-width": ["case", ["==", ["get", "Constraint"], "TBC"], 2, 1],
            "line-opacity": ["case", ["==", ["get", "Constraint"], "TBC"], 1, 0.5]
          }
        });
      }
      if (!map.getLayer("boundary-data-labels")) {
        map.addLayer({
          id: "boundary-data-labels",
          type: "symbol",
          source: "boundary-data",
          layout: {
            "text-field": "{id}",
            "text-size": 12,
            "symbol-placement": "line",
            visibility: showConstraintsRef ? "visible" : "none"
          },
          paint: {
            "text-color": ["case", ["==", ["get", "Constraint"], "TBC"], "#fff", "transparent"]
          }
        });
      }

      // set initial visibility from global state
      map.setLayoutProperty("boundary-data", "visibility", showConstraints ? "visible" : "none");
      map.setLayoutProperty(
        "boundary-data-labels",
        "visibility",
        showConstraintsRef.current ? "visible" : "none"
      );

      // Registered once. `Map` re-invokes this whole function on every render, so an
      // unguarded `map.on` accumulated a listener per render — harmless-looking, and it
      // meant every mousemove ran the throttled `queryRenderedFeatures` N times. Now that
      // the overlay arrives asynchronously the block is reached later but no more often, so
      // the guard is what keeps it at one.
      if (!constraintHandlersRef.current) {
        constraintHandlersRef.current = true;
        map.on(
          "mousemove",
          "boundary-data",
          throttle((e) => {
            const bbox = getBoundingBoxFromPoint(e.point);
            const features = map.queryRenderedFeatures(bbox, {
              layers: ["boundary-data"]
            });
            if (features && features.length > 0) {
              const feature = features[0];
              const coordinates = (
                "coordinates" in feature.geometry ? feature.geometry.coordinates[0] : [0, 0]
              ) as LngLatLike;
              const nearestPoint =
                coordinates && feature.geometry.type === "LineString"
                  ? turf.nearestPointOnLine(feature.geometry, [e.lngLat.lng, e.lngLat.lat])
                  : null;
              popup
                .setLngLat((nearestPoint?.geometry.coordinates as LngLatLike) || [0, 50])
                .setHTML(feature.properties?.id)
                .addTo(map);
            } else {
              popup.remove();
            }
          }, 32)
        );
        map.on("mouseleave", "boundary-data", () => {
          popup.remove();
        });
      }
    }
  };

  // Debounce the spinner so it only shows for data loads, not the brief rerender that happens
  // when flipping between already-cached timesteps. Scrubbing no longer refetches at all, so
  // in practice this only fires on the first load and on a window roll-over.
  const [showSpinner, setShowSpinner] = useState(false);
  useEffect(() => {
    if (!isLoading) {
      setShowSpinner(false);
      return;
    }
    const t = setTimeout(() => setShowSpinner(true), 700);
    return () => clearTimeout(t);
  }, [isLoading]);

  // Gated on `hasValues`, not `featureStates.size` — see the field's doc comment. The old guard
  // could not fire once `/regions` had resolved, which is every case that matters.
  //
  // `loaders` is rendered on BOTH arms. It carries the per-country data hooks, so dropping it
  // on the failure arm would unmount the pipeline that produced the error — clearing the
  // error, re-rendering the normal arm, remounting, re-failing: a flicker loop rather than a
  // failure state.
  if (error && !hasValues) {
    return (
      <div className={`pv-map relative h-full w-full ${className}`}>
        {loaders}
        <FailedStateMap error="Failed to load" />
      </div>
    );
  }

  return (
    <div className={`pv-map relative h-full w-full ${className}`}>
      {
        <>
          {/* One per enabled country; they render nothing and exist for their hooks. */}
          {loaders}
          {showSpinner && showPvLayer && (
            <LoadStateMap>
              <Spinner />
            </LoadStateMap>
          )}
          <Map
            loadDataOverlay={(map: { current: mapboxgl.Map }) => {
              mapRef.current = map.current;
              safelyUpdateMapData(map.current, addOrUpdateMapData);
            }}
            updateData={{
              newData: true,
              updateMapData: (map) => {
                mapRef.current = map;
                safelyUpdateMapData(map, addOrUpdateMapData);
              }
            }}
            // The corner's own time readout went here (Wave 4) — the shell's cursor readout
            // (`components/shell/cursor-readout.tsx`) already says it, better, once for both
            // panes. `sitesMap.tsx` keeps its own: `/sites` has no shell cursor readout to
            // duplicate. Reused (Phase 6 followup, Track M) for the per-country coverage
            // banner — quiet unless an enabled country has nothing published at this instant,
            // or nothing at all.
            //
            // The metric follows the encoding: a country can have a published forecast and
            // still have no computable delta, and on the delta fill "no delta" is the common
            // reading rather than the exception, so the banner has to be answering about the
            // quantity actually on screen.
            controlOverlay={() => (
              <CountryCoverageBanner
                countryStatus={countryStatus}
                metric={isDelta ? "delta" : "value"}
              />
            )}
            title={MAP_TITLE_MAIN}
          ></Map>
        </>
      }
    </div>
  );
};

export default PvLatestMap;
