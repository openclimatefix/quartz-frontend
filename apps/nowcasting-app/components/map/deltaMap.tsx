import { SWRResponse } from "swr";

import React, { Dispatch, SetStateAction, useMemo } from "react";
import mapboxgl, { Expression } from "mapbox-gl";

import { FailedStateMap, LoadStateMap, Map, MeasuringUnit } from "./";
import { ActiveUnit, SelectedData } from "./types";
import { DELTA_BUCKET, VIEWS } from "../../constant";
import gspShapeData from "../../data/gsp_regions_20220314.json";
import useGlobalState from "../helpers/globalState";
import { formatISODateString, formatISODateStringHuman } from "../helpers/utils";
import {
  AllGspRealData,
  CombinedData,
  CombinedErrors,
  FcAllResData,
  ForecastValue,
  GspAllForecastData,
  GspDeltaValue,
  NationalNHourData,
  PvRealData
} from "../types";
import { theme } from "../../tailwind.config";
import ColorGuideBar from "./color-guide-bar";
import { FeatureCollection } from "geojson";
import DeltaColorGuideBar from "./delta-color-guide-bar";
import { safelyUpdateMapData } from "../helpers/mapUtils";
import { generateGeoJsonForecastData } from "../helpers/data";
import { components } from "../../types/quartz-api";
import dynamic from "next/dynamic";
const yellow = theme.extend.colors["ocf-yellow"].DEFAULT;
const ButtonGroup = dynamic(() => import("../../components/button-group"), { ssr: false });

type DeltaMapProps = {
  className?: string;
  combinedData: CombinedData;
  combinedErrors: CombinedErrors;
  activeUnit: ActiveUnit;
  setActiveUnit: Dispatch<SetStateAction<ActiveUnit>>;
};

