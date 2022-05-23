import useSWR from "swr";
import { useState } from "react";

import { FaildStateMap, LoadStateMap, Map } from "./";
import { API_PREFIX, MAX_POWER_GENERATED } from "../../constant";
import ButtonGroup from "../../components/button-group";
import gspShapeData from "../../data/gsp-regions.json";
import useGlobalState from "../globalState";
import { formatISODateStringHuman } from "../utils";
import { FcAllResData } from "../types";
import mapboxgl, { FillPaint } from "mapbox-gl";

const fetcher = (input: RequestInfo, init: RequestInit) =>
  fetch(input, init).then((res) => res.json());

// Assuming first item in the array is the latest
const latestForecastValue = 0;

const PvLatestMap = () => {
  const [forecastLoading, setForecastLoading] = useState(true);
  const [forecastError, setForecastError] = useState<any>(false);
  const [selectedISOTime] = useGlobalState("selectedISOTime");
  const { data: initForecastData, mutate } = useSWR(
    `${API_PREFIX}/GB/solar/gsp/forecast/all`,
    fetcher,
    {
      onSuccess: () => {
        setForecastError(false);
        setForecastLoading(false);
      },
      onError: (err) => setForecastError(err),
    },
  );

  const generateGeoJsonForecastData = (forecastData: FcAllResData) => {
    // Exclude first item as it's not represting gsp area
    const filteredForcastData = forecastData?.forecasts?.slice(1);
    const gspShapeDatat = gspShapeData as GeoJSON.FeatureCollection<GeoJSON.Geometry>;
    const forecastGeoJson = {
      ...gspShapeDatat,
      features: gspShapeDatat.features.map((featureObj, index) => ({
        ...featureObj,
        properties: {
          ...featureObj.properties,
          expectedPowerGenerationMegawatts: Math.round(
            filteredForcastData[index].forecastValues[latestForecastValue]
              .expectedPowerGenerationMegawatts,
          ),
        },
      })),
    };

    return { forecastGeoJson };
  };

  const getPaintPropsForFC = (): FillPaint => ({
    "fill-color": "#eab308",
    "fill-opacity": [
      "interpolate",
      ["linear"],
      ["get", "expectedPowerGenerationMegawatts"],
      // on value 0 the opacity will be 0
      0,
      0,
      // on value maximum the opacity will be 1
      MAX_POWER_GENERATED,
      1,
    ],
  });

  const addFCData = (map: { current: mapboxgl.Map }) => {
    const { forecastGeoJson } = generateGeoJsonForecastData(initForecastData);

    map.current.addSource("latestPV", {
      type: "geojson",
      data: forecastGeoJson,
    });

    map.current.addLayer({
      id: "latestPV-forecast",
      type: "fill",
      source: "latestPV",
      layout: { visibility: "visible" },
      paint: getPaintPropsForFC(),
    });

    const updateSource = setInterval(async () => {
      try {
        const updatedForecastData = await mutate(`${API_PREFIX}/GB/solar/gsp/forecast/all`);

        // console.log("sucess");
        const { forecastGeoJson } = generateGeoJsonForecastData(updatedForecastData);
        (map.current.getSource("latestPV") as mapboxgl.GeoJSONSource).setData(forecastGeoJson);
      } catch {
        if (updateSource) clearInterval(updateSource);
      }
      // every 5 minutes
    }, 300000);
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
      controlOverlay={() => (
        <ButtonGroup rightString={formatISODateStringHuman(selectedISOTime || "")} />
      )}
    />
  );
};

export default PvLatestMap;
