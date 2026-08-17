import React, { Dispatch, SetStateAction, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";

import { FailedStateMap, LoadStateMap, Map } from "./";
import { ActiveUnit, MAP_TITLE_DELTA } from "./types";
import useGlobalState from "../helpers/globalState";
import { safelyUpdateMapData } from "../helpers/mapUtils";
import { FeatureCollection } from "geojson";
import useEnabledCountryMapData from "./use-enabled-country-map-data";
import {
  PV_SOURCE_ID,
  applyFeatureStates,
  deltaFillColorExpression,
  deltaFillOpacityExpression
} from "./feature-state";
import { FEATURE_KEY_PROPERTY, REGION_COUNTRY_PROPERTY } from "./country-features";
import CountryCoverageBanner from "./country-coverage-banner";
import type { MapFeatureState } from "../helpers/data";

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

const DeltaMap: React.FC<DeltaMapProps> = ({ className, activeUnit }) => {
  const [selectedISOTime] = useGlobalState("selectedISOTime");

  // `activeUnit` was declared in this component's props, passed by `pages/index.tsx` and then
  // dropped on the floor — the toggle read "%" while the map painted and reported megawatts, so
  // switching between the forecast and delta views silently changed the units of the numbers on
  // screen with the toggle unchanged. That is what made the two views look like they disagreed
  // about Swansea North (29% of capacity and 137 MW are the same reading).
  //
  // Capacity is deliberately folded in with MW rather than given a third behaviour: installed
  // capacity has no delta, so there is nothing for that unit to mean here.
  const showPercentage = activeUnit === ActiveUnit.percentage;

  // The delta view is single-region-level only. Rather than reading the user's stored level
  // (which `pages/index.tsx` forces to the finest one on entering this view anyway), take
  // each country's finest non-derived level directly — GB's `gsp`, NL's `province`. That is
  // the same rule `defaultLevelOf` encodes for the initial state, so the two cannot drift,
  // and it removes this file's dependence on `pages/index.tsx` doing the forcing. That is
  // what `finestLevel` asks the fan-out for, per country.
  const {
    featureStates,
    geometry,
    observerLabelByCountry,
    hasValues,
    isLoading,
    error,
    loaders,
    countryStatus
  } = useEnabledCountryMapData(selectedISOTime, { finestLevel: true });

  // The delta's B side, named. The whole fill on this map is `forecast − actual`, and until
  // now nothing on screen or in the popup said which observed stream that "actual" is — for GB
  // it is PV Live Estimated, never Updated. Per country because the popup reads one hovered
  // feature and both countries can be in frame. Through a ref for the same reason as
  // `pvLatestMap.tsx`: the handler below is built once.
  const observerLabelByCountryRef = useRef(observerLabelByCountry);
  observerLabelByCountryRef.current = observerLabelByCountry;
  // The popup handler below is built once, on the first effect run, so the unit reaches it the
  // same way the observer labels do.
  const showPercentageRef = useRef(showPercentage);
  showPercentageRef.current = showPercentage;

  const fillColor = useMemo(() => deltaFillColorExpression(showPercentage), [showPercentage]);
  // Built with the same flag as the colour: the two step on the same bucket field, and mixing
  // them would draw one scale's hue at the other scale's strength.
  const fillOpacity = useMemo(
    () => deltaFillOpacityExpression(showPercentage),
    [showPercentage]
  );

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
        // Country-qualified — see the same call in `pvLatestMap.tsx`.
        promoteId: FEATURE_KEY_PROPERTY
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
      appliedPaintRef.current = fillColor;

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
        // Reported in whichever unit the toggle is on, and only that one — showing both would
        // be the safer-looking choice and the wrong one, since the point of the unit control is
        // that the user has said which question they are asking.
        const asPercentage = showPercentageRef.current;
        const deltaValue = asPercentage ? (state.deltaNormalized ?? 0) * 100 : state.delta ?? 0;
        const deltaSection = !state.hasDelta
          ? `<span class="text-mapbox-black-300">no delta yet</span>`
          : `<span class="font-bold">${
              deltaValue > 0 ? `<span class="up-arrow"></span>` : `<span class="down-arrow"></span>`
            }</span>
              <span class="mr-1 ${
                deltaValue > 0 ? "text-ocf-delta-900" : "text-ocf-delta-100"
              }">${deltaValue.toFixed(1)}</span><small class="text-xs">${
              asPercentage ? "% of capacity" : "MW"
            }</small>`;

        // Which actual the delta is measured against, and in which direction. Only drawn once
        // the manifest has resolved it — an unnamed delta is what this map already showed, so
        // falling back to a guess would be worse than briefly showing nothing.
        //
        // The order matters and is easy to get backwards (it was, on first writing): the value
        // is `generationMw - forecastMw` (`helpers/data.ts`), so **positive means the actual
        // came in above the forecast** — an under-forecast. Stated in the popup as the
        // subtraction itself rather than as "vs", because "forecast vs actual" does not say
        // which way a `+` points and the colour ramp cannot say it either.
        const featureCountry = String(
          feature.properties?.[REGION_COUNTRY_PROPERTY] ?? ""
        ).toUpperCase();
        const observerLabel = observerLabelByCountryRef.current[featureCountry];
        const observerSection = observerLabel
          ? `<div class="mt-1 text-2xs uppercase tracking-wide text-mapbox-black-300">${observerLabel} &minus; forecast</div>`
          : "";

        const popupContent = `<div class="flex flex-col min-w-[16rem] text-white">
          <div class="flex justify-between mb-1">
            <div class="text-xs">${feature.properties?.GSPs || ""}</div>
          </div>
          <div class="flex justify-between text-base">
            <div class="text-ocf-yellow">${state.label || ""}</div>
            <div class="">${deltaSection}</div>
          </div>
          ${observerSection}
        </div>`;

        popup.setLngLat(e.lngLat).setHTML(popupContent).addTo(map);
      });

      map.on("mouseleave", "latestPV-forecast", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });
    } else if (appliedPaintRef.current !== fillColor) {
      // The `Map` wrapper re-invokes this on every render, so guard rather than re-validating
      // the style each tick. What now changes is the *unit*: both expressions are rebuilt
      // together when it does, and both must be pushed together — setting only the colour would
      // leave percentage hues drawn at megawatt strengths until something else forced a repaint.
      map.setPaintProperty("latestPV-forecast", "fill-color", fillColor);
      map.setPaintProperty("latestPV-forecast", "fill-opacity", fillOpacity);
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
        filter: ["in", FEATURE_KEY_PROPERTY, ""]
      });
    }
  };

  return (
    <div className={`delta-map relative h-full w-full ${className}`}>
      {/* Outside the three arms deliberately: these are the per-country data hooks, and an arm
          that dropped them would unmount the pipeline whose state chose the arm — the failure
          arm would clear its own error and flicker. */}
      {loaders}
      {/* Both gated on `hasValues`, not `featureStates.size` — see the field's doc comment. The
          loading arm had the same flaw as the error arm: feature states populate the moment
          `/regions` resolves, so the spinner vanished while the forecast was still in flight. */}
      {error && !hasValues ? (
        <FailedStateMap error="Failed to load" />
      ) : isLoading && !hasValues ? (
        // No time readout here any more (Wave 4) — see the comment on `controlOverlay` below.
        <LoadStateMap>{null}</LoadStateMap>
      ) : (
        <Map
          loadDataOverlay={(map: { current: mapboxgl.Map }) =>
            safelyUpdateMapData(map.current, addOrUpdateFCData)
          }
          updateData={{
            newData: true,
            updateMapData: (map) => safelyUpdateMapData(map, addOrUpdateFCData)
          }}
          // The corner's own time readout went here (Wave 4) — the shell's cursor readout
          // (`components/shell/cursor-readout.tsx`) already says it, better, once for both
          // panes. Reused (Phase 6 followup, Track M) for the per-country coverage banner: a
          // country with no computable delta at this instant is the common case on this map —
          // "no delta" is the default reading, not the exception — and this corner is where the
          // reader is told which enabled country that is true for right now.
          controlOverlay={() => (
            <CountryCoverageBanner countryStatus={countryStatus} metric="delta" />
          )}
          title={MAP_TITLE_DELTA}
        ></Map>
      )}
    </div>
  );
};

export default DeltaMap;
