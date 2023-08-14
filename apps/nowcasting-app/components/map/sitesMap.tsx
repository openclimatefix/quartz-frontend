import React, { Dispatch, SetStateAction, useEffect, useState } from "react";
import mapboxgl, { CircleLayer, Expression } from "mapbox-gl";

import { FailedStateMap, LoadStateMap, Map as MapComponent } from "./";
import { ActiveUnit, SelectedData } from "./types";
import {
  AGGREGATION_LEVEL_MAX_ZOOM,
  AGGREGATION_LEVEL_MIN_ZOOM,
  AGGREGATION_LEVELS,
  MAX_POWER_GENERATED,
  VIEWS
} from "../../constant";
import ButtonGroup from "../../components/button-group";
import gspShapeData from "../../data/gsp_regions_20220314.json";
import regionsGeoJSON from "../../data/dno_license_areas_20200506.json";
import useGlobalState from "../helpers/globalState";
import { formatISODateString, formatISODateStringHuman } from "../helpers/utils";
import {
  AggregatedSitesCombinedData,
  AggregatedSitesDataGroupMap,
  CombinedSitesData,
  FcAllResData
} from "../types";
import { theme } from "../../tailwind.config";
import { Feature, FeatureCollection } from "geojson";
import Slider from "./sitesMapFeatures/sitesZoomSlider";
import SitesLegend from "./sitesMapFeatures/sitesLegend";
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

type SitesMapProps = {
  className?: string;
  sitesData: CombinedSitesData;
  aggregatedSitesData: AggregatedSitesCombinedData;
  sitesErrors: any;
  activeUnit: ActiveUnit;
  setActiveUnit: Dispatch<SetStateAction<ActiveUnit>>;
};

