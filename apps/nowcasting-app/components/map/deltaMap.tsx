import { SWRResponse } from "swr";

import React, { Dispatch, SetStateAction, useMemo } from "react";
import mapboxgl, { Expression } from "mapbox-gl";

import { FailedStateMap, LoadStateMap, Map, MeasuringUnit } from "./";
import { ActiveUnit, SelectedData } from "./types";
import { DELTA_BUCKET, VIEWS } from "../../constant";
import ButtonGroup from "../../components/button-group";
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
  National4HourData,
  PvRealData
} from "../types";
import { theme } from "../../tailwind.config";
import ColorGuideBar from "./color-guide-bar";
import { FeatureCollection } from "geojson";
import DeltaColorGuideBar from "./delta-color-guide-bar";
const yellow = theme.extend.colors["ocf-yellow"].DEFAULT;

const getRoundedPv = (pv: number, round: boolean = true) => {
  if (!round) return Math.round(pv);
  // round To: 0, 100, 200, 300, 400, 500
  return Math.round(pv / 100) * 100;
};
const getRoundedPvPercent = (per: number, round: boolean = true) => {
  if (!round) return per;
  // round to : 0, 0.2, 0.4, 0.6 0.8, 1
  let rounded = Math.round(per * 10);
  if (rounded % 2) {
    if (per * 10 > rounded) return (rounded + 1) / 10;
    else return (rounded - 1) / 10;
  } else return rounded / 10;
};

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

  const latestForecastValue = 0;
  const isNormalized = activeUnit === ActiveUnit.percentage;
  const { gspDeltas } = combinedData;

  const forecastLoading = false;
  const initForecastData = combinedData?.allGspForecastData;
  const forecastError = combinedErrors?.allGspForecastError;

  const generateGeoJsonForecastData: (
    forecastData?: GspAllForecastData,
    targetTime?: string,
    gspDeltas?: Map<string, number>
  ) => { forecastGeoJson: FeatureCollection } = (forecastData, targetTime) => {
    const gspForecastData = forecastData?.forecasts || [];
    const gspShapeJson = gspShapeData as FeatureCollection;
    const forecastGeoJson = {
      ...gspShapeData,
      type: "FeatureCollection" as "FeatureCollection",
      features: gspShapeJson.features.map((featureObj, index) => {
        const forecastDatum = gspForecastData && gspForecastData[index];
        let selectedFCValue;
        if (gspForecastData && targetTime) {
          selectedFCValue = forecastDatum?.forecastValues.find(
            (fv) => formatISODateString(fv.targetTime) === formatISODateString(targetTime)
          );
        } else if (gspForecastData) {
          selectedFCValue = forecastDatum?.forecastValues[latestForecastValue];
        }
        const currentGspDelta: GspDeltaValue = gspDeltas.get(index + 1);

        return {
          ...featureObj,
          properties: {
            ...featureObj.properties,
            [SelectedData.expectedPowerGenerationMegawatts]:
              selectedFCValue && getRoundedPv(selectedFCValue.expectedPowerGenerationMegawatts),
            [SelectedData.expectedPowerGenerationNormalized]:
              selectedFCValue &&
              getRoundedPvPercent(selectedFCValue?.expectedPowerGenerationNormalized || 0),
            [SelectedData.installedCapacityMw]: getRoundedPv(
              forecastDatum?.location.installedCapacityMw || 0
            ),
            [SelectedData.delta]: currentGspDelta?.delta || 0,
            deltaBucket: currentGspDelta?.deltaBucket || 0,
            gspDisplayName: forecastDatum?.location?.regionName || ""
          }
        };
      })
    };

    return { forecastGeoJson };
  };
  const generatedGeoJsonForecastData = useMemo(() => {
    return generateGeoJsonForecastData(initForecastData, selectedISOTime, gspDeltas);
  }, [initForecastData, selectedISOTime]);

  const updateMapData = (map: mapboxgl.Map) => {
    const source = map.getSource("latestPV") as unknown as mapboxgl.GeoJSONSource;
    if (!source) {
      const { forecastGeoJson } = generateGeoJsonForecastData(initForecastData, selectedISOTime);

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

  const addFCData = (map: { current: mapboxgl.Map }) => {
    const { forecastGeoJson } = generateGeoJsonForecastData(initForecastData, selectedISOTime);

    map.current.addSource("latestPV", {
      type: "geojson",
      data: forecastGeoJson
    });

    map.current.addLayer({
      id: "latestPV-forecast",
      type: "fill",
      source: "latestPV",
      layout: { visibility: "visible" },
      paint: {
        "fill-color": getFillColor("delta"),
        "fill-opacity": 0.7
      }
    });

    map.current.addLayer({
      id: "latestPV-forecast-borders",
      type: "line",
      source: "latestPV",
      paint: {
        "line-color": "#ffffff",
        "line-width": 0.6,
        "line-opacity": 0.2
      }
    });

    map.current.addLayer({
      id: "latestPV-forecast-select-borders",
      type: "line",
      source: "latestPV",
      paint: {
        "line-color": "#ffffff",
        "line-width": 4,
        "line-opacity": ["case", ["boolean", ["feature-state", "click"], false], 1, 0]
      }
    });
    // Create a popup, but don't add it to the map yet.
    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      anchor: "bottom-right",
      maxWidth: "none"
    });

    map.current.on("mousemove", "latestPV-forecast", (e) => {
      // Change the cursor style as a UI indicator.
      map.current.getCanvas().style.cursor = "pointer";

      // Copy coordinates array.
      const properties = e.features?.[0].properties;

      const positiveDelta = properties?.delta > 0;
      const popupContent = `<div class="flex flex-col min-w-[16rem] text-white">
          <div class="flex justify-between mb-1">
            <div class="text-xs">${properties?.GSPs}</div>
            <div class="text-xs">#${properties?.gsp_id}</div>
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
      popup.setLngLat(e.lngLat).setHTML(popupContent).addTo(map.current);
    });

    map.current.on("mouseleave", "latestPV-forecast", () => {
      map.current.getCanvas().style.cursor = "";
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
          loadDataOverlay={addFCData}
          updateData={{ newData: !!initForecastData, updateMapData }}
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
