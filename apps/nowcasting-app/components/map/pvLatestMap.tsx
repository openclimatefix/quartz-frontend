import React, { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import mapboxgl, { CircleLayer, Expression } from "mapbox-gl";

import { FailedStateMap, LoadStateMap, Map, MeasuringUnit } from "./";
import { ActiveUnit, NationalAggregation, SelectedData } from "./types";
import { MAX_POWER_GENERATED, VIEWS } from "../../constant";
import useGlobalState from "../helpers/globalState";
import { formatISODateStringHuman } from "../helpers/utils";
import { CombinedData, CombinedErrors, CombinedLoading, CombinedValidating } from "../types";
import { theme } from "../../tailwind.config";
import ColorGuideBar from "./color-guide-bar";
import { getActiveUnitFromMap, safelyUpdateMapData, setActiveUnitOnMap } from "../helpers/mapUtils";
import { components } from "../../types/quartz-api";
import { generateGeoJsonForecastData } from "../helpers/data";
import dynamic from "next/dynamic";
import throttle from "lodash/throttle";
import Spinner from "../icons/spinner";
import dnoShapeData from "../../data/dno_regions_lat_long_converted.json";
import { FeatureCollection } from "geojson";

const yellow = theme.extend.colors["ocf-yellow"].DEFAULT;

const ButtonGroup = dynamic(() => import("../../components/button-group"), { ssr: false });

type PvLatestMapProps = {
  className?: string;
  combinedData: CombinedData;
  combinedLoading: CombinedLoading;
  combinedValidating: CombinedValidating;
  combinedErrors: CombinedErrors;
  activeUnit: ActiveUnit;
  setActiveUnit: Dispatch<SetStateAction<ActiveUnit>>;
};

const PvLatestMap: React.FC<PvLatestMapProps> = ({
  className,
  combinedData,
  combinedLoading,
  combinedValidating,
  combinedErrors,
  activeUnit,
  setActiveUnit
}) => {
  const [selectedISOTime] = useGlobalState("selectedISOTime");
  const [nationalAggregationLevel] = useGlobalState("nationalAggregationLevel");
  const [shouldUpdateMap, setShouldUpdateMap] = useState(false);
  const [mapDataLoading, setMapDataLoading] = useState(true);
  const [selectedMapRegionIds] = useGlobalState("selectedMapRegionIds");
  const [showMap, setShowMap] = useState(true);

  const getSelectedDataFromActiveUnit = (activeUnit: ActiveUnit) => {
    switch (activeUnit) {
      case ActiveUnit.MW:
        return SelectedData.expectedPowerGenerationMegawattsRounded;
      case ActiveUnit.percentage:
        return SelectedData.expectedPowerGenerationNormalizedRounded;
      case ActiveUnit.capacity:
        return SelectedData.installedCapacityMw;
    }
  };
  const [selectedDataName, setSelectedDataName] = useState(
    getSelectedDataFromActiveUnit(activeUnit)
  );

  useEffect(() => {
    setMapDataLoading(true);
    setSelectedDataName(getSelectedDataFromActiveUnit(activeUnit));
    // Add unit to map container so that it can be accessed by popup in the map event listeners
    const map: HTMLDivElement | null = document.querySelector(`#Map-${VIEWS.FORECAST}`);
    if (map) {
      setActiveUnitOnMap(map, activeUnit);
    }
  }, [activeUnit]);

  const latestForecastValue = 0;
  const isNormalized = activeUnit === ActiveUnit.percentage;

  const forecastLoading = false;
  const initForecastData =
    combinedData?.allGspForecastData as components["schemas"]["OneDatetimeManyForecastValues"][];
  const forecastError = combinedErrors?.allGspForecastError;

  // Show loading spinner when selectedISOTime changes
  useEffect(() => {
    if (!combinedData?.allGspForecastData) return;

    setMapDataLoading(true);
  }, [selectedISOTime]);

  // Update map data when forecast data is loaded
  useEffect(() => {
    if (!combinedData?.allGspForecastData) return;

    console.info("Updating map data with new forecast data");

    setShouldUpdateMap(true);
  }, [
    combinedData,
    combinedLoading,
    combinedValidating,
    selectedISOTime,
    nationalAggregationLevel
  ]);

  // Hide loading spinner if there is an error to prevent infinite loading
  useEffect(() => {
    if (combinedErrors.allGspForecastError) {
      setMapDataLoading(false);
    }
  }, [combinedErrors.allGspForecastError]);

  const maxPower =
    nationalAggregationLevel === NationalAggregation.GSP ? MAX_POWER_GENERATED : 5000;

  const getFillOpacity = (selectedData: string, isNormalized: boolean): Expression => [
    "interpolate",
    ["linear"],
    ["to-number", ["get", selectedData]],
    // on value 0 the opacity will be 0
    0,
    0,
    // on value maximum the opacity will be 1
    isNormalized ? 1 : maxPower,
    1
  ];

  const generatedGeoJsonForecastData = useMemo(() => {
    return generateGeoJsonForecastData(
      initForecastData,
      selectedISOTime,
      combinedData,
      undefined,
      nationalAggregationLevel
    );
  }, [
    combinedData.allGspForecastData,
    combinedLoading.allGspForecastLoading,
    combinedValidating.allGspForecastValidating,
    selectedISOTime,
    combinedData.allGspSystemData,
    nationalAggregationLevel
  ]);

  // Create a popup, but don't add it to the map yet.
  const popup = useMemo(() => {
    return new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      anchor: "bottom-right",
      maxWidth: "none"
    });
  }, []);

  const nationalCapacityMW = useMemo(() => {
    if (!combinedData.allGspSystemData) return 0;

    let totalCapacityMW = 0;
    combinedData.allGspSystemData.forEach((gsp) => {
      // Skip the national capacity
      if (gsp.gspId === 0) return;

      totalCapacityMW += gsp.installedCapacityMw || 0;
    });
    return totalCapacityMW;
  }, [combinedData.allGspSystemData]);

  const addOrUpdateMapData = (map: mapboxgl.Map) => {
    const geoJsonHasData =
      generatedGeoJsonForecastData.forecastGeoJson.features.length > 0 &&
      typeof generatedGeoJsonForecastData.forecastGeoJson?.features?.[0]?.properties
        ?.expectedPowerGenerationMegawatts === "number";
    if (!geoJsonHasData) {
      console.log("geoJsonForecastData empty, trying again...");
      setShouldUpdateMap(true);
      return;
    }
    setShouldUpdateMap(false);

    const source = map.getSource("latestPV") as unknown as mapboxgl.GeoJSONSource;

    if (!source) {
      const { forecastGeoJson } = generatedGeoJsonForecastData;
      map.addSource("latestPV", {
        type: "geojson",
        data: forecastGeoJson,
        promoteId: "id"
      });
    } else {
      source.setData(generatedGeoJsonForecastData.forecastGeoJson);
    }
    console.log("latestPV source set");

    const pvForecastLayer = map.getLayer("latestPV-forecast");
    if (!pvForecastLayer) {
      map.addLayer({
        id: "latestPV-forecast",
        type: "fill",
        source: "latestPV",
        layout: { visibility: "visible" },
        paint: {
          "fill-color": yellow,
          "fill-opacity": getFillOpacity(selectedDataName, isNormalized)
        }
      });
      console.log("pvForecastLayer added");

      // Also add map event listeners but only the first time
      const popupFunction = throttle(
        (e) => {
          // Change the cursor style as a UI indicator.
          map.getCanvas().style.cursor = "pointer";
          const currentActiveUnit = getActiveUnitFromMap(map);

          const properties = e.features?.[0].properties;
          if (!properties) return;
          let actualValue = "";
          let forecastValue = "";
          let unit = "";
          if (currentActiveUnit === ActiveUnit.MW) {
            // Map in MW mode
            actualValue = properties?.[SelectedData.actualPowerGenerationMegawatts]
              ? properties?.[SelectedData.actualPowerGenerationMegawatts].toFixed(0)
              : "-";
            forecastValue =
              properties?.[SelectedData.expectedPowerGenerationMegawatts]?.toFixed(0) || 0;
            unit = "MW";
          } else if (currentActiveUnit === ActiveUnit.percentage) {
            // Map in % mode
            actualValue = properties?.[SelectedData.actualPowerGenerationMegawatts]
              ? (
                  Number(
                    properties?.[SelectedData.actualPowerGenerationMegawatts] /
                      properties?.[SelectedData.installedCapacityMw] || 0
                  ) * 100
                ).toFixed(0)
              : "-";
            forecastValue =
              (
                Number(properties?.[SelectedData.expectedPowerGenerationNormalized] || 0) * 100
              ).toFixed(0) || "-";
            unit = "%";
          } else if (currentActiveUnit === ActiveUnit.capacity) {
            // Map in Capacity mode
            actualValue =
              (
                (Number(properties?.[SelectedData.installedCapacityMw] || 0) / nationalCapacityMW) *
                100
              ).toFixed(1) || "-";
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
          <!-- TODO – remove gsp_id when done testing zones -->
            <div class="text-sm font-semibold">${properties?.gspDisplayName}</div>
            <div class="text-xs text-mapbox-black-300">${properties?.id} ${
            properties?.GSPs || ""
          }</div>
          </div>
          <div class="flex justify-between items-center">
            
            <div class="flex flex-col text-xs">
              <span class="text-2xs uppercase tracking-wide text-mapbox-black-300">Capacity</span>
              <div><span>${
                properties?.[SelectedData.installedCapacityMw]
              }</span> <span class="text-2xs text-mapbox-black-300">MW</span></div>
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

      map.on("data", (e) => {
        if (e.dataType === "source" && e.sourceId === "latestPV" && e.isSourceLoaded) {
          setMapDataLoading(false);
        }
      });

      map.on("sourcedata", (e) => {
        if (e.sourceId === "latestPV" && e.isSourceLoaded) {
          setMapDataLoading(false);
        }
      });
    } else {
      if (generatedGeoJsonForecastData && source) {
        const currentActiveUnit = getActiveUnitFromMap(map);
        const isNormalized = currentActiveUnit === ActiveUnit.percentage;
        source?.setData(generatedGeoJsonForecastData.forecastGeoJson);
        map.setPaintProperty(
          "latestPV-forecast",
          "fill-opacity",
          getFillOpacity(selectedDataName, isNormalized)
        );
        console.log("pvForecastLayer updated", generatedGeoJsonForecastData.forecastGeoJson);
      } else {
        console.log("pvForecastLayer not updated");
      }
    }
    console.log("pvForecastLayer set");

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

    const pvForecastSelectBordersLayer = map.getLayer("latestPV-forecast-select-borders");
    if (!pvForecastSelectBordersLayer) {
      map.addLayer({
        id: "latestPV-forecast-select-borders",
        type: "line",
        source: "latestPV",
        paint: {
          "line-color": "#ffffff",
          "line-width": 2,
          // "line-opacity": ["case", ["boolean", ["feature-state", "click"], false], 1, 0]
          "line-opacity": 1
        },
        filter: ["in", "id", ""]
      });
    }

    // // Test DNO boundaries
    // let dnoBoundariesSource = map.getSource("dnoBoundaries") as unknown as
    //   | mapboxgl.GeoJSONSource
    //   | undefined;
    // if (!dnoBoundariesSource) {
    //   map.addSource("dnoBoundaries", {
    //     type: "geojson",
    //     data: dnoShapeData as FeatureCollection
    //   });
    // }
    //
    // let dnoBoundariesLayer = (map.getLayer(`dnoBoundaries`) as unknown as CircleLayer) || undefined;
    // if (!dnoBoundariesLayer) {
    //   map.addLayer({
    //     id: "dnoBoundaries",
    //     type: "line",
    //     source: "dnoBoundaries",
    //     // Test showing DNO region boundaries at all zoom levels
    //     // minzoom: AGGREGATION_LEVEL_MIN_ZOOM.REGION,
    //     // maxzoom: AGGREGATION_LEVEL_MAX_ZOOM.REGION,
    //     paint: {
    //       "line-color": "#ffcc2d",
    //       "line-width": 0.6,
    //       "line-opacity": 0.5
    //     }
    //   });
    // }
  };

  // if mapDataLoading has been true for 3 seconds, set it to false
  const [mapDataLoadingTimeout, setMapDataLoadingTimeout] = useState<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (mapDataLoadingTimeout) {
      clearTimeout(mapDataLoadingTimeout);
    }
    if (mapDataLoading) {
      setMapDataLoadingTimeout(
        setTimeout(() => {
          setMapDataLoading(false);
        }, 3000)
      );
    }
    return () => {
      if (mapDataLoadingTimeout) {
        clearTimeout(mapDataLoadingTimeout);
      }
    };
  }, [mapDataLoading]);

  return (
    <div className={`pv-map relative h-full w-full ${className}`}>
      {forecastError ? (
        <FailedStateMap error="Failed to load" />
      ) : (
        // ) : !forecastError && !initForecastData ? (
        <>
          {(!combinedData.allGspForecastData ||
            combinedLoading.allGspForecastLoading ||
            mapDataLoading) && (
            <LoadStateMap>
              <Spinner />
            </LoadStateMap>
          )}
          <Map
            loadDataOverlay={(map: { current: mapboxgl.Map }) =>
              safelyUpdateMapData(map.current, addOrUpdateMapData)
            }
            updateData={{
              newData: shouldUpdateMap,
              updateMapData: (map) => safelyUpdateMapData(map, addOrUpdateMapData)
            }}
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
        </>
      )}
    </div>
  );
};

export default PvLatestMap;
