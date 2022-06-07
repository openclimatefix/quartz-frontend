import useSWR from "swr";
import { MutableRefObject, useMemo, useState } from "react";

import { FaildStateMap, LoadStateMap, Map, MeasuringUnit } from "./";
import { ActiveUnit, SelectedData } from "./types";
import { API_PREFIX, MAX_POWER_GENERATED } from "../../constant";
import ButtonGroup from "../../components/button-group";
import gspShapeData from "../../data/gsp-regions.json";
import useGlobalState from "../globalState";
import { formatISODateString, formatISODateStringHuman } from "../utils";
import { FcAllResData } from "../types";
import mapboxgl, { FillPaint } from "mapbox-gl";

const fetcher = (input: RequestInfo, init: RequestInit) =>
  fetch(input, init).then((res) => res.json());

// Assuming first item in the array is the latest
const latestForecastValue = 0;

const PvLatestMap = () => {
  const [forecastLoading, setForecastLoading] = useState(true);
  const [forecastError, setForecastError] = useState<any>(false);
  const [isToggleLoading, setIsToggleLoading] = useState(false);
  const [activeUnit, setActiveUnit] = useState<ActiveUnit>(ActiveUnit.MW);

  const forecastUrl = (type) => `${API_PREFIX}/GB/solar/gsp/forecast/all?normalize=${type}`;
  const isNormalized = activeUnit === ActiveUnit.percentage;
  const selectedDataName =
    activeUnit === ActiveUnit.percentage
      ? SelectedData.expectedPowerGenerationNormalized
      : SelectedData.expectedPowerGenerationMegawatts;
  const [selectedISOTime] = useGlobalState("selectedISOTime");
  const { data: initForecastData } = useSWR(() => forecastUrl(isNormalized), fetcher, {
    onSuccess: () => {
      setForecastError(false);
      setForecastLoading(false);
    },
    onError: (err) => setForecastError(err),
    refreshInterval: 1000 * 60 * 5, // 5min
  });
  const selectedForcastValue = useMemo(() => {
    if (!initForecastData || !selectedISOTime) return latestForecastValue;

    const index = initForecastData.forecasts[0].forecastValues.findIndex(
      (fv) => formatISODateString(fv.targetTime) === formatISODateString(selectedISOTime),
    );
    if (index >= 0) return index;
    return latestForecastValue;
  }, [initForecastData, selectedISOTime]);
  const getFillOpacity = (selectedData: string, isNormalized: boolean) => [
    "interpolate",
    ["linear"],
    ["get", selectedData],
    // on value 0 the opacity will be 0
    0,
    0,
    // on value maximum the opacity will be 1
    isNormalized ? 1 : MAX_POWER_GENERATED,
    1,
  ];
  const generateGeoJsonForecastData = (forecastData?: FcAllResData, forecastIndex?: number) => {
    // Exclude first item as it's not represting gsp area
    const filteredForcastData = forecastData?.forecasts?.slice(1);
    const gspShapeDatat = gspShapeData as GeoJSON.FeatureCollection<GeoJSON.Geometry>;
    const forecastGeoJson = {
      ...gspShapeDatat,
      features: gspShapeDatat.features.map((featureObj, index) => ({
        ...featureObj,
        properties: {
          ...featureObj.properties,
          expectedPowerGenerationMegawatts:
            filteredForcastData &&
            filteredForcastData[index] &&
            Math.round(
              filteredForcastData[index].forecastValues[forecastIndex || latestForecastValue]
                .expectedPowerGenerationMegawatts,
            ),
          expectedPowerGenerationNormalized:
            filteredForcastData &&
            filteredForcastData[index].forecastValues[forecastIndex || latestForecastValue]
              .expectedPowerGenerationNormalized,
        },
      })),
    };

    return { forecastGeoJson };
  };
  const generatedGeoJsonForecastData = useMemo(() => {
    return generateGeoJsonForecastData(initForecastData, selectedForcastValue);
  }, [initForecastData, selectedForcastValue]);
  const updateFCDataType = (map) => {
    const { forecastGeoJson } = generateGeoJsonForecastData(initForecastData);
    map.current.getSource("latestPV").setData(forecastGeoJson);
    map.current.setPaintProperty(
      "latestPV-forecast",
      "fill-opacity",
      getFillOpacity(selectedDataName, isNormalized),
    );
    setIsToggleLoading(false);
  };

  const addFCData = (map: { current: mapboxgl.Map }) => {
    const { forecastGeoJson } = generateGeoJsonForecastData(initForecastData);

    map.current.addSource("latestPV", {
      type: "geojson",
      data: forecastGeoJson,
    });
    map.current.addLayer({
      id: "latestPV-forecast-borders",
      type: "line",
      source: "latestPV",
      layout: {},
      paint: {
        "line-color": "#ffffff",
        "line-width": 0.6,
        "line-opacity": 0.2,
      },
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
      id: "latestPV-forecast-select-borders",
      type: "line",
      source: "latestPV",
      layout: {},
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
      latestPVData={generatedGeoJsonForecastData.forecastGeoJson}
      controlOverlay={(map: MutableRefObject<any>) => (
        <>
          <ButtonGroup rightString={formatISODateStringHuman(selectedISOTime || "")} />
          <MeasuringUnit
            map={map}
            activeUnit={activeUnit}
            setActiveUnit={setActiveUnit}
            foreCastData={initForecastData}
            isLoading={isToggleLoading}
            setIsLoading={setIsToggleLoading}
            updateFCData={updateFCDataType}
          />
        </>
      )}
    />
  );
};

export default PvLatestMap;
