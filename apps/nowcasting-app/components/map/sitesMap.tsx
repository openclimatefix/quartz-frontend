import { SWRResponse } from "swr";

import React, { Dispatch, SetStateAction, useEffect, useMemo } from "react";
import mapboxgl, { CircleLayer, Expression } from "mapbox-gl";

import { FailedStateMap, LoadStateMap, Map as MapComponent, MeasuringUnit } from "./";
import { ActiveUnit, SelectedData } from "./types";
import {
  AGGREGATION_LEVEL_MIN_ZOOM,
  AGGREGATION_LEVELS,
  MAX_POWER_GENERATED,
  VIEWS
} from "../../constant";
import ButtonGroup from "../../components/button-group";
import gspShapeData from "../../data/gsp_regions_20220314.json";
import gspShapeData2 from "../../data/gsp-regions.json";
import useGlobalState from "../helpers/globalState";
import { formatISODateString, formatISODateStringHuman } from "../helpers/utils";
import {
  AggregatedSitesCombinedData,
  AggregatedSitesDataGroupMap,
  AggregatedSitesDatum,
  CombinedSitesData,
  FcAllResData,
  SitesPvForecast
} from "../types";
import { theme } from "../../tailwind.config";
import ColorGuideBar from "./color-guide-bar";
import { Feature } from "geojson";
import Slider from "./sitesMapFeatures/sitesZoomSlider";
import SitesLegend from "./sitesMapFeatures/sitesLegend";
import ShowSiteCount from "./sitesMapFeatures/showCountTickbox";
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
  const [aggregationLevel, setAggregationLevel] = useGlobalState("aggregationLevel");
  const [clickedSiteGroupId, setClickedSiteGroupId] = useGlobalState("clickedSiteGroupId");
  // const latestForecastValue = 0;
  // const isNormalized = activeUnit === ActiveUnit.percentage;
  // let selectedDataName = SelectedData.expectedPowerGenerationMegawatts;
  // if (activeUnit === ActiveUnit.percentage)
  //   selectedDataName = SelectedData.expectedPowerGenerationNormalized;
  // if (activeUnit === ActiveUnit.capacity) selectedDataName = SelectedData.installedCapacityMw;
  // const {
  //   data: initForecastData,
  //   isValidating,
  //   error: forecastError
  // } = getForecastsData(isNormalized);

  const forecastLoading = false;

  // const getFillOpacity = (selectedData: string, isNormalized: boolean): Expression => [
  //   "interpolate",
  //   ["linear"],
  //   ["to-number", ["get", selectedData]],
  //   // on value 0 the opacity will be 0
  //   0,
  //   0,
  //   // on value maximum the opacity will be 1
  //   isNormalized ? 1 : MAX_POWER_GENERATED,
  //   1
  // ];

  // const generateGeoJsonForecastData: (
  //   forecastData?: FcAllResData,
  //   targetTime?: string
  // ) => { forecastGeoJson: FeatureCollection } = (forecastData, targetTime) => {
  //   // Exclude first item as it's not representing gsp area
  //   const gspForecastData = forecastData?.forecasts?.slice(1);
  //   const gspShapeJson = gspShapeData as FeatureCollection;
  //   const forecastGeoJson = {
  //     ...gspShapeData,
  //     type: "FeatureCollection" as "FeatureCollection",
  //     features: gspShapeJson.features.map((featureObj, index) => {
  //       const forecastDatum = gspForecastData && gspForecastData[index];
  //       let selectedFCValue;
  //       if (gspForecastData && targetTime) {
  //         selectedFCValue = forecastDatum?.forecastValues.find(
  //           (fv) => formatISODateString(fv.targetTime) === formatISODateString(targetTime)
  //         );
  //       } else if (gspForecastData) {
  //         selectedFCValue = forecastDatum?.forecastValues[latestForecastValue];
  //       }
  //
  //       return {
  //         ...featureObj,
  //         properties: {
  //           ...featureObj.properties,
  //           [SelectedData.expectedPowerGenerationMegawatts]:
  //             selectedFCValue && getRoundedPv(selectedFCValue.expectedPowerGenerationMegawatts),
  //           [SelectedData.expectedPowerGenerationNormalized]:
  //             selectedFCValue &&
  //             getRoundedPvPercent(selectedFCValue?.expectedPowerGenerationNormalized || 0),
  //           [SelectedData.installedCapacityMw]: getRoundedPv(
  //             forecastDatum?.location.installedCapacityMw || 0
  //           )
  //         }
  //       };
  //     })
  //   };
  //
  //   return { forecastGeoJson };
  // };
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
    prefix: "site" | "gsp" | "region" | "national",
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
    console.log("updateMapData");
    if (
      typeof map !== "object" ||
      typeof map.getSource !== "function" ||
      // @ts-ignore
      map._removed ||
      !map.isStyleLoaded()
    )
      return;

    // Sites
    const siteSource = map.getSource(`site`) as unknown as mapboxgl.GeoJSONSource | undefined;
    const sitesFeatureArray = generateFeatureArray(aggregatedSitesData.sites);
    if (siteSource) {
      setSourceData(siteSource, sitesFeatureArray);
    } else {
      addGroupSource(map, "site", sitesFeatureArray);
    }

    const capacityLayer = map.getLayer("Capacity-sites");

    if (capacityLayer) {
      // map.setPaintProperty("Capacity-sites", "circle-radius", ["*"["to-number", ["get", "capacity"]]);
      // map.setPaintProperty("Capacity-sites", "circle-color", "red");
    } else {
      // map.addLayer({
      //   id: `Capacity-sites`,
      //   type: "circle",
      //   source: `site`,
      //   // minzoom: AGGREGATION_LEVEL_MIN_ZOOM.SITE,
      //   layout: {
      //     visibility: aggregationLevel === AGGREGATION_LEVELS.SITE ? "visible" : "none"
      //   },
      //   paint: {
      //     "circle-radius": ["*", ["to-number", ["get", "capacity"]], 5],
      //     "circle-stroke-color": theme.extend.colors["ocf-yellow"].DEFAULT || "#f9d71c",
      //     "circle-stroke-width": 1,
      //     // "circle-color": theme.extend.colors["ocf-yellow"].DEFAULT || "#f9d71c",
      //     "circle-opacity": 0
      //   }
      // });
    }

    //   // console.log("aggregationLevel", aggregationLevel);
    //   if (
    //     typeof map !== "object" ||
    //     typeof map.getSource !== "function" ||
    //     // @ts-ignore
    //     map._removed ||
    //     !map.isStyleLoaded()
    //   )
    //     return;
    //
    //   // const source = map.getSource("latestPV") as unknown as mapboxgl.GeoJSONSource | undefined;
    //   // if (generatedGeoJsonForecastData && source) {
    //   //   source?.setData(generatedGeoJsonForecastData.forecastGeoJson);
    //   //   map.setPaintProperty(
    //   //     "latestPV-forecast",
    //   //     "fill-opacity",
    //   //     getFillOpacity(selectedDataName, isNormalized)
    //   //   );
    //   // }
    //
    //   // Sites
    //   Array.from(aggregatedSitesData.sites.values())?.forEach((site) => {
    //     const siteSource = map.getSource(`site-${site.label}`) as unknown as
    //       | mapboxgl.GeoJSONSource
    //       | undefined;
    //     let capacityLayer =
    //       (map.getLayer(`Capacity-${site.label}`) as unknown as CircleLayer) || undefined;
    //     let generationLayer =
    //       (map.getLayer(`Generation-${site.label}`) as unknown as CircleLayer) || undefined;
    //
    //     if (capacityLayer)
    //       map.setLayoutProperty(
    //         `Capacity-${site.label}`,
    //         "visibility",
    //         aggregationLevel !== AGGREGATION_LEVELS.SITE ? "none" : "visible"
    //       );
    //
    //     if (siteSource) {
    //       setSourceData(siteSource, site);
    //     } else {
    //       addGroupSource(map, "site", site);
    //     }
    //
    //     // Capacity ring
    //     if (capacityLayer) {
    //       map.setPaintProperty(
    //         `Capacity-${site.label}`,
    //         "circle-radius",
    //         Math.round(site.capacity * 5)
    //       );
    //     } else {
    //       map.addLayer({
    //         id: `Capacity-${site.label}`,
    //         type: "circle",
    //         source: `site-${site.label}`,
    //         // minzoom: AGGREGATION_LEVEL_MIN_ZOOM.SITE,
    //         paint: {
    //           "circle-stroke-color": theme.extend.colors["ocf-yellow"].DEFAULT || "#f9d71c",
    //           "circle-stroke-width": 1,
    //           "circle-opacity": 0,
    //           "circle-radius": Math.round(site.capacity * 5)
    //         }
    //       });
    //       map.on("click", `Capacity-${site.label}`, (e) => {
    //         console.log("Capacity click site");
    //         console.log("e.features", e.features?.[0]);
    //         setClickedSiteGroupId(site.id);
    //       });
    //     }
    //
    //     // Generation inner circle
    //     if (generationLayer) {
    //       map.setPaintProperty(
    //         `Generation-${site.label}`,
    //         "circle-radius",
    //         Math.round(site.expectedPV * 5)
    //       );
    //     } else {
    //       map.addLayer({
    //         id: `Generation-${site.label}`,
    //         type: "circle",
    //         source: `site-${site.label}`,
    //         // minzoom: AGGREGATION_LEVEL_MIN_ZOOM.SITE,
    //         paint: {
    //           "circle-color": theme.extend.colors["ocf-yellow"].DEFAULT || "#f9d71c",
    //           "circle-radius": Math.round(site.expectedPV * 5),
    //           "circle-opacity": 0.5
    //         }
    //       });
    //     }
    //   });
    //
    //   // GSPs
    //   // Array.from(aggregatedSitesData.gsps.values())?.forEach((gsp) => {
    //   //   const gspSource = map.getSource(`gsp-${gsp.label}`) as unknown as
    //   //     | mapboxgl.GeoJSONSource
    //   //     | undefined;
    //   //   let capacityLayer =
    //   //     (map.getLayer(`Capacity-${gsp.label}`) as unknown as CircleLayer) || undefined;
    //   //   let generationLayer =
    //   //     (map.getLayer(`Generation-${gsp.label}`) as unknown as CircleLayer) || undefined;
    //   //
    //   //   if (capacityLayer)
    //   //     map.setLayoutProperty(
    //   //       `Capacity-${gsp.label}`,
    //   //       "visibility",
    //   //       aggregationLevel !== AGGREGATION_LEVELS.GSP ? "none" : "visible"
    //   //     );
    //   //
    //   //   if (gspSource) {
    //   //     setSourceData(gspSource, gsp);
    //   //   } else {
    //   //     addGroupSource(map, "gsp", gsp);
    //   //   }
    //   //
    //   //   // Capacity ring
    //   //   if (capacityLayer) {
    //   //     map.setPaintProperty(
    //   //       `Capacity-${gsp.label}`,
    //   //       "circle-radius",
    //   //       Math.round(gsp.capacity * 5)
    //   //     );
    //   //   } else {
    //   //     map.addLayer({
    //   //       id: `Capacity-${gsp.label}`,
    //   //       type: "circle",
    //   //       source: `gsp-${gsp.label}`,
    //   //       // minzoom: AGGREGATION_LEVEL_MIN_ZOOM.GSP,
    //   //       paint: {
    //   //         "circle-stroke-color": theme.extend.colors["ocf-yellow"].DEFAULT || "#f9d71c",
    //   //         "circle-stroke-width": 1,
    //   //         "circle-opacity": 0,
    //   //         "circle-radius": Math.round(gsp.capacity * 5)
    //   //       }
    //   //     });
    //   //   }
    //   //
    //   //   // Generation inner circle
    //   //   if (generationLayer) {
    //   //     map.setPaintProperty(
    //   //       `Generation-${gsp.label}`,
    //   //       "circle-radius",
    //   //       Math.round(gsp.expectedPV * 5)
    //   //     );
    //   //   } else {
    //   //     map.addLayer({
    //   //       id: `Generation-${gsp.label}`,
    //   //       type: "circle",
    //   //       source: `gsp-${gsp.label}`,
    //   //       // minzoom: AGGREGATION_LEVEL_MIN_ZOOM.GSP,
    //   //       paint: {
    //   //         "circle-color": theme.extend.colors["ocf-yellow"].DEFAULT || "#f9d71c",
    //   //         "circle-radius": Math.round(gsp.expectedPV * 5),
    //   //         "circle-opacity": 0.5
    //   //       }
    //   //     });
    //   //   }
    //   // });
    //
    //   // Regions
    //   // Array.from(aggregatedSitesData.regions.values())?.forEach((region) => {
    //   //   const regionSource = map.getSource(`region-${region.label}`) as unknown as
    //   //     | mapboxgl.GeoJSONSource
    //   //     | undefined;
    //   //   let capacityLayer =
    //   //     (map.getLayer(`Capacity-${region.label}`) as unknown as CircleLayer) || undefined;
    //   //   let generationLayer =
    //   //     (map.getLayer(`Generation-${region.label}`) as unknown as CircleLayer) || undefined;
    //   //
    //   //   if (capacityLayer)
    //   //     map.setLayoutProperty(
    //   //       `Capacity-${region.label}`,
    //   //       "visibility",
    //   //       aggregationLevel !== AGGREGATION_LEVELS.REGION ? "none" : "visible"
    //   //     );
    //   //
    //   //   if (regionSource) {
    //   //     setSourceData(regionSource, region);
    //   //   } else {
    //   //     addGroupSource(map, "region", region);
    //   //   }
    //   //
    //   //   // Capacity ring
    //   //   if (capacityLayer) {
    //   //     map.setPaintProperty(
    //   //       `Capacity-${region.label}`,
    //   //       "circle-radius",
    //   //       Math.round(region.capacity)
    //   //     );
    //   //   } else {
    //   //     map.addLayer({
    //   //       id: `Capacity-${region.label}`,
    //   //       type: "circle",
    //   //       source: `region-${region.label}`,
    //   //       // minzoom: AGGREGATION_LEVEL_MIN_ZOOM.REGION,
    //   //       paint: {
    //   //         "circle-stroke-color": theme.extend.colors["ocf-yellow"].DEFAULT || "#f9d71c",
    //   //         "circle-stroke-width": 1,
    //   //         "circle-opacity": 0,
    //   //         "circle-radius": Math.round(region.capacity)
    //   //       }
    //   //     });
    //   //   }
    //   //
    //   //   // Generation inner circle
    //   //   if (generationLayer) {
    //   //     map.setPaintProperty(
    //   //       `Generation-${region.label}`,
    //   //       "circle-radius",
    //   //       Math.round(region.expectedPV)
    //   //     );
    //   //   } else {
    //   //     map.addLayer({
    //   //       id: `Generation-${region.label}`,
    //   //       type: "circle",
    //   //       source: `region-${region.label}`,
    //   //       // minzoom: AGGREGATION_LEVEL_MIN_ZOOM.REGION,
    //   //       paint: {
    //   //         "circle-color": theme.extend.colors["ocf-yellow"].DEFAULT || "#f9d71c",
    //   //         "circle-radius": Math.round(region.expectedPV),
    //   //         "circle-opacity": 0.5
    //   //       }
    //   //     });
    //   //   }
    //   // });
  };

  console.log(aggregationLevel);

  const addFCData = (map: { current: mapboxgl.Map }) => {
    // const { forecastGeoJson } = generateGeoJsonForecastData(initForecastData, selectedISOTime);
    // Create a popup, but don't add it to the map yet.
    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      anchor: "bottom-right",
      maxWidth: "none"
    });
    console.log("addFCData");

    // Sites
    const siteSource = map.current.getSource(`site`) as unknown as
      | mapboxgl.GeoJSONSource
      | undefined;
    const sitesFeatureArray = generateFeatureArray(aggregatedSitesData.sites);
    if (siteSource) {
      setSourceData(siteSource, sitesFeatureArray);
    } else {
      addGroupSource(map.current, "site", sitesFeatureArray);
    }

    // Capacity ring
    map.current.addLayer({
      id: `Capacity-sites`,
      type: "circle",
      source: `site`,
      // minzoom: AGGREGATION_LEVEL_MIN_ZOOM.SITE,
      layout: {
        visibility: aggregationLevel === AGGREGATION_LEVELS.SITE ? "visible" : "none"
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

    // map.current.on("mouseleave", `Capacity-sites`, () => {
    //   map.current.getCanvas().style.cursor = "";
    //   popup.remove();
    // });

    // Generation circle
    map.current.addLayer({
      id: `Generation-sites`,
      type: "circle",
      source: `site`,
      // minzoom: AGGREGATION_LEVEL_MIN_ZOOM.SITE,
      layout: {
        visibility: aggregationLevel !== AGGREGATION_LEVELS.SITE ? "none" : "visible"
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
    map.current.on("click", `Capacity-sites`, (e) => {
      console.log("Capacity click site");
      console.log("e.features", e.features?.[0]);
      setClickedSiteGroupId(e.features?.[0].properties?.id);
    });

    // GSPs
    // Array.from(aggregatedSitesData.gsps.values()).map((gsp) => {
    //   addGroupSource(map.current, "gsp", gsp);
    //
    //   // Capacity ring
    //   map.current.addLayer({
    //     id: `Capacity-${gsp.label}`,
    //     type: "circle",
    //     source: `gsp-${gsp.label}`,
    //     layout: {
    //       visibility: aggregationLevel !== AGGREGATION_LEVELS.GSP ? "none" : "visible"
    //     },
    //     // minzoom: AGGREGATION_LEVEL_MIN_ZOOM.GSP,
    //     paint: {
    //       "circle-radius": Math.round(gsp.capacity * 5),
    //       "circle-stroke-color": theme.extend.colors["ocf-yellow"].DEFAULT || "#f9d71c",
    //       "circle-stroke-width": 1,
    //       "circle-opacity": 0
    //     }
    //   });
    //
    //   map.current.on("mousemove", `Capacity-${gsp.label}`, (e) => {
    //     // Change the cursor style as a UI indicator.
    //     map.current.getCanvas().style.cursor = "pointer";
    //
    //     const popupContent = `<div class="flex flex-col min-w-[16rem] bg-mapbox-black-700 text-white">
    //       <span class="text-lg">${gsp.label}</span>
    //     </div>`;
    //
    //     // Populate the popup and set its coordinates
    //     // based on the feature found.
    //     popup.setLngLat(e.lngLat).setHTML(popupContent).addTo(map.current);
    //   });
    //
    //   map.current.on("mouseleave", `Capacity-${gsp.label}`, () => {
    //     map.current.getCanvas().style.cursor = "";
    //     popup.remove();
    //   });
    //
    //   // Generation inner circle
    //   map.current.addLayer({
    //     id: `Generation-${gsp.label}`,
    //     type: "circle",
    //     source: `gsp-${gsp.label}`,
    //     layout: {
    //       visibility: aggregationLevel !== AGGREGATION_LEVELS.GSP ? "none" : "visible"
    //     },
    //     // minzoom: AGGREGATION_LEVEL_MIN_ZOOM.GSP,
    //     paint: {
    //       "circle-color": theme.extend.colors["ocf-yellow"].DEFAULT || "#f9d71c",
    //       "circle-radius": Math.round(gsp.expectedPV * 5),
    //       "circle-opacity": 0.5
    //     }
    //   });
    // });

    // Regions
    // Array.from(aggregatedSitesData.regions.values()).map((region) => {
    //   addGroupSource(map.current, "region", region);
    //
    //   // Capacity ring
    //   map.current.addLayer({
    //     id: `Capacity-${region.label}`,
    //     type: "circle",
    //     source: `region-${region.label}`,
    //     layout: {
    //       visibility: aggregationLevel !== AGGREGATION_LEVELS.REGION ? "none" : "visible"
    //     },
    //     // minzoom: AGGREGATION_LEVEL_MIN_ZOOM.REGION,
    //     paint: {
    //       "circle-radius": Math.round(region.capacity * 5),
    //       "circle-stroke-color": theme.extend.colors["ocf-yellow"].DEFAULT || "#f9d71c",
    //       "circle-stroke-width": 1,
    //       "circle-opacity": 0
    //     }
    //   });
    //
    //   map.current.on("mousemove", `Capacity-${region.label}`, (e) => {
    //     // Change the cursor style as a UI indicator.
    //     map.current.getCanvas().style.cursor = "pointer";
    //
    //     const popupContent = `<div class="flex flex-col min-w-[16rem] bg-mapbox-black-700 text-white">
    //       <span class="text-lg">${region.label}</span>
    //     </div>`;
    //
    //     // Populate the popup and set its coordinates
    //     // based on the feature found.
    //     popup.setLngLat(e.lngLat).setHTML(popupContent).addTo(map.current);
    //   });
    //
    //   // Generation inner circle
    //   map.current.addLayer({
    //     id: `Generation-${region.label}`,
    //     type: "circle",
    //     source: `region-${region.label}`,
    //     layout: {
    //       visibility: aggregationLevel !== AGGREGATION_LEVELS.REGION ? "none" : "visible"
    //     },
    //     // minzoom: AGGREGATION_LEVEL_MIN_ZOOM.REGION,
    //     paint: {
    //       "circle-color": theme.extend.colors["ocf-yellow"].DEFAULT || "#f9d71c",
    //       "circle-radius": Math.round(region.expectedPV * 5),
    //       "circle-opacity": 0.5
    //     }
    //   });
    //
    //   map.current.on("mouseleave", `Capacity-${region.label}`, () => {
    //     map.current.getCanvas().style.cursor = "";
    //     popup.remove();
    //   });
    // });

    // Latest PV
    // map.current.addSource("latestPV", {
    //   type: "geojson",
    //   data: forecastGeoJson
    // });
    //
    // map.current.addLayer({
    //   id: "latestPV-forecast",
    //   type: "fill",
    //   source: "latestPV",
    //   layout: { visibility: "visible" },
    //   paint: {
    //     "fill-color": yellow,
    //     "fill-opacity": getFillOpacity(selectedDataName, isNormalized)
    //   }
    // });
    //
    // map.current.addLayer({
    //   id: "latestPV-forecast-borders",
    //   type: "line",
    //   source: "latestPV",
    //   paint: {
    //     "line-color": "#ffffff",
    //     "line-width": 0.6,
    //     "line-opacity": 0.2
    //   }
    // });
    //
    // map.current.addLayer({
    //   id: "latestPV-forecast-select-borders",
    //   type: "line",
    //   source: "latestPV",
    //   paint: {
    //     "line-color": "#ffffff",
    //     "line-width": 4,
    //     "line-opacity": ["case", ["boolean", ["feature-state", "click"], false], 1, 0]
    //   }
    // });
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
        <MapComponent
          loadDataOverlay={addFCData}
          updateData={{ newData: !!aggregatedSitesData && aggregationLevel, updateMapData }}
          controlOverlay={(map: { current?: mapboxgl.Map }) => (
            <>
              <ButtonGroup rightString={formatISODateStringHuman(selectedISOTime || "")} />
              {/* <Slider aggregation={aggregationLevel} setAggregation={setAggregationLevel} /> */}
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
