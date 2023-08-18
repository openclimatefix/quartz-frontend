import { SWRResponse } from "swr";

import React, { Dispatch, SetStateAction, useMemo } from "react";
import mapboxgl, { Expression } from "mapbox-gl";

import { FailedStateMap, LoadStateMap, Map, MeasuringUnit } from "./";
import { ActiveUnit, SelectedData } from "./types";
import { MAX_POWER_GENERATED, VIEWS } from "../../constant";
import ButtonGroup from "../../components/button-group";
import gspShapeData from "../../data/gsp_regions_20220314.json";
import useGlobalState from "../helpers/globalState";
import { formatISODateString, formatISODateStringHuman } from "../helpers/utils";
import { CombinedData, CombinedErrors, GspAllForecastData } from "../types";
import { theme } from "../../tailwind.config";
import ColorGuideBar from "./color-guide-bar";
import { FeatureCollection } from "geojson";
import { safelyUpdateMapData } from "../helpers/mapUtils";
const yellow = theme.extend.colors["ocf-yellow"].DEFAULT;

const getRoundedPv = (pv: number, precision: number = -2) => {
  // -2 rounds to: 0, 100, 200, 300, 400, 500
  // 2 rounds to 4.32, 4.33, 4.34, 4.35, 4.36, 4.37
  return Math.round(pv / 10 ** precision) * 10 ** precision;
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

type PvLatestMapProps = {
  className?: string;
  combinedData: CombinedData;
  combinedErrors: CombinedErrors;
  activeUnit: ActiveUnit;
  setActiveUnit: Dispatch<SetStateAction<ActiveUnit>>;
};

const PvLatestMap: React.FC<PvLatestMapProps> = ({
  className,
  combinedData,
  combinedErrors,
  activeUnit,
  setActiveUnit
}) => {
  const [selectedISOTime] = useGlobalState("selectedISOTime");

  const latestForecastValue = 0;
  const isNormalized = activeUnit === ActiveUnit.percentage;
  let selectedDataName = SelectedData.expectedPowerGenerationMegawattsRounded;
  if (activeUnit === ActiveUnit.percentage)
    selectedDataName = SelectedData.expectedPowerGenerationNormalized;
  if (activeUnit === ActiveUnit.capacity) selectedDataName = SelectedData.installedCapacityMw;

  const initForecastData = combinedData?.allGspForecastData;
  const forecastError = combinedErrors?.allGspForecastError;

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
    forecastData?: GspAllForecastData,
    targetTime?: string
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

        return {
          ...featureObj,
          properties: {
            ...featureObj.properties,
            [SelectedData.expectedPowerGenerationMegawatts]:
              selectedFCValue && getRoundedPv(selectedFCValue.expectedPowerGenerationMegawatts, -1),
            [SelectedData.expectedPowerGenerationMegawattsRounded]:
              selectedFCValue && getRoundedPv(selectedFCValue.expectedPowerGenerationMegawatts, 2),
            [SelectedData.expectedPowerGenerationNormalized]:
              selectedFCValue &&
              getRoundedPv(selectedFCValue.expectedPowerGenerationNormalized || 0, -3),
            [SelectedData.expectedPowerGenerationNormalizedRounded]:
              selectedFCValue &&
              getRoundedPvPercent(selectedFCValue?.expectedPowerGenerationNormalized || 0),
            [SelectedData.installedCapacityMw]: getRoundedPv(
              forecastDatum?.location.installedCapacityMw || 0,
              -1
            ),
            gspDisplayName: forecastDatum?.location?.regionName || ""
          }
        };
      })
    };

    return { forecastGeoJson };
  };
  const generatedGeoJsonForecastData = useMemo(() => {
    return generateGeoJsonForecastData(initForecastData, selectedISOTime);
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
      map.setPaintProperty(
        "latestPV-forecast",
        "fill-opacity",
        getFillOpacity(selectedDataName, isNormalized)
      );
    }
  };

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
        "fill-color": yellow,
        "fill-opacity": getFillOpacity(selectedDataName, isNormalized)
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
      console.log("GSP PROPS:", properties);

      const popupContent = `<div class="flex flex-col min-w-[16rem] text-white">
          <div class="flex justify-between items-center mb-1">
            <div class="text-sm font-semibold">${properties?.gspDisplayName}</div>
            <div class="text-xs text-mapbox-black-300">${properties?.GSPs} • #${
        properties?.gsp_id
      }</div>
          </div>
          <div class="flex justify-between items-center">
            <div class="text-xs text-ocf-yellow">${(
              Number(properties?.[SelectedData.expectedPowerGenerationNormalized]) * 100
            ).toFixed(1)}%</div>
            <div>
              <span class="text-ocf-yellow">${
                properties?.[SelectedData.expectedPowerGenerationMegawatts]?.toFixed(1) || 0
              }</span> / 
              <span class="">${properties?.[SelectedData.installedCapacityMw]?.toFixed(
                1
              )}</span> <span class="text-2xs text-mapbox-black-300">MW</span>
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
    <div className={`pv-map relative h-full w-full ${className}`}>
      {forecastError ? (
        <FailedStateMap error="Failed to load" />
      ) : (
        // ) : !forecastError && !initForecastData ? (
        //   <LoadStateMap>
        //     <ButtonGroup rightString={formatISODateStringHuman(selectedISOTime || "")} />
        //   </LoadStateMap>
        <Map
          loadDataOverlay={addFCData}
          updateData={{ newData: !!initForecastData, updateMapData }}
          controlOverlay={(map: { current?: mapboxgl.Map }) => (
            <>
              <ButtonGroup rightString={formatISODateStringHuman(selectedISOTime || "")} />
              <MeasuringUnit
                activeUnit={activeUnit}
                setActiveUnit={setActiveUnit}
                isLoading={!initForecastData}
              />
            </>
          )}
          title={VIEWS.FORECAST}
        >
          <ColorGuideBar unit={activeUnit} />
        </Map>
      )}
    </div>
  );
};

export default PvLatestMap;