const SitesMap: React.FC<SitesMapProps> = ({
  className,
  sitesData,
  aggregatedSitesData,
  sitesErrors,
  activeUnit,
  setActiveUnit
}) => {
  const [selectedISOTime] = useGlobalState("selectedISOTime");
  const [currentAggregationLevel, setAggregationLevel] = useGlobalState("aggregationLevel");
  const [clickedSiteGroupId, setClickedSiteGroupId] = useGlobalState("clickedSiteGroupId");
  const [newDataForMap, setNewDataForMap] = useState(false);
  const [updatingMapData, setUpdatingMapData] = useState(false);
  const latestForecastValue = 0;
  const isNormalized = activeUnit === ActiveUnit.percentage;
  let selectedDataName = SelectedData.expectedPowerGenerationMegawatts;
  if (activeUnit === ActiveUnit.percentage)
    selectedDataName = SelectedData.expectedPowerGenerationNormalized;
  if (activeUnit === ActiveUnit.capacity) selectedDataName = SelectedData.installedCapacityMw;
  // const {
  //   data: initForecastData,
  //   isValidating,
  //   error: forecastError
  // } = getForecastsData(isNormalized);

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
  // const generatedGeoJsonForecastData = useMemo(() => {
  //   return generateGeoJsonForecastData(initForecastData, selectedISOTime);
  // }, [initForecastData, selectedISOTime]);
  const setSourceData = (source: mapboxgl.GeoJSONSource, featuresArray: Feature[]) => {
    source.setData({
      type: "FeatureCollection",
      features: featuresArray
    });
  };
  const addGroupSource = (
    map: mapboxgl.Map,
    prefix: keyof AggregatedSitesCombinedData,
    featuresArray: Feature[]
  ) => {
    map.addSource(`${prefix}`, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: featuresArray
      }
    });
  };

  const generateFeatureArray = (aggregatedSitesDataGroup: AggregatedSitesDataGroupMap) => {
    const sitesFeatureArray: Feature[] = [];
    Array.from(aggregatedSitesDataGroup.values()).map((site) => {
      const siteFeature: Feature = {
        id: site.id,
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [site.lng, site.lat]
        },
        properties: {
          id: site.id,
          label: site.label,
          capacity: site.capacity,
          expectedPV: site.expectedPV,
          selected: site.id === clickedSiteGroupId
        }
      };
      sitesFeatureArray.push(siteFeature);
    });
    return sitesFeatureArray;
  };

  const updateMapData = (map: mapboxgl.Map) => {
    console.log("start updateMapData");

    if (!newDataForMap) {
      console.log("no new data for map");
      return;
    }
    if (updatingMapData) {
      console.log("already updating map");
      return;
    }
    setUpdatingMapData(true);

    const regionsSource = map.getSource("regions") as mapboxgl.GeoJSONSource;
    if (!regionsSource) {
      map.addSource("regions", {
        type: "geojson",
        data: regionsGeoJSON as FeatureCollection
      });
    }
    map.removeLayer("regions");
    const regionLayer = map.getLayer("regions");
    if (!regionLayer) {
      map.addLayer({
        id: "regions",
        type: "line",
        source: "regions",
        layout: {},
        paint: {
          "line-color": "#ffffff",
          "line-width": 3,
          "line-opacity": 1
        }
      });
      console.log("regions layer added");
    }
    console.log("regions layer", regionLayer);

    // Sites
    addOrUpdateMapGroup(
      map,
      aggregatedSitesData.sites,
      "sites",
      AGGREGATION_LEVELS.SITE,
      AGGREGATION_LEVEL_MIN_ZOOM.SITE,
      AGGREGATION_LEVEL_MAX_ZOOM.SITE
    );

    // GSPs
    addOrUpdateMapGroup(
      map,
      aggregatedSitesData.gsps,
      "gsps",
      AGGREGATION_LEVELS.GSP,
      AGGREGATION_LEVEL_MIN_ZOOM.GSP,
      AGGREGATION_LEVEL_MAX_ZOOM.GSP
    );

    // Regions
    addOrUpdateMapGroup(
      map,
      aggregatedSitesData.regions,
      "regions",
      AGGREGATION_LEVELS.REGION,
      AGGREGATION_LEVEL_MIN_ZOOM.REGION,
      AGGREGATION_LEVEL_MAX_ZOOM.REGION
    );
    setUpdatingMapData(false);
    setNewDataForMap(false);
    console.log("updated map data");
    console.log("end updateMapData");
  };

  const addOrUpdateMapGroup = (
    map: mapboxgl.Map,
    group: AggregatedSitesDataGroupMap,
    groupName: keyof AggregatedSitesCombinedData,
    groupAggregationLevel: AGGREGATION_LEVELS,
    minZoom: AGGREGATION_LEVEL_MIN_ZOOM,
    maxZoom: AGGREGATION_LEVEL_MAX_ZOOM
  ) => {
    console.log("start addOrUpdateMapGroup");

    const source = map.getSource(groupName) as unknown as mapboxgl.GeoJSONSource | undefined;
    const sitesFeatureArray = generateFeatureArray(group);
    if (source) {
      setSourceData(source, sitesFeatureArray);
    } else {
      addGroupSource(map, groupName, sitesFeatureArray);
    }

    // Capacity ring
    let capacityLayer =
      (map.getLayer(`Capacity-${groupName}`) as unknown as CircleLayer) || undefined;
    if (capacityLayer) {
      map.setPaintProperty(`Capacity-${groupName}`, "circle-radius", [
        "*",
        ["to-number", ["get", "capacity"]],
        5
      ]);
      // const visibility = currentAggregationLevel === groupAggregationLevel ? "visible" : "none";
      const visibility = "visible";
      map.setLayoutProperty(`Capacity-${groupName}`, "visibility", visibility);
    } else {
      map.addLayer({
        id: `Capacity-${groupName}`,
        type: "circle",
        source: groupName,
        minzoom: minZoom,
        maxzoom: maxZoom,
        layout: {
          // visibility: currentAggregationLevel === AGGREGATION_LEVELS.SITE ? "visible" : "none"
          visibility: "visible"
        },
        paint: {
          "circle-radius": ["*", ["to-number", ["get", "capacity"]], 5],
          "circle-stroke-color": [
            "case",
            ["boolean", ["get", "selected"], false],
            theme.extend.colors["ocf-orange"].DEFAULT || "#FFAC5F",
            theme.extend.colors["ocf-yellow"].DEFAULT || "#f9d71c"
          ],
          "circle-stroke-width": 1,
          "circle-opacity": 0
        }
      });
      map.on("click", `Capacity-${groupName}`, (e) => {
        console.log(`Capacity click ${groupName}`);
        console.log("e.features", e.features?.[0]);
        setClickedSiteGroupId(e.features?.[0].properties?.id);
      });
    }
    // map.current.on("mousemove", `Capacity-${site.label}`, (e) => {
    //   // Change the cursor style as a UI indicator.
    //   map.current.getCanvas().style.cursor = "pointer";
    //
    //   // Copy coordinates array.
    //   const properties = e.features?.[0].properties;
    //
    //   const popupContent = `<div class="flex flex-col min-w-[16rem] bg-mapbox-black-700 text-white">
    //     <span class="text-lg">${site.label}</span>
    //   </div>`;
    //
    //   // Populate the popup and set its coordinates
    //   // based on the feature found.
    //   popup.setLngLat(e.lngLat).setHTML(popupContent).addTo(map.current);
    // });
    //
    // map.current.on("mouseleave", `Capacity-sites`, () => {
    //   map.current.getCanvas().style.cursor = "";
    //   popup.remove();
    // });

    // Generation circle
    let generationLayer =
      (map.getLayer(`Generation-${groupName}`) as unknown as CircleLayer) || undefined;
    if (generationLayer) {
      map.setPaintProperty(`Generation-${groupName}`, "circle-radius", [
        "*",
        ["to-number", ["get", "expectedPV"]],
        5
      ]);
      // const visibility = currentAggregationLevel === groupAggregationLevel ? "visible" : "none";
      const visibility = "visible";
      map.setLayoutProperty(`Generation-${groupName}`, "visibility", visibility);
    } else {
      map.addLayer({
        id: `Generation-${groupName}`,
        type: "circle",
        source: groupName,
        minzoom: minZoom,
        maxzoom: maxZoom,
        layout: {
          // visibility: currentAggregationLevel !== AGGREGATION_LEVELS.SITE ? "none" : "visible"
          visibility: "visible"
        },
        paint: {
          "circle-radius": ["*", ["to-number", ["get", "expectedPV"]], 5],
          "circle-color": [
            "case",
            ["boolean", ["get", "selected"], false],
            theme.extend.colors["ocf-orange"].DEFAULT || "#FFAC5F",
            theme.extend.colors["ocf-yellow"].DEFAULT || "#f9d71c"
          ],
          "circle-opacity": 0.8
        }
      });
    }
    console.log("end addOrUpdateMapGroup");
  };

  const addFCData = (map: { current: mapboxgl.Map }) => {
    console.log("start addFCData");
    if (
      typeof map.current !== "object" ||
      typeof map.current.getSource !== "function" ||
      // @ts-ignore
      map.current._removed
    ) {
      console.log("map not ready", map.current);
      if (!map.current.isStyleLoaded()) {
        setTimeout(() => {
          addFCData(map);
        }, 200);
      }
      return;
    }
    // const { forecastGeoJson } = generateGeoJsonForecastData(initForecastData, selectedISOTime);
    // Create a popup, but don't add it to the map yet.
    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      anchor: "bottom-right",
      maxWidth: "none"
    });

    // Sites
    addOrUpdateMapGroup(
      map.current,
      aggregatedSitesData.sites,
      "sites",
      AGGREGATION_LEVELS.SITE,
      AGGREGATION_LEVEL_MIN_ZOOM.SITE,
      AGGREGATION_LEVEL_MAX_ZOOM.SITE
    );

    // GSPs
    addOrUpdateMapGroup(
      map.current,
      aggregatedSitesData.gsps,
      "gsps",
      AGGREGATION_LEVELS.GSP,
      AGGREGATION_LEVEL_MIN_ZOOM.GSP,
      AGGREGATION_LEVEL_MAX_ZOOM.GSP
    );

    // Regions
    addOrUpdateMapGroup(
      map.current,
      aggregatedSitesData.regions,
      "regions",
      AGGREGATION_LEVELS.REGION,
      AGGREGATION_LEVEL_MIN_ZOOM.REGION,
      AGGREGATION_LEVEL_MAX_ZOOM.REGION
    );
    console.log("end addFCData");
  };

  useEffect(() => {
    console.log("new aggregatedSitesData", aggregatedSitesData);
    setNewDataForMap(true);
  }, [aggregatedSitesData]);

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
        <MapComponent
          loadDataOverlay={addFCData}
          updateData={{
            newData: newDataForMap,
            updateMapData: (map) => safelyUpdateMapData(map, updateMapData)
          }}
          controlOverlay={(map: { current?: mapboxgl.Map }) => (
            <>
              <ButtonGroup rightString={formatISODateStringHuman(selectedISOTime || "")} />
              <Slider aggregation={currentAggregationLevel} setAggregation={setAggregationLevel} />
              {/* <ShowSiteCount /> */}
            </>
          )}
          title={VIEWS.SOLAR_SITES}
        >
          <SitesLegend color={"color"} />
        </MapComponent>
      )}
    </div>
  );
};

export default SitesMap;
