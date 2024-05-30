import { SWRResponse } from "swr";

import React, { Dispatch, SetStateAction, useMemo } from "react";
import mapboxgl, { Expression } from "mapbox-gl";

import { FailedStateMap, LoadStateMap, Map, MeasuringUnit } from "./";
import { ActiveUnit, SelectedData } from "./types";
import { MAX_POWER_GENERATED, VIEWS } from "../../constant";
import gspShapeData from "../../data/gsp_regions_20220314.json";
import useGlobalState from "../helpers/globalState";
import { formatISODateString, formatISODateStringHuman } from "../helpers/utils";
import { CombinedData, CombinedErrors, GspAllForecastData } from "../types";
import { theme } from "../../tailwind.config";
import ColorGuideBar from "./color-guide-bar";
import { FeatureCollection } from "geojson";
import { safelyUpdateMapData } from "../helpers/mapUtils";
import { components } from "../../types/quartz-api";
import { generateGeoJsonForecastData } from "../helpers/data";
import dynamic from "next/dynamic";
const yellow = theme.extend.colors["ocf-yellow"].DEFAULT;

const ButtonGroup = dynamic(() => import("../../components/button-group"), { ssr: false });

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
  let selectedDataName = SelectedData.expectedPowerGenerationMegawatts;
  if (activeUnit === ActiveUnit.percentage)
    selectedDataName = SelectedData.expectedPowerGenerationNormalized;
  if (activeUnit === ActiveUnit.capacity) selectedDataName = SelectedData.installedCapacityMw;

  const forecastLoading = false;
  const initForecastData =
    combinedData?.allGspForecastData as components["schemas"]["OneDatetimeManyForecastValues"][];
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

  const generatedGeoJsonForecastData = useMemo(() => {
    return generateGeoJsonForecastData(initForecastData, selectedISOTime, combinedData);
  }, [initForecastData, selectedISOTime]);

  const addOrUpdateMapData = (map: mapboxgl.Map) => {
    const source = map.getSource("latestPV") as unknown as mapboxgl.GeoJSONSource;

    if (!source) {
      const { forecastGeoJson } = generateGeoJsonForecastData(
        initForecastData,
        selectedISOTime,
        combinedData
      );
      map.addSource("latestPV", {
        type: "geojson",
        data: forecastGeoJson
      });
    }

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
    } else {
      if (generatedGeoJsonForecastData && source) {
        source?.setData(generatedGeoJsonForecastData.forecastGeoJson);
        map.setPaintProperty(
          "latestPV-forecast",
          "fill-opacity",
          getFillOpacity(selectedDataName, isNormalized)
        );
      }
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

    const pvForecastSelectBordersLayer = map.getLayer("latestPV-forecast-select-borders");
    if (!pvForecastSelectBordersLayer) {
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
  };

  return (
    <div className={`relative h-full w-full ${className}`}>
      {forecastError ? (
        <FailedStateMap error="Failed to load" />
      ) : (
        // ) : !forecastError && !initForecastData ? (
        //   <LoadStateMap>
        //     <ButtonGroup rightString={formatISODateStringHuman(selectedISOTime || "")} />
        //   </LoadStateMap>
        <Map
          loadDataOverlay={(map: { current: mapboxgl.Map }) =>
            safelyUpdateMapData(map.current, addOrUpdateMapData)
          }
          updateData={{
            newData: !!initForecastData,
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
      )}
    </div>
  );
};

export default PvLatestMap;
