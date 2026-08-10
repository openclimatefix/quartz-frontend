import React, { Dispatch, SetStateAction, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";

import { FailedStateMap, LoadStateMap, Map } from "./";
import { ActiveUnit } from "./types";
import { VIEWS } from "../../constant";
import useGlobalState from "../helpers/globalState";
import { formatISODateStringHuman } from "../helpers/utils";
import { useCountryFormatting } from "../../hooks/data/use-country-format";
import { useAggregationLevels } from "../../hooks/data";
import { defaultLevelOf } from "../helpers/aggregationLevels";
import DeltaColorGuideBar from "./delta-color-guide-bar";
import { safelyUpdateMapData } from "../helpers/mapUtils";
import { FeatureCollection } from "geojson";
import dynamic from "next/dynamic";
import useMapRegionValues from "./use-map-region-values";
import { PV_SOURCE_ID, applyFeatureStates, deltaFillColorExpression } from "./feature-state";
import type { MapFeatureState } from "../helpers/data";

const ButtonGroup = dynamic(() => import("../../components/button-group"), { ssr: false });

type DeltaMapProps = {
  className?: string;
  activeUnit: ActiveUnit;
  setActiveUnit: Dispatch<SetStateAction<ActiveUnit>>;
};

/**
 * The source is created with this before any boundary file has arrived — unconditionally,
 * never once geometry exists. See the same constant in `pvLatestMap.tsx` for why: layer
 * order is creation order, and a late source puts the delta fill underneath the satellite
 * raster layers instead of over them.
 */
const EMPTY_GEOMETRY: FeatureCollection = { type: "FeatureCollection", features: [] };

const DeltaMap: React.FC<DeltaMapProps> = ({ className }) => {
  const [selectedISOTime] = useGlobalState("selectedISOTime");
  const { timezone, locale } = useCountryFormatting();

  // The delta view is single-region-level only. Rather than reading the user's stored level
  // (which `pages/index.tsx` forces to the finest one on entering this view anyway), take
  // the country's finest non-derived level directly — GB's `gsp`, NL's `province`. That is
  // the same rule `defaultLevelOf` encodes for the initial state, so the two cannot drift,
  // and it removes this file's dependence on `pages/index.tsx` doing the forcing.
  const levels = useAggregationLevels();
  const level = useMemo(() => defaultLevelOf(levels), [levels]);

  const { featureStates, geometry, hasValues, isLoading, error } = useMapRegionValues(
    level,
    selectedISOTime
  );

  const fillColor = useMemo(() => deltaFillColorExpression(), []);

  const appliedGeometryRef = useRef<FeatureCollection | null>(null);
  const appliedStatesRef = useRef<Map<string | number, MapFeatureState> | null>(null);
  const statesRef = useRef(featureStates);
  statesRef.current = featureStates;
  const appliedPaintRef = useRef<unknown>(null);
  // See `pvLatestMap.tsx`: forces one feature-state re-apply after each geometry load, since
  // `isSourceLoaded` can still report the previous data for a tick after `setData`.
  const pendingGeometryReloadRef = useRef(false);

  const addOrUpdateFCData = (map: mapboxgl.Map) => {
    const source = map.getSource(PV_SOURCE_ID) as unknown as mapboxgl.GeoJSONSource;
    const data = geometry ?? EMPTY_GEOMETRY;
    if (!source) {
      map.addSource(PV_SOURCE_ID, {
        type: "geojson",
        data,
        promoteId: "id"
      });
      appliedGeometryRef.current = data;
      appliedStatesRef.current = null;
      pendingGeometryReloadRef.current = true;
    } else if (appliedGeometryRef.current !== data) {
      source.setData(data);
      appliedGeometryRef.current = data;
      appliedStatesRef.current = null;
      pendingGeometryReloadRef.current = true;
    }

    // Values that arrived while the boundary file was still in flight were applied to an
    // empty source and dropped; clearing `appliedStatesRef` above is what re-applies them.
    if (appliedStatesRef.current !== statesRef.current) {
      if (applyFeatureStates(map, statesRef.current)) {
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
          "fill-opacity": 0.7
        }
      });
      appliedPaintRef.current = fillColor;

      map.on("sourcedata", (e) => {
        if (e.sourceId !== PV_SOURCE_ID || !e.isSourceLoaded) return;
        if (pendingGeometryReloadRef.current) {
          pendingGeometryReloadRef.current = false;
          appliedStatesRef.current = null;
        }
        if (appliedStatesRef.current === statesRef.current) return;
        if (applyFeatureStates(map, statesRef.current)) {
          appliedStatesRef.current = statesRef.current;
        }
      });

      // Create a popup, but don't add it to the map yet.
      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        anchor: "bottom-right",
        maxWidth: "none"
      });

      map.on("mousemove", "latestPV-forecast", (e) => {
        // Change the cursor style as a UI indicator.
        map.getCanvas().style.cursor = "pointer";

        const feature = e.features?.[0];
        if (!feature) return;
        const state = (feature.state ?? {}) as Partial<MapFeatureState>;

        // No delta is a different statement from a delta of zero: a future slot, or a region
        // whose forecast or generation has not published, has nothing to compare.
        const deltaSection = !state.hasDelta
          ? `<span class="text-mapbox-black-300">no delta yet</span>`
          : `<span class="font-bold">${
              (state.delta ?? 0) > 0
                ? `<span class="up-arrow"></span>`
                : `<span class="down-arrow"></span>`
            }</span>
              <span class="mr-1 ${
                (state.delta ?? 0) > 0 ? "text-ocf-delta-900" : "text-ocf-delta-100"
              }">${(state.delta ?? 0).toFixed(1)}</span><small class="text-xs">MW</small>`;

        const popupContent = `<div class="flex flex-col min-w-[16rem] text-white">
          <div class="flex justify-between mb-1">
            <div class="text-xs">${feature.properties?.GSPs || ""}</div>
          </div>
          <div class="flex justify-between text-base">
            <div class="text-ocf-yellow">${state.label || ""}</div>
            <div class="">${deltaSection}</div>
          </div>
        </div>`;

        popup.setLngLat(e.lngLat).setHTML(popupContent).addTo(map);
      });

      map.on("mouseleave", "latestPV-forecast", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });
    } else if (appliedPaintRef.current !== fillColor) {
      // The `Map` wrapper re-invokes this on every render; the delta ramp only ever changes
      // if the bucket thresholds do, so guard it rather than re-validating the style each tick.
      map.setPaintProperty("latestPV-forecast", "fill-color", fillColor);
      appliedPaintRef.current = fillColor;
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

    const pvForecastSelectLayer = map.getLayer("latestPV-forecast-select-borders");
    if (!pvForecastSelectLayer) {
      map.addLayer({
        id: "latestPV-forecast-select-borders",
        type: "line",
        source: PV_SOURCE_ID,
        paint: {
          "line-color": "#ffffff",
          "line-width": 2,
          "line-opacity": 1
        },
        filter: ["in", "id", ""]
      });
    }
  };

  return (
    <div className={`delta-map relative h-full w-full ${className}`}>
      {/* Both gated on `hasValues`, not `featureStates.size` — see the field's doc comment. The
          loading arm had the same flaw as the error arm: feature states populate the moment
          `/regions` resolves, so the spinner vanished while the forecast was still in flight. */}
      {error && !hasValues ? (
        <FailedStateMap error="Failed to load" />
      ) : isLoading && !hasValues ? (
        <LoadStateMap>
          <ButtonGroup
            rightString={formatISODateStringHuman(selectedISOTime || "", timezone, locale)}
          />
        </LoadStateMap>
      ) : (
        <Map
          loadDataOverlay={(map: { current: mapboxgl.Map }) =>
            safelyUpdateMapData(map.current, addOrUpdateFCData)
          }
          updateData={{
            newData: true,
            updateMapData: (map) => safelyUpdateMapData(map, addOrUpdateFCData)
          }}
          controlOverlay={(map: { current?: mapboxgl.Map }) => (
            <>
              <ButtonGroup
                rightString={formatISODateStringHuman(selectedISOTime || "", timezone, locale)}
              />
            </>
          )}
          title={VIEWS.DELTA}
        >
          <DeltaColorGuideBar />
        </Map>
      )}
    </div>
  );
};

export default DeltaMap;
