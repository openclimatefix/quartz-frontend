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
              selectedFCValue && getRoundedPv(selectedFCValue.expectedPowerGenerationMegawatts),
            [SelectedData.expectedPowerGenerationNormalized]:
              selectedFCValue &&
              getRoundedPvPercent(selectedFCValue?.expectedPowerGenerationNormalized || 0),
            [SelectedData.installedCapacityMw]: getRoundedPv(
              forecastDatum?.location.installedCapacityMw || 0
            )
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
