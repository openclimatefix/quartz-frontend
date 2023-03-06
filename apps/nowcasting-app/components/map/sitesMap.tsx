import { SWRResponse } from "swr";

import React, { Dispatch, SetStateAction, useMemo } from "react";
import mapboxgl, { CircleLayer, Expression } from "mapbox-gl";

import { FailedStateMap, LoadStateMap, Map, MeasuringUnit } from "./";
import { ActiveUnit, SelectedData } from "./types";
import { MAX_POWER_GENERATED, VIEWS } from "../../constant";
import ButtonGroup from "../../components/button-group";
import gspShapeData from "../../data/gsp_regions_20220314.json";
import useGlobalState from "../helpers/globalState";
import { formatISODateString, formatISODateStringHuman } from "../helpers/utils";
import { CombinedSitesData, FcAllResData, SitesPvForecast } from "../types";
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

type SitesMapProps = {
  className?: string;
  getForecastsData: (isNormalized: boolean) => SWRResponse<FcAllResData, any>;
  sitesData: CombinedSitesData;
  sitesErrors: any;
  activeUnit: ActiveUnit;
  setActiveUnit: Dispatch<SetStateAction<ActiveUnit>>;
};

const SitesMap: React.FC<SitesMapProps> = ({
  className,
  getForecastsData,
  sitesData,
  sitesErrors,
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
    targetTime?: string
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
    if (
      typeof map !== "object" ||
      typeof map.getSource !== "function" ||
      // @ts-ignore
      map._removed ||
      !map.getSource("latestPV")
    )
      return;

    const source = map.getSource("latestPV") as unknown as mapboxgl.GeoJSONSource | undefined;
    if (generatedGeoJsonForecastData && source) {
      source?.setData(generatedGeoJsonForecastData.forecastGeoJson);
      map.setPaintProperty(
        "latestPV-forecast",
        "fill-opacity",
        getFillOpacity(selectedDataName, isNormalized)
      );
    }
    sitesData.allSitesData?.forEach((site) => {
      const expectedPowerGeneration = getExpectedPowerGenerationForSite(
        site.site_uuid,
        selectedISOTime || new Date().toISOString()
      );
      const siteSource = map.getSource(`site-${site.site_uuid}`) as unknown as
        | mapboxgl.GeoJSONSource
        | undefined;
      console.log("expectedPowerGeneration", expectedPowerGeneration);

      if (siteSource) {
        siteSource.setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [site.longitude, site.latitude]
              },
              properties: {
                site_uuid: site.site_uuid,
                siteName: site.client_site_id,
                installedCapacityMw: site.installed_capacity_kw,
                expectedPowerGenerationMegawatts: expectedPowerGeneration,
                expectedPowerGenerationNormalized: 0
              }
            }
          ]
        });
      } else {
        map.addSource(`site-${site.site_uuid}`, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: [site.longitude, site.latitude]
                },
                properties: {
                  site_uuid: site.site_uuid,
                  siteName: site.client_site_id,
                  installedCapacityMw: site.installed_capacity_kw,
                  expectedPowerGenerationMegawatts: expectedPowerGeneration,
                  expectedPowerGenerationNormalized: 0
                }
              }
            ]
          }
        });
      }
      // Capacity ring
      const capacityLayer =
        (map.getLayer(`Capacity-${site.site_uuid}`) as unknown as CircleLayer) || undefined;
      if (capacityLayer) {
        map.setPaintProperty(
          `Capacity-${site.site_uuid}`,
          "circle-radius",
          Math.round(site.installed_capacity_kw * 4)
        );
      }
      const generationLayer =
        (map.getLayer(`Generation-${site.site_uuid}`) as unknown as CircleLayer) || undefined;
      if (generationLayer) {
        map.setPaintProperty(
          `Generation-${site.site_uuid}`,
          "circle-radius",
          Math.round(expectedPowerGeneration * 4)
        );
      } else {
        map.addLayer({
          id: `Generation-${site.site_uuid}`,
          type: "circle",
          source: `site-${site.site_uuid}`,
          paint: {
            "circle-color": "#FF0000",
            "circle-radius": Math.round(expectedPowerGeneration * 4),
            "circle-opacity": 0.5
          }
        });
      }
    });
  };

  const getExpectedPowerGenerationForSite = (site_uuid: string, targetTime: string) => {
    const siteForecast = sitesData.sitesPvForecastData.find((fc) => fc.site_uuid === site_uuid);
    return (
      (siteForecast?.forecast_values.find(
        (fv) => formatISODateString(fv.target_datetime_utc) === formatISODateString(targetTime)
      )?.expected_generation_kw || 0) / 1000
    );
  };

  console.log("sitesData", sitesData);

  const addFCData = (map: { current: mapboxgl.Map }) => {
    const { forecastGeoJson } = generateGeoJsonForecastData(initForecastData, selectedISOTime);

    sitesData.allSitesData?.map((site) => {
      console.log("site map", site);
      const expectedPowerGeneration = getExpectedPowerGenerationForSite(
        site.site_uuid,
        selectedISOTime || new Date().toISOString()
      );
      map.current.addSource(`site-${site.site_uuid}`, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [site.longitude, site.latitude]
              },
              properties: {
                site_uuid: site.site_uuid,
                siteName: site.client_site_id,
                installedCapacityMw: site.installed_capacity_kw,
                expectedPowerGenerationMegawatts: expectedPowerGeneration,
                expectedPowerGenerationNormalized: 0
              }
            }
          ]
        }
      });
      // Capacity ring
      map.current.addLayer({
        id: `Capacity-${site.site_uuid}`,
        type: "circle",
        source: `site-${site.site_uuid}`,
        paint: {
          "circle-radius": Math.round(site.installed_capacity_kw * 4),
          "circle-stroke-color": theme.extend.colors["ocf-yellow"].DEFAULT || "#f9d71c",
          "circle-stroke-width": 1,
          // "circle-color": theme.extend.colors["ocf-yellow"].DEFAULT || "#f9d71c",
          "circle-opacity": 0
        }
      });
      // Generation circle
      map.current.addLayer({
        id: `Generation-${site.site_uuid}`,
        type: "circle",
        source: `site-${site.site_uuid}`,
        paint: {
          "circle-radius": Math.round(expectedPowerGeneration * 4),
          // "circle-stroke-color": theme.extend.colors["ocf-yellow"].DEFAULT || "#f9d71c",
          // "circle-stroke-width": 1,
          "circle-color": theme.extend.colors["ocf-yellow"].DEFAULT || "#f9d71c",
          "circle-opacity": 0.8
        }
      });
    });

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
  // return <div>Empty</div>;

  return (
    <div className={`relative h-full w-full ${className}`}>
      {sitesErrors?.length ? (
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
          title={VIEWS.FORECAST}
        >
          <ColorGuideBar unit={activeUnit} />
        </Map>
      )}
    </div>
  );
};

export default SitesMap;
