import React, { Dispatch, SetStateAction, useEffect, useState } from "react";
import mapboxgl, { CircleLayer, Expression } from "mapbox-gl";

import { FailedStateMap, LoadStateMap, Map as MapComponent } from "./";
import { ActiveUnit, MAP_TITLE_SOLAR_SITES, SelectedData } from "./types";
import {
  AGGREGATION_LEVEL_MAX_ZOOM,
  AGGREGATION_LEVEL_MIN_ZOOM,
  AGGREGATION_LEVELS,
  MAX_POWER_GENERATED
} from "../../constant";
import { loadGeoAsset } from "../../lib/geo/assets";
import useGlobalState, { useCountryState } from "../helpers/globalState";
import {
  formatISODateString,
  formatISODateStringHuman,
  getRoundedPv,
  getRoundedPvPercent
} from "../helpers/utils";
import { useCountryFormatting } from "../../hooks/data/use-country-format";
import {
  AggregatedSitesCombinedData,
  AggregatedSitesDataGroupMap,
  CombinedSitesData,
  FcAllResData,
  SitesCombinedErrors
} from "../types";
import { theme } from "../../tailwind.config";
import { Feature, FeatureCollection } from "geojson";
import Slider from "./sitesMapFeatures/sitesZoomSlider";
import { safelyUpdateMapData } from "../helpers/mapUtils";
import dynamic from "next/dynamic";

const yellow = theme.extend.colors.solar.DEFAULT;
const ButtonGroup = dynamic(() => import("../../components/button-group"), { ssr: false });