const DeltaMap: React.FC<DeltaMapProps> = ({
  className,
  combinedData,
  combinedErrors,
  activeUnit
}) => {
  const [selectedISOTime] = useGlobalState("selectedISOTime");
  const [nationalAggregationLevel] = useGlobalState("nationalAggregationLevel");

  const latestForecastValue = 0;
  const isNormalized = activeUnit === ActiveUnit.percentage;
  const { gspDeltas } = combinedData;

  const forecastLoading = false;
  const initForecastData =
    combinedData?.allGspForecastData as components["schemas"]["OneDatetimeManyForecastValues"][];
  const forecastError = combinedErrors?.allGspForecastError;

  const generatedGeoJsonForecastData = useMemo(() => {
    return generateGeoJsonForecastData(initForecastData, selectedISOTime, combinedData, gspDeltas);
  }, [initForecastData, selectedISOTime, combinedData, gspDeltas]);

  const updateMapData = (map: mapboxgl.Map) => {
    const source = map.getSource("latestPV") as unknown as mapboxgl.GeoJSONSource;
    if (!source) {
      const { forecastGeoJson } = generateGeoJsonForecastData(
        initForecastData,
        selectedISOTime,
        combinedData,
        gspDeltas,
        nationalAggregationLevel
      );

      map.addSource("latestPV", {
        type: "geojson",
        data: forecastGeoJson
      });
    }
    if (generatedGeoJsonForecastData && source) {
      source?.setData(generatedGeoJsonForecastData.forecastGeoJson);
      map.setPaintProperty("latestPV-forecast", "fill-color", getFillColor("delta"));
    }
  };

  const getFillColor = (selectedData: string): Expression => [
    "let",
    "bucket",
    ["get", selectedData],
    [
      "case",
      ["<", ["to-number", ["var", "bucket"]], DELTA_BUCKET.NEG4],
      ["to-color", theme.extend.colors["ocf-delta"][100]],
      [
        "all",
        [">=", ["to-number", ["var", "bucket"]], DELTA_BUCKET.NEG4],
        ["<", ["to-number", ["var", "bucket"]], DELTA_BUCKET.NEG3]
      ],
      ["to-color", theme.extend.colors["ocf-delta"][200]],
      [
        "all",
        [">=", ["to-number", ["var", "bucket"]], DELTA_BUCKET.NEG3],
        ["<", ["to-number", ["var", "bucket"]], DELTA_BUCKET.NEG2]
      ],
      ["to-color", theme.extend.colors["ocf-delta"][300]],
      [
        "all",
        [">=", ["to-number", ["var", "bucket"]], DELTA_BUCKET.NEG2],
        ["<", ["to-number", ["var", "bucket"]], DELTA_BUCKET.NEG1]
      ],
      ["to-color", theme.extend.colors["ocf-delta"][400]],
      [
        "all",
        [">=", ["to-number", ["var", "bucket"]], DELTA_BUCKET.NEG1],
        ["<", ["to-number", ["var", "bucket"]], DELTA_BUCKET.POS1]
      ],
      ["to-color", "transparent"],
      [
        "all",
        [">=", ["to-number", ["var", "bucket"]], DELTA_BUCKET.POS1],
        ["<", ["to-number", ["var", "bucket"]], DELTA_BUCKET.POS2]
      ],
      ["to-color", theme.extend.colors["ocf-delta"][600]],
      [
        "all",
        [">=", ["to-number", ["var", "bucket"]], DELTA_BUCKET.POS2],
        ["<", ["to-number", ["var", "bucket"]], DELTA_BUCKET.POS3]
      ],
      ["to-color", theme.extend.colors["ocf-delta"][700]],
      [
        "all",
        [">=", ["to-number", ["var", "bucket"]], DELTA_BUCKET.POS3],
        ["<", ["to-number", ["var", "bucket"]], DELTA_BUCKET.POS4]
      ],
      ["to-color", theme.extend.colors["ocf-delta"][800]],
      [">=", ["to-number", ["var", "bucket"]], DELTA_BUCKET.POS4],
      ["to-color", theme.extend.colors["ocf-delta"][900]],
      // Default fill color
      ["to-color", "transparent"]
    ]
  ];

  const addOrUpdateFCData = (map: mapboxgl.Map) => {
    const source = map.getSource("latestPV") as unknown as mapboxgl.GeoJSONSource;
    if (!source) {
      const { forecastGeoJson } = generateGeoJsonForecastData(
        initForecastData,
        selectedISOTime,
        combinedData,
        gspDeltas,
        nationalAggregationLevel
      );
      map.addSource("latestPV", {
        type: "geojson",
        data: forecastGeoJson,
        promoteId: "id"
      });
    } else {
      if (generatedGeoJsonForecastData && source) {
        source?.setData(generatedGeoJsonForecastData.forecastGeoJson);
        map.setPaintProperty("latestPV-forecast", "fill-color", getFillColor("delta"));
      }
    }

    const pvForecastLayer = map.getLayer("latestPV-forecast");
    if (!pvForecastLayer) {
      map.addLayer({
        id: "latestPV-forecast",
        type: "fill",
        source: "latestPV",
        layout: { visibility: "visible" },
        paint: {
          "fill-color": getFillColor("delta"),
          "fill-opacity": 0.7
        }
      });
    }

    const pvForecastBordersLayer = map.getLayer("latestPV-forecast-borders");
    if (!pvForecastBordersLayer) {
      map.addLayer({
        id: "latestPV-forecast-borders",
        type: "line",
        source: "latestPV",
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
        source: "latestPV",
        paint: {
          "line-color": "#ffffff",
          "line-width": 4,
          "line-opacity": ["case", ["boolean", ["feature-state", "click"], false], 1, 0]
        }
      });
    }
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

      // Copy coordinates array.
      const properties = e.features?.[0].properties;

      const positiveDelta = properties?.delta > 0;
      const popupContent = `<div class="flex flex-col min-w-[16rem] text-white">
          <div class="flex justify-between mb-1">
            <div class="text-xs">${properties?.GSPs}</div>
            <div class="text-xs">#${properties?.id}</div>
          </div>
          <div class="flex justify-between text-base">
            <div class="text-ocf-yellow">${properties?.gspDisplayName}</div>
            <div class="">
              <span class="font-bold">${
                positiveDelta
                  ? `<span class="up-arrow"></span>`
                  : `<span class="down-arrow"></span>`
              }</span>
              <span class="mr-1 ${
                positiveDelta ? "text-ocf-delta-900" : "text-ocf-delta-100"
              }">${properties?.delta.toFixed(1)}</span><small class="text-xs">MW</small>
            </div>
          </div>
        </div>`;

      // Populate the popup and set its coordinates
      // based on the feature found.
      popup.setLngLat(e.lngLat).setHTML(popupContent).addTo(map);
    });

    map.on("mouseleave", "latestPV-forecast", () => {
      map.getCanvas().style.cursor = "";
      popup.remove();
    });
  };

  return (
    <div className={`delta-map relative h-full w-full ${className}`}>
      {forecastError ? (
        <FailedStateMap error="Failed to load" />
      ) : forecastLoading ? (
        <LoadStateMap>
          <ButtonGroup rightString={formatISODateStringHuman(selectedISOTime || "")} />
        </LoadStateMap>
      ) : (
        <Map
          loadDataOverlay={(map: { current: mapboxgl.Map }) =>
            safelyUpdateMapData(map.current, addOrUpdateFCData)
          }
          updateData={{
            newData: !!initForecastData,
            updateMapData: (map) => safelyUpdateMapData(map, addOrUpdateFCData)
          }}
          controlOverlay={(map: { current?: mapboxgl.Map }) => (
            <>
              <ButtonGroup rightString={formatISODateStringHuman(selectedISOTime || "")} />
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
