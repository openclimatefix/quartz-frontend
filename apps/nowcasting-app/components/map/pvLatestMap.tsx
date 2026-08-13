import React, { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, { LngLatLike } from "mapbox-gl";

import { FailedStateMap, LoadStateMap, Map } from "./";
import { ActiveUnit, MAP_TITLE_FORECAST } from "./types";
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

const PvLatestMap: React.FC<PvLatestMapProps> = ({ className, activeUnit, setActiveUnit }) => {
  const [selectedISOTime] = useGlobalState("selectedISOTime");
  const country = useFocusedCountry();
  const [showConstraints] = useGlobalState("showConstraints");
  const [showPvLayer] = useGlobalState("showPvLayer");

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
    const map: HTMLDivElement | null = document.querySelector(`#Map-${MAP_TITLE_FORECAST}`);
    if (map) {
      setActiveUnitOnMap(map, activeUnit);
    }
  }, [activeUnit]);

  // Capacity per country, not one figure: the "% of national" popup on an NL province must
  // divide by NL's installed capacity, and with both countries drawn a single value would
  // silently report NL regions as a percentage of GB.
  const capacityByCountryRef = useRef(capacityByCountry);
  capacityByCountryRef.current = capacityByCountry;

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

  // The ten-times MW bands belong to the client-side rollups (GB's DNO / NG zone). That is a
  // branch on the level's *kind*, not on its name — and since each drawn country is on its
  // own level it is now a per-FEATURE fact rather than a per-map one, carried as feature
  // state and read inside the expression. See `feature-state.ts`.
  const fillOpacity = useMemo(() => fillOpacityExpression(activeUnit), [activeUnit]);
  const fillColor = useMemo(() => fillColorExpression(activeUnit), [activeUnit]);

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
          "fill-color": fillColor,
          "fill-opacity": fillOpacity
        }
      });
      appliedPaintRef.current = fillOpacity;

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
            const featureCountry = String(
              properties?.[REGION_COUNTRY_PROPERTY] ?? ""
            ).toUpperCase();
            const nationalCapacity = capacityByCountryRef.current[featureCountry] ?? 0;
            actualValue =
              nationalCapacity > 0 ? ((capacity / nationalCapacity) * 100).toFixed(1) : "-";
            forecastValue = "-";
            unit = "MW";
          }

          let actualAndForecastSection = `<span class="text-2xs uppercase tracking-wide text-mapbox-black-300">Actual / Forecast</span>
              <div>
                <span class="">${actualValue}</span>  /
                <span class="text-ocf-yellow">${forecastValue}</span>  <span class="text-2xs text-mapbox-black-300">${unit}</span>
              </div>`;
          if (currentActiveUnit === ActiveUnit.capacity) {
            actualAndForecastSection = `<span class="text-2xs uppercase tracking-wide text-mapbox-black-300">% of National</span>
            <div><span>${actualValue}</span> <span class="text-2xs text-mapbox-black-300">%</span></div>`;
          }

          const popupContent = `<div class="flex flex-col min-w-[16rem] text-white">
          <div class="flex justify-between gap-3 items-center mb-1">
            <div class="text-sm font-semibold">${state.label || ""}</div>
            <div class="text-xs text-mapbox-black-300">${properties?.GSPs || ""}</div>
          </div>
          <div class="flex justify-between items-center">

            <div class="flex flex-col text-xs">
              <span class="text-2xs uppercase tracking-wide text-mapbox-black-300">Capacity</span>
              <div><span>${capacity.toFixed(
                0
              )}</span> <span class="text-2xs text-mapbox-black-300">MW</span></div>
            </div>
            <div class="flex flex-col text-xs items-end">
              ${actualAndForecastSection}
            </div>
          </div>
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
    } else if (appliedPaintRef.current !== fillOpacity) {
      // Only when the unit or the aggregation band changed. The `Map` wrapper re-invokes this
      // on every render, so an unguarded pair of `setPaintProperty` calls would re-validate
      // the style on every scrub tick for no reason.
      map.setPaintProperty("latestPV-forecast", "fill-color", fillColor);
      map.setPaintProperty("latestPV-forecast", "fill-opacity", fillOpacity);
      appliedPaintRef.current = fillOpacity;
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
            controlOverlay={() => (
              <CountryCoverageBanner countryStatus={countryStatus} metric="value" />
            )}
            title={MAP_TITLE_FORECAST}
          ></Map>
        </>
      }
    </div>
  );
};

export default PvLatestMap;