type SitesMapProps = {
  className?: string;
  sitesData: CombinedSitesData;
  aggregatedSitesData: AggregatedSitesCombinedData;
  /** Typed rather than `any`, which is what let `sitesErrors?.length` compile on an object. */
  sitesErrors: SitesCombinedErrors;
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
  const { timezone, locale } = useCountryFormatting();
  const [currentAggregationLevel, setAggregationLevel] = useCountryState("aggregationLevel");
  const [clickedSiteGroupId, setClickedSiteGroupId] = useCountryState("clickedSiteGroupId");
  const [autoZoom] = useGlobalState("autoZoom");

  // GSP and DNO boundary polygons, used only to draw the two outline overlays below (never
  // joined against site data — verified: neither feature set is keyed against site/GSP data
  // anywhere in this file, both are added to Mapbox as-is), fetched once per session via the
  // shared `loadGeoAsset` cache rather than bundled — this pair was 25 MB of the JS bundle.
  // GSP boundaries are the canonical 2026 NESO file (`/geo/gb/gsp.json`), the same asset the
  // region view uses — Brad's call, since sitesMap previously drew the stale 2022 vintage and
  // there is now exactly one GSP boundary asset in the repo. `dno.json` is the same source
  // file the region view's derived DNO level already ships, reused as-is.
  const [gspShapeData, setGspShapeData] = useState<FeatureCollection | undefined>(undefined);
  const [dnoShapeData, setDnoShapeData] = useState<FeatureCollection | undefined>(undefined);

  const [newDataForMap, setNewDataForMap] = useState(false);
  const [updatingMapData, setUpdatingMapData] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGeoAsset<FeatureCollection>("/geo/gb/gsp.json").then((data) => {
      if (cancelled) return;
      setGspShapeData(data);
      // The boundary source is only added once its data has arrived (see
      // addOrUpdateMapGroup below); re-flag so that pass runs again now that it has.
      setNewDataForMap(true);
    });
    loadGeoAsset<FeatureCollection>("/geo/gb/dno.json").then((data) => {
      if (cancelled) return;
      setDnoShapeData(data);
      setNewDataForMap(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
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

  useEffect(() => {
    setNewDataForMap(true);
  }, [clickedSiteGroupId, autoZoom]);

  useEffect(() => {
    setClickedSiteGroupId(undefined);
    setNewDataForMap(true);
  }, [currentAggregationLevel, setClickedSiteGroupId]);

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

  const getRingMultiplier = (aggregationLevel: AGGREGATION_LEVELS) => {
    // TODO: this will need to be dynamic depending on user's site capacities
    switch (aggregationLevel) {
      case AGGREGATION_LEVELS.SITE:
        return 10;
      case AGGREGATION_LEVELS.GSP:
        return 5;
      case AGGREGATION_LEVELS.REGION:
        return 1.5;
      case AGGREGATION_LEVELS.NATIONAL:
        return 0.3;
    }
  };

  const generateGeoJsonForecastData: (
    forecastData?: FcAllResData,
    targetTime?: string
  ) => { forecastGeoJson: FeatureCollection } = (forecastData, targetTime) => {
    // Exclude first item as it's not representing gsp area
    const gspForecastData = forecastData?.forecasts?.slice(1);
    // gspShapeData is now fetched (see the effect above) rather than bundled, so it may not
    // have arrived yet. This function's only caller is commented out above (dead today), but
    // it is kept type-safe against the async load rather than deleted along with it.
    const gspShapeJson: FeatureCollection = gspShapeData ?? {
      type: "FeatureCollection",
      features: []
    };
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
            [SelectedData.expectedPowerGenerationMegawattsRounded]:
              selectedFCValue && getRoundedPv(selectedFCValue.expectedPowerGenerationMegawatts),
            [SelectedData.expectedPowerGenerationNormalizedRounded]:
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
          // Make the radius of the circle where the area is proportional to the expectedPV
          // We know expectedPVRadius has to be proportional to sqrt(expectedPV),
          // But this didn't look good, so took took halfway between linear and area
          // and if expectedPV == capacity, then expectedPVRadius == capacity, therefore
          expectedPVRadius: Math.pow(site.expectedPV, 0.67) * Math.pow(site.capacity, 0.34),
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

    // Sites
    addOrUpdateMapGroup(
      map,
      aggregatedSitesData.sites,
      "sites",
      AGGREGATION_LEVELS.SITE,
      AGGREGATION_LEVEL_MIN_ZOOM.SITE,
      AGGREGATION_LEVEL_MAX_ZOOM.SITE,
      autoZoom
    );

    // GSPs
    addOrUpdateMapGroup(
      map,
      aggregatedSitesData.gsps,
      "gsps",
      AGGREGATION_LEVELS.GSP,
      AGGREGATION_LEVEL_MIN_ZOOM.GSP,
      AGGREGATION_LEVEL_MAX_ZOOM.GSP,
      autoZoom
    );

    // Regions
    addOrUpdateMapGroup(
      map,
      aggregatedSitesData.regions,
      "regions",
      AGGREGATION_LEVELS.REGION,
      AGGREGATION_LEVEL_MIN_ZOOM.REGION,
      AGGREGATION_LEVEL_MAX_ZOOM.REGION,
      autoZoom
    );

    // National
    addOrUpdateMapGroup(
      map,
      aggregatedSitesData.national,
      "national",
      AGGREGATION_LEVELS.NATIONAL,
      AGGREGATION_LEVEL_MIN_ZOOM.NATIONAL,
      AGGREGATION_LEVEL_MAX_ZOOM.NATIONAL,
      autoZoom
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
    maxZoom: AGGREGATION_LEVEL_MAX_ZOOM,
    autoZoom: boolean = true
  ) => {
    console.log("start addOrUpdateMapGroup:", groupName);

    const source = map.getSource(groupName) as unknown as mapboxgl.GeoJSONSource | undefined;
    const groupFeatureArray = generateFeatureArray(group);
    if (source) {
      setSourceData(source, groupFeatureArray);
    } else {
      addGroupSource(map, groupName, groupFeatureArray);
    }

    if (groupName === "regions") {
      let dnoBoundariesSource = map.getSource("dnoBoundaries") as unknown as
        | mapboxgl.GeoJSONSource
        | undefined;
      // dnoShapeData now arrives from a fetch (see the effect above) rather than being
      // available synchronously on first render. The source is therefore added ONCE with an
      // empty collection and populated when the geometry lands — never conditionally on the
      // data being present. The layer below is added unconditionally and names this source,
      // so deferring the source until the fetch resolves makes `addLayer` reference a source
      // that does not exist yet, which Mapbox throws on.
      if (!dnoBoundariesSource) {
        map.addSource("dnoBoundaries", {
          type: "geojson",
          data: dnoShapeData ?? { type: "FeatureCollection", features: [] }
        });
      } else if (dnoShapeData) {
        dnoBoundariesSource.setData(dnoShapeData);
      }

      let dnoBoundariesLayer =
        (map.getLayer(`dnoBoundaries`) as unknown as CircleLayer) || undefined;
      if (!dnoBoundariesLayer) {
        map.addLayer({
          id: "dnoBoundaries",
          type: "line",
          source: "dnoBoundaries",
          // Test showing DNO region boundaries at all zoom levels
          // minzoom: AGGREGATION_LEVEL_MIN_ZOOM.REGION,
          // maxzoom: AGGREGATION_LEVEL_MAX_ZOOM.REGION,
          paint: {
            "line-color": "#ffcc2d",
            "line-width": 0.6,
            "line-opacity": 0.5
          }
        });
      }
    }

    if (groupName === "gsps") {
      let gspBoundariesSource = map.getSource("gspBoundaries") as unknown as
        | mapboxgl.GeoJSONSource
        | undefined;
      // Same deferred-arrival handling as dnoBoundaries above: source added once, empty,
      // then populated — so the unconditional `addLayer` below always has it to point at.
      if (!gspBoundariesSource) {
        map.addSource("gspBoundaries", {
          type: "geojson",
          data: gspShapeData ?? { type: "FeatureCollection", features: [] }
        });
      } else if (gspShapeData) {
        gspBoundariesSource.setData(gspShapeData);
      }

      let gspBoundariesLayer =
        (map.getLayer(`gspBoundaries`) as unknown as CircleLayer) || undefined;
      if (!gspBoundariesLayer) {
        map.addLayer({
          id: "gspBoundaries",
          type: "line",
          source: "gspBoundaries",
          paint: {
            "line-color": "#ffffff",
            "line-width": 0.6,
            "line-opacity": 0.2
          }
        });
      }
    }

    // Define visibility depending on currentAggregationLevel and autoZoom
    let visibility: "visible" | "none";
    if (!autoZoom) {
      if (currentAggregationLevel === groupAggregationLevel) {
        visibility = "visible";
      } else {
        visibility = "none";
      }
    } else {
      visibility = "visible";
    }

    // Capacity ring
    let capacityLayer =
      (map.getLayer(`Capacity-${groupName}`) as unknown as CircleLayer) || undefined;
    if (capacityLayer) {
      map.setPaintProperty(`Capacity-${groupName}`, "circle-radius", [
        "*",
        ["to-number", ["get", "capacity"]],
        getRingMultiplier(groupAggregationLevel)
      ]);
      // const visibility = currentAggregationLevel === groupAggregationLevel ? "visible" : "none";
      map.setLayoutProperty(`Capacity-${groupName}`, "visibility", visibility);
      map.setLayerZoomRange(
        `Capacity-${groupName}`,
        autoZoom ? minZoom : 0,
        autoZoom ? maxZoom : 24
      );
    } else {
      map.addLayer({
        id: `Capacity-${groupName}`,
        type: "circle",
        source: groupName,
        minzoom: autoZoom ? minZoom : 0,
        maxzoom: autoZoom ? maxZoom : 24,
        layout: {
          // visibility: currentAggregationLevel === AGGREGATION_LEVELS.SITE ? "visible" : "none"
          visibility: visibility
        },
        paint: {
          "circle-radius": [
            "*",
            ["to-number", ["get", "capacity"]],
            getRingMultiplier(groupAggregationLevel)
          ],
          "circle-stroke-color": [
            "case",
            ["boolean", ["get", "selected"], false],
            theme.extend.colors["ocf-orange"].DEFAULT || "#FFAC5F",
            theme.extend.colors.solar.DEFAULT || "#f9d71c"
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
    //   const popupContent = `<div class="flex flex-col min-w-[16rem] bg-surface-raised text-content">
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
        ["to-number", ["get", "expectedPVRadius"]],
        getRingMultiplier(groupAggregationLevel)
      ]);
      // const visibility = currentAggregationLevel === groupAggregationLevel ? "visible" : "none";
      map.setLayoutProperty(`Generation-${groupName}`, "visibility", visibility);
      map.setLayerZoomRange(
        `Generation-${groupName}`,
        autoZoom ? minZoom : 0,
        autoZoom ? maxZoom : 24
      );
    } else {
      map.addLayer({
        id: `Generation-${groupName}`,
        type: "circle",
        source: groupName,
        minzoom: autoZoom ? minZoom : 0,
        maxzoom: autoZoom ? maxZoom : 24,
        layout: {
          // visibility: currentAggregationLevel !== AGGREGATION_LEVELS.SITE ? "none" : "visible"
          visibility: visibility
        },
        paint: {
          "circle-radius": [
            "*",
            ["to-number", ["get", "expectedPVRadius"]],
            getRingMultiplier(groupAggregationLevel)
          ],
          "circle-color": [
            "case",
            ["boolean", ["get", "selected"], false],
            theme.extend.colors["ocf-orange"].DEFAULT || "#FFAC5F",
            theme.extend.colors.solar.DEFAULT || "#f9d71c"
          ],
          "circle-opacity": 0.8
        }
      });
    }
    console.log("end addOrUpdateMapGroup", groupName);
  };

  const addFCData = (map: mapboxgl.Map) => {
    console.log("start addFCData");
    // Create a popup, but don't add it to the map yet.
    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      anchor: "bottom-right",
      maxWidth: "none"
    });

    // Sites
    addOrUpdateMapGroup(
      map,
      aggregatedSitesData.sites,
      "sites",
      AGGREGATION_LEVELS.SITE,
      AGGREGATION_LEVEL_MIN_ZOOM.SITE,
      AGGREGATION_LEVEL_MAX_ZOOM.SITE,
      autoZoom
    );

    // GSPs
    addOrUpdateMapGroup(
      map,
      aggregatedSitesData.gsps,
      "gsps",
      AGGREGATION_LEVELS.GSP,
      AGGREGATION_LEVEL_MIN_ZOOM.GSP,
      AGGREGATION_LEVEL_MAX_ZOOM.GSP,
      autoZoom
    );

    // Regions
    addOrUpdateMapGroup(
      map,
      aggregatedSitesData.regions,
      "regions",
      AGGREGATION_LEVELS.REGION,
      AGGREGATION_LEVEL_MIN_ZOOM.REGION,
      AGGREGATION_LEVEL_MAX_ZOOM.REGION,
      autoZoom
    );

    // National
    addOrUpdateMapGroup(
      map,
      aggregatedSitesData.national,
      "national",
      AGGREGATION_LEVELS.NATIONAL,
      AGGREGATION_LEVEL_MIN_ZOOM.NATIONAL,
      AGGREGATION_LEVEL_MAX_ZOOM.NATIONAL,
      autoZoom
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
      {/* `sitesErrors` is an object keyed by fetch, not an array — `?.length` was always
          `undefined`, so this failure state could never render. Count the truthy entries, the
          same way `useSitesViewData` does internally for its loading state. */}
      {Object.values(sitesErrors ?? {}).some(Boolean) ? (
        <FailedStateMap error="Failed to load" />
      ) : forecastLoading ? (
        <LoadStateMap>
          <ButtonGroup
            rightString={formatISODateStringHuman(selectedISOTime || "", timezone, locale)}
          />
        </LoadStateMap>
      ) : (
        <MapComponent
          loadDataOverlay={(map: { current: mapboxgl.Map }) =>
            safelyUpdateMapData(map.current, addFCData)
          }
          updateData={{
            newData: newDataForMap,
            updateMapData: (map) => safelyUpdateMapData(map, updateMapData)
          }}
          controlOverlay={(map: { current?: mapboxgl.Map }) => (
            <>
              <ButtonGroup
                rightString={formatISODateStringHuman(selectedISOTime || "", timezone, locale)}
              />
              <Slider aggregation={currentAggregationLevel} setAggregation={setAggregationLevel} />
              {/* <ShowSiteCount /> */}
            </>
          )}
          title={MAP_TITLE_SOLAR_SITES}
        >
          {/*<SitesLegend color={"color"} />*/}
        </MapComponent>
      )}
    </div>
  );
};

export default SitesMap;
