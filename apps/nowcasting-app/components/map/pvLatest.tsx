import useSWR, { mutate } from "swr";
import { MutableRefObject, useEffect, useState } from "react";

import { FaildStateMap, LoadStateMap, Map, MeasuringUnit } from "./";
import { ActiveUnit, SelectedData } from "./types";
import { API_PREFIX, MAX_POWER_GENERATED } from "../../constant";
import ButtonGroup from "../../components/button-group";
import gspShapeData from "../../data/gsp-regions.json";


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
  const selectedDataName = activeUnit === ActiveUnit.percentage
  ? SelectedData.expectedPowerGenerationNormalized
  : SelectedData.expectedPowerGenerationMegawatts;

  const { data: initForecastData } = useSWR(() =>
    forecastUrl(isNormalized),
    fetcher, 
    {
      onSuccess: () => {
        setForecastError(false);
        setForecastLoading(false);
      },
      onError: (err) => setForecastError(err),
      // revalidateOnMount: false
      refreshInterval: 30000
    }
  );

  useEffect(() => console.log("first Render"), []);

  const getFillOpacity = (selectedData: string, isNormalized: boolean) => ([
    "interpolate", ["linear"],
    ['get', selectedData],
    // on value 0 the opacity will be 0
    0, 0,
    // on value maximum the opacity will be 1
    isNormalized ? 1 : MAX_POWER_GENERATED, 1,
  ]);

  const generateGeoJsonForecastData = (forecastData) => {
    // Exclude first item as it's not represting gsp area
    const filteredForcastData = forecastData?.forecasts?.slice(1);

    const forecastGeoJson = {
      ...gspShapeData,
      features: gspShapeData.features.map((featureObj, index) => (
        {
          ...featureObj,
          properties: {
            ...featureObj.properties,
            [selectedDataName]: isNormalized 
            ? filteredForcastData[index].forecastValues[latestForecastValue][selectedDataName]
            : Math.round(filteredForcastData[index].forecastValues[latestForecastValue][selectedDataName])
          }
        }
      ))
    };

    return {forecastGeoJson};
  }

  const getPaintPropsForFC = () => {
    return (
    {   
      "fill-color": "#eab308",
      "fill-opacity": getFillOpacity(selectedDataName, isNormalized),
    }
  )};

  const updateFCDataType = (map) => {
    const { forecastGeoJson } = generateGeoJsonForecastData(initForecastData);
    map.current.getSource('latestPV').setData(forecastGeoJson);
    map.current.setPaintProperty('latestPV-forecast', "fill-opacity", getFillOpacity(selectedDataName, isNormalized));
    setIsToggleLoading(false);
  }

  const addFCData = (map) => {
    const { forecastGeoJson } = generateGeoJsonForecastData(initForecastData);

    map.current.addSource("latestPV", {
      type: "geojson",
      data: forecastGeoJson
    });

    map.current.addLayer({
      id: "latestPV-forecast",
      type: "fill",
      source: "latestPV",
      layout: {visibility: "visible"},
      paint: getPaintPropsForFC(),
    });

    // const updateSource = setInterval(async (type) => {
    //   try {
    //     const latestForecastData = await mutate(
    //       forecastUrl(type),
    //     );
  
    //     console.log("update", map.current.getPaintProperty('latestPV-forecast', "fill-opacity"));
    //     const {forecastGeoJson} = generateGeoJsonForecastData(latestForecastData);
    //     map.current.getSource('latestPV').setData(forecastGeoJson);
    //   } catch {
    //     if (updateSource) clearInterval(updateSource);
    //   }
    //   // every 5 minutes
    // }, 30000);
  };

  return (
    (forecastError) ? (
      <FaildStateMap error="Failed to load" />
    ) 
    : (forecastLoading) ? (
      <LoadStateMap>
        <ButtonGroup />
      </LoadStateMap>
    )
    : (
      <Map
        loadDataOverlay={addFCData}
        controlOverlay={(map: MutableRefObject<any>) => (
          <>
            <ButtonGroup />
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
    )        
  );
}

export default PvLatestMap; 
