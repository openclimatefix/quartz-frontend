import { SWRResponse } from "swr";

import React, { Dispatch, SetStateAction, useMemo } from "react";
import mapboxgl, { Expression } from "mapbox-gl";

import { FailedStateMap, LoadStateMap, Map, MeasuringUnit } from "./";
import { ActiveUnit, SelectedData } from "./types";
import { getAllForecastUrl, MAX_POWER_GENERATED } from "../../constant";
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
  getForecastsData: (isNormalized: boolean) => SWRResponse<FcAllResData, any>;
  combinedData: CombinedData;
  combinedErrors: CombinedErrors;
  activeUnit: ActiveUnit;
  setActiveUnit: Dispatch<SetStateAction<ActiveUnit>>;
};

const DeltaMap: React.FC<DeltaMapProps> = ({
  className,
  getForecastsData,
  combinedData,
  combinedErrors,
  activeUnit,
  setActiveUnit
}) => {
  const [selectedISOTime] = useGlobalState("selectedISOTime");

  const latestForecastValue = 0;
  const isNormalized = activeUnit === ActiveUnit.percentage;
  let selectedDataName = SelectedData.expectedPowerGenerationMegawatts;
  if (activeUnit === ActiveUnit.percentage)
    selectedDataName = SelectedData.expectedPowerGenerationNormalized;
  if (activeUnit === ActiveUnit.capacity) selectedDataName = SelectedData.installedCapacityMw;
  const {
    pvRealDayInData,
    pvRealDayAfterData,
    national4HourData,
    allGspForecastData,
    allGspRealData,
    gspDeltas
  } = combinedData;
  const {
    pvRealDayInError,
    pvRealDayAfterError,
    national4HourError,
    allGspForecastError,
    allGspRealError
  } = combinedErrors;

  const {
    data: initForecastData,
    isValidating,
    error: forecastError
  } = getForecastsData(isNormalized);
  const forecastLoading = false;

  const getFillOpacity = (selectedData: string, isNormalized: boolean): Expression => [
    "interpolate",
    ["linear"],
    ["to-number", ["get", selectedData]],
    // on value 0 the opacity will be 0
    0,
    0,
    // on value maximum the opacity will be 1
    isNormalized ? 1 : MAX_POWER_GENERATED,
    1
  ];

  const generateGeoJsonForecastData: (
    forecastData?: FcAllResData,
    targetTime?: string,
    gspDeltas?: Map<string, number>
  ) => { forecastGeoJson: FeatureCollection } = (forecastData, targetTime) => {
    // Exclude first item as it's not representing gsp area
    const gspForecastData = forecastData?.forecasts?.slice(1);
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
    const source = map.getSource("latestPV") as unknown as mapboxgl.GeoJSONSource | undefined;
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
      ["<", ["to-number", ["var", "bucket"]], -80],
      ["to-color", theme.extend.colors["ocf-delta"][100]],
      [
        "all",
        [">=", ["to-number", ["var", "bucket"]], -80],
        ["<", ["to-number", ["var", "bucket"]], -60]
      ],
      ["to-color", theme.extend.colors["ocf-delta"][200]],
      [
        "all",
        [">=", ["to-number", ["var", "bucket"]], -60],
        ["<", ["to-number", ["var", "bucket"]], -40]
      ],
      ["to-color", theme.extend.colors["ocf-delta"][300]],
      [
        "all",
        [">=", ["to-number", ["var", "bucket"]], -40],
        ["<", ["to-number", ["var", "bucket"]], -20]
      ],
      ["to-color", theme.extend.colors["ocf-delta"][400]],
      [
        "all",
        [">=", ["to-number", ["var", "bucket"]], -20],
        ["<", ["to-number", ["var", "bucket"]], 20]
      ],
      ["to-color", "transparent"],
      [
        "all",
        [">=", ["to-number", ["var", "bucket"]], 20],
        ["<", ["to-number", ["var", "bucket"]], 40]
      ],
      ["to-color", theme.extend.colors["ocf-delta"][600]],
      [
        "all",
        [">=", ["to-number", ["var", "bucket"]], 40],
        ["<", ["to-number", ["var", "bucket"]], 60]
      ],
      ["to-color", theme.extend.colors["ocf-delta"][700]],
      [
        "all",
        [">=", ["to-number", ["var", "bucket"]], 60],
        ["<", ["to-number", ["var", "bucket"]], 80]
      ],
      ["to-color", theme.extend.colors["ocf-delta"][800]],
      [">=", ["to-number", ["var", "bucket"]], 80],
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
      // const geometry = e.features?.[0].geometry;
      // const coordinates = geometry?.type === "Polygon" ? geometry.coordinates[0][0] : [0, 0];
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
              }">${properties?.delta.toFixed(2)}</span><small class="text-xs">MW</small>
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
        >
          <DeltaColorGuideBar />
        </Map>
      )}
    </div>
  );
};

export default DeltaMap;
