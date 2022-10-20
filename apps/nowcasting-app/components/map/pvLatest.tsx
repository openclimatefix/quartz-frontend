import useSWR from "swr";
import useSWRImmutable from "swr/immutable";

import { useEffect, useMemo, useState } from "react";
import mapboxgl, { Expression } from "mapbox-gl";

import { FailedStateMap, LoadStateMap, Map, MeasuringUnit } from "./";
import { ActiveUnit, SelectedData } from "./types";
import { getAllForecastUrl, MAX_POWER_GENERATED } from "../../constant";
import ButtonGroup from "../../components/button-group";
import gspShapeData from "../../data/gsp_regions_20220314.json";
import useGlobalState from "../helpers/globalState";
import { axiosFetcher, formatISODateString, formatISODateStringHuman } from "../helpers/utils";
import { FcAllResData } from "../types";
import { theme } from "../../tailwind.config";
import ColorGuideBar from "./color-guide-bar";
import { FeatureCollection } from "geojson";
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
// Assuming first item in the array is the latest
const latestForecastValue = 0;
const useGetForecastsData = (isNormalized: boolean) => {
  const [forecastLoading, setForecastLoading] = useState(true);
  const [, setForecastCreationTime] = useGlobalState("forecastCreationTime");
  const bareForecastData = useSWRImmutable<FcAllResData>(
    () => getAllForecastUrl(false, false),
    axiosFetcher,
    {
      onSuccess: (data) => {
        setForecastCreationTime(data.forecasts[0].forecastCreationTime);
        setForecastLoading(false);
      }
    }
  );

  const allForecastData = useSWR<FcAllResData>(() => getAllForecastUrl(true, true), axiosFetcher, {
    refreshInterval: 1000 * 60 * 5, // 5min
    isPaused: () => forecastLoading,
    onSuccess: (data) => {
      setForecastCreationTime(data.forecasts[0].forecastCreationTime);
      allForecastData.mutate();
    }
  });
  if (isNormalized) return allForecastData;
  else return allForecastData.data ? allForecastData : bareForecastData;
};

const PvLatestMap = () => {
  const [activeUnit, setActiveUnit] = useState<ActiveUnit>(ActiveUnit.MW);
  const [selectedISOTime] = useGlobalState("selectedISOTime");

  const isNormalized = activeUnit === ActiveUnit.percentage;
  let selectedDataName = SelectedData.expectedPowerGenerationMegawatts;
  if (activeUnit === ActiveUnit.percentage)
    selectedDataName = SelectedData.expectedPowerGenerationNormalized;
  if (activeUnit === ActiveUnit.capacity) selectedDataName = SelectedData.installedCapacityMw;

  const {
    data: initForecastData,
    isValidating,
    error: forecastError
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
    1
  ];

  const generateGeoJsonForecastData: (
    forecastData?: FcAllResData,
    targetTime?: string
  ) => { forecastGeoJson: FeatureCollection } = (forecastData, targetTime) => {
    // Exclude first item as it's not representing gsp area
    const filteredForecastData = forecastData?.forecasts?.slice(1);
    const gspShapeJson = gspShapeData as FeatureCollection;
    const forecastGeoJson = {
      ...gspShapeData,
      type: "FeatureCollection" as "FeatureCollection",
      features: gspShapeJson.features.map((featureObj, index) => {
        const forecastDatum = filteredForecastData && filteredForecastData[index];
        const selectedFCValue =
          filteredForecastData && targetTime
            ? forecastDatum?.forecastValues.find(
                (fv) => formatISODateString(fv.targetTime) === formatISODateString(targetTime)
              )
            : filteredForecastData
            ? forecastDatum?.forecastValues[latestForecastValue]
            : undefined;

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
    const source = map.getSource("latestPV") as unknown as mapboxgl.GeoJSONSource | undefined;
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

  return forecastError ? (
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
          <MeasuringUnit
            activeUnit={activeUnit}
            setActiveUnit={setActiveUnit}
            isLoading={isValidating && !initForecastData}
          />
        </>
      )}
    >
      <ColorGuideBar unit={activeUnit} />
    </Map>
  );
};

export default PvLatestMap;
