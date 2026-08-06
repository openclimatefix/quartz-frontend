import React, { Dispatch, SetStateAction, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";

import { FailedStateMap, LoadStateMap, Map } from "./";
import { ActiveUnit, NationalAggregation } from "./types";
import { VIEWS } from "../../constant";
import useGlobalState from "../helpers/globalState";
import { formatISODateStringHuman } from "../helpers/utils";
import { useCountryFormatting } from "../../hooks/data/use-country-format";
import { CombinedData, CombinedErrors } from "../types";
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
  /**
   * Accepted but no longer read — the delta is now computed from the v1 forecast and
   * generation period responses inside `useMapRegionValues`, which is also where the
   * "future slot has no delta" rule lives. `pages/index.tsx`'s `gspDeltas` memo is dead
   * weight for this view once its other consumers migrate.
   */
  combinedData: CombinedData;
  combinedErrors: CombinedErrors;
  activeUnit: ActiveUnit;
  setActiveUnit: Dispatch<SetStateAction<ActiveUnit>>;
};

/** The delta view is GSP-level only; `pages/index.tsx` forces the aggregation on view change. */
const DELTA_AGGREGATION = NationalAggregation.GSP;

const DeltaMap: React.FC<DeltaMapProps> = ({ className }) => {
  const [selectedISOTime] = useGlobalState("selectedISOTime");
  const { timezone, locale } = useCountryFormatting();

  const { featureStates, geometry, isLoading, error } = useMapRegionValues(
    DELTA_AGGREGATION,
    selectedISOTime
  );

  const fillColor = useMemo(() => deltaFillColorExpression(), []);

  const appliedGeometryRef = useRef<FeatureCollection | null>(null);
  const appliedStatesRef = useRef<Map<string | number, MapFeatureState> | null>(null);
  const statesRef = useRef(featureStates);
  statesRef.current = featureStates;
  const appliedPaintRef = useRef<unknown>(null);

  const addOrUpdateFCData = (map: mapboxgl.Map) => {
    const source = map.getSource(PV_SOURCE_ID) as unknown as mapboxgl.GeoJSONSource;
    if (!source) {
      map.addSource(PV_SOURCE_ID, {
        type: "geojson",
        data: geometry,
        promoteId: "id"
      });
      appliedGeometryRef.current = geometry;
      appliedStatesRef.current = null;
    } else if (appliedGeometryRef.current !== geometry) {
      source.setData(geometry);
      appliedGeometryRef.current = geometry;
      appliedStatesRef.current = null;
    }

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
      {error && !featureStates.size ? (
        <FailedStateMap error="Failed to load" />
      ) : isLoading && !featureStates.size ? (
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
