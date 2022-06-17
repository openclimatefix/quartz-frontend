import useSWR from "swr";
import useSWRImmutable from "swr/immutable";

import { useEffect, useMemo, useState } from "react";
import mapboxgl, { Expression } from "mapbox-gl";

import { FaildStateMap, LoadStateMap, Map, MeasuringUnit } from "./";
import { ActiveUnit, SelectedData } from "./types";
import { getAllForecastUrl, MAX_POWER_GENERATED } from "../../constant";
import ButtonGroup from "../../components/button-group";
import gspShapeData from "../../data/gsp-regions.json";
import useGlobalState from "../globalState";
import { formatISODateString, formatISODateStringHuman } from "../utils";
import { FcAllResData } from "../types";

const fetcher = (input: RequestInfo, init: RequestInit) =>
  fetch(input, init).then((res) => res.json());

// Assuming first item in the array is the latest
const latestForecastValue = 0;
const useGetForecastsData = (isNormalized: boolean) => {
  const [forecastLoading, setForecastLoading] = useState(true);
  const [, setForecastCreationTime] = useGlobalState("forecastCreationTime");
  const bareForecastData = useSWRImmutable<FcAllResData>(
    () => getAllForecastUrl(false, false),
    fetcher,
    {
      onSuccess: (data) => {
        setForecastCreationTime(data.forecasts[0].forecastCreationTime);
        setForecastLoading(false);
      },
    },
  );

  const allForecastData = useSWR<FcAllResData>(() => getAllForecastUrl(true, true), fetcher, {
    refreshInterval: 1000 * 60 * 5, // 5min
    isPaused: () => forecastLoading,
    onSuccess: (data) => {
        setForecastCreationTime(data.forecasts[0].forecastCreationTime);
    }
  });
  useEffect(() => {
    if (!forecastLoading) {
      allForecastData.mutate();
    }
  }, [forecastLoading]);
  if (isNormalized) return allForecastData;
  else return allForecastData.data ? allForecastData : bareForecastData;
};

const PvLatestMap = () => {
  const [activeUnit, setActiveUnit] = useState<ActiveUnit>(ActiveUnit.percentage);
  const [selectedISOTime] = useGlobalState("selectedISOTime");

  const isNormalized = activeUnit === ActiveUnit.percentage;
  const selectedDataName =
    activeUnit === ActiveUnit.percentage
      ? SelectedData.expectedPowerGenerationNormalized
      : SelectedData.expectedPowerGenerationMegawatts;

  const {
    data: initForecastData,
    isValidating,
    error: forecastError,
  } = useGetForecastsData(isNormalized);
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
    1,
  ];

  const generateGeoJsonForecastData = (forecastData?: FcAllResData, targetTime?: string) => {
    // Exclude first item as it's not represting gsp area
    const filteredForcastData = forecastData?.forecasts?.slice(1);
    const gspShapeDatat = gspShapeData as GeoJSON.FeatureCollection<GeoJSON.Geometry>;
    const forecastGeoJson = {
      ...gspShapeDatat,
      features: gspShapeDatat.features.map((featureObj, index) => {
        const selectedFCvalue =
          filteredForcastData && targetTime
            ? filteredForcastData[index]?.forecastValues.find(
                (fv) => formatISODateString(fv.targetTime) === formatISODateString(targetTime),
              )
            : filteredForcastData
            ? filteredForcastData[index]?.forecastValues[latestForecastValue]
            : undefined;

        return {
          ...featureObj,
          properties: {
            ...featureObj.properties,
            expectedPowerGenerationMegawatts:
              selectedFCvalue && Math.round(selectedFCvalue.expectedPowerGenerationMegawatts),
            expectedPowerGenerationNormalized:
              selectedFCvalue && selectedFCvalue?.expectedPowerGenerationNormalized,
          },
        };
      }),
    };

    return { forecastGeoJson };
  };
  const generatedGeoJsonForecastData = useMemo(() => {
    return generateGeoJsonForecastData(initForecastData, selectedISOTime);
  }, [initForecastData, selectedISOTime]);

  const updateMapData = (map: mapboxgl.Map) => {
    const source = map.getSource("latestPV") as unknown as mapboxgl.GeoJSONSource | undefined;
    if (generatedGeoJsonForecastData && source) {
      source?.setData(generatedGeoJsonForecastData.forecastGeoJson);
      map.setPaintProperty(
        "latestPV-forecast",
        "fill-opacity",
        getFillOpacity(selectedDataName, isNormalized),
      );
    }
  };

  const addFCData = (map: { current: mapboxgl.Map }) => {
    const { forecastGeoJson } = generateGeoJsonForecastData(initForecastData, selectedISOTime);

    map.current.addSource("latestPV", {
      type: "geojson",
      data: forecastGeoJson,
    });

    map.current.addLayer({
      id: "latestPV-forecast",
      type: "fill",
      source: "latestPV",
      layout: { visibility: "visible" },
      paint: {
        "fill-color": "#eab308",
        "fill-opacity": getFillOpacity(selectedDataName, isNormalized),
      },
    });

    map.current.addLayer({
      id: "latestPV-forecast-borders",
      type: "line",
      source: "latestPV",
      paint: {
        "line-color": "#ffffff",
        "line-width": 0.6,
        "line-opacity": 0.2,
      },
    });

    map.current.addLayer({
      id: "latestPV-forecast-select-borders",
      type: "line",
      source: "latestPV",
      paint: {
        "line-color": "#ffffff",
        "line-width": 4,
        "line-opacity": ["case", ["boolean", ["feature-state", "click"], false], 1, 0],
      },
    });
  };

  return forecastError ? (
    <FaildStateMap error="Failed to load" />
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
          <MeasuringUnit
            activeUnit={activeUnit}
            setActiveUnit={setActiveUnit}
            isLoading={isValidating && !initForecastData}
          />
        </>
      )}
    />
  );
};

export default PvLatestMap;
