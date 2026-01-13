import Layout from "../components/layout/layout";
import { Map } from "../components/map";
// import gspShapeData from "../data/GSP_regions_4326_20250109.json";
// import gspShapeData from "../data/ukpnFilteredGspShapeData.json";
import ukpnShapeData from "../data/ukpn_primary_postcode_area.json";
import ukpnData from "../data/ukpn-primary-transformers.json";
import primaryCapacities from "../data/primary_capacities.json";

import SideLayout from "../components/side-layout";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OCFlogo } from "../components/icons/logo";
import ProfileDropDown from "../components/layout/header/profile-dropdown";
import { useUser } from "@auth0/nextjs-auth0/client";
import mapboxgl from "mapbox-gl";
import { Feature, FeatureCollection } from "geojson";
import { useLoadDataFromApi } from "../components/hooks/useLoadDataFromApi";
import { GspEntities, GspEntity } from "../components/types";
import dnoGspGroupings from "../data/dno_gsp_groupings.json";
import { DateTime } from "luxon";

const UKPNRegionGspIds = Object.entries(dnoGspGroupings)
  .filter(([group]) => group.includes("UKPN"))
  .flatMap(([_, group]) => group);

const gspShapeData = require("../data/ukpnFilteredGspShapeData.json");

const UKPNGspNames = [
  "ACTL_C|WISD_1|WISD_6",
  "AMEM_1",
  "BARKC1|BARKW3",
  "BEDDT1",
  "BEDD_1",
  "BOLN_1",
  "BRAI_1",
  "BRFO_1|CLT03",
  "BRIM_1",
  "BURM_1",
  "CANTN1|RICH_J|RICH1",
  "CHSI_1",
  "CITR_1",
  "EASO_1",
  "ELST_1",
  "HACK_1|HACK_6",
  "HURS_1",
  "ISLI_1|WHAM_1",
  "KEMS_1",
  "KINO_1",
  "LITT_C",
  "LITT_J",
  "LODR_6",
  "MILH_1",
  "NEWX_6",
  "NFLE",
  "NINF_1",
  "NORM_1|SALL1",
  "PELH_1",
  "RAYL_1",
  "REBR_3",
  "RYEH_1",
  "SELL_1",
  "SJOW_1",
  "SUND_1",
  "TILBB_1",
  "TOTT_1",
  "WALP_1",
  "WARL_1",
  "WATFS_1",
  "WIMBN1|WIMBS1",
  "WTHU31",
  "WWEY_1",
  "WYMOM_1"
];

type Substation = {
  capacity_kw: number;
  latitude: number;
  longitude: number;
  substation_name: string;
  substation_type: string;
  substation_uuid: number;
};

type ForecastForTimestamp = {
  datetime_utc: string;
  forecast_values_kw: Record<string, number>;
};

export default function Ukpn() {
  const { user, isLoading, error } = useUser();
  const isLoggedIn = !isLoading && !!user;
  // const isLoggedIn = true;
  const [shouldUpdate, setShouldUpdate] = useState(false);
  const [shouldUpdateMap, setShouldUpdateMap] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<string>(
    DateTime.now()
      .minus({ day: 1 })
      .set({ hour: 12, minute: 0, second: 0, millisecond: 0 })
      .toUTC()
      .toISO({ suppressMilliseconds: true })
  );

  // Load data
  const {
    data: listSubstationsData,
    isLoading: listSubstationsLoading,
    isValidating: listSubstationsValidating,
    error: listSubstationsError
  } = useLoadDataFromApi<Substation[]>(
    `http://uk-development-quartz-api.eu-west-1.elasticbeanstalk.com/substations`,
    {}
  );
  const {
    data: substationsForecastData,
    isLoading: substationsForecastLoading,
    isValidating: substationsForecastValidating,
    error: substationsForecastError
  } = useLoadDataFromApi<ForecastForTimestamp>(
    `http://uk-development-quartz-api.eu-west-1.elasticbeanstalk.com/substations/forecast/?datetime_utc=${selectedTime}`,
    {
      onSuccess: (data) => {
        setShouldUpdateMap(true);
      }
    }
  );
  // Get system data for UKPN's GSPs
  const {
    data: gspSystemData,
    isLoading: gspSystemLoading,
    isValidating: gspSystemValidating,
    error: gspSystemError
  } = useLoadDataFromApi<GspEntities>(
    // Currently can only get all GSP systems data, or one
    `${process.env.NEXT_PUBLIC_API_PREFIX}/system/GB/gsp`,
    {
      onSuccess: (data) => {
        setShouldUpdateMap(true);
      }
    }
  );

  // // Get only the forecast for UKPN's GSPs
  // const {
  //   data: gspForecastsData,
  //   isLoading: gspForecastsLoading,
  //   isValidating: gspForecastsValidating,
  //   error: gspForecastsError
  // } = useLoadDataFromApi<components["schemas"]["OneDatetimeManyForecastValues"][]>(
  //   `${
  //     process.env.NEXT_PUBLIC_API_PREFIX
  //   }/solar/GB/gsp/forecast/all/?historic=true&compact=true&gsp_ids=${UKPNRegionGspIds.join(
  //     ","
  //   )}&start_datetime_utc=${selectedTime}`
  // );
  // const {
  //   data: forecastData,
  //   isLoading: forecastLoading,
  //   isValidating: forecastValidating,
  //   error: forecastError
  // } = useLoadDataFromApi<ForecastData>(
  //   `http://uk-development-quartz-api.eu-west-1.elasticbeanstalk.com/forecast`,
  //   {}
  // );

  console.log("listSubstationsData", listSubstationsData);
  console.log("gspSystemData", gspSystemData);
  console.log("forecastData", substationsForecastData);

  // Map data closure refs
  const substationsForecastRef = useRef<ForecastForTimestamp | null>(null);
  const listSubstationsRef = useRef<Substation[] | null>(null);
  const gspSystemRef = useRef<GspEntities | null>(null);

  useEffect(() => {
    substationsForecastRef.current = substationsForecastData ?? null;
  }, [substationsForecastData]);

  useEffect(() => {
    listSubstationsRef.current = listSubstationsData ?? null;
  }, [listSubstationsData]);

  useEffect(() => {
    gspSystemRef.current = gspSystemData ?? null;
  }, [gspSystemData]);

  const toggleSelectedRegion = (id: string) => {
    console.log("id", id);
    console.log("currentSelection", selectedRegions);
    if (selectedRegions.includes(id)) {
      setSelectedRegions(selectedRegions.filter((region) => region !== id));
    } else {
      setSelectedRegions([...selectedRegions, id]);
    }
  };
  const popup = useMemo(() => {
    return new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      anchor: "bottom-right",
      maxWidth: "none"
    });
  }, []);

  const returnFeatureAndLog = (
    label: string,
    message: string,
    primariesWithoutMeta: Record<string, string[]>,
    feature: Feature
  ) => {
    primariesWithoutMeta[message] = primariesWithoutMeta[message] || [];
    primariesWithoutMeta[message].push(label);
    return {
      ...feature,
      properties: { ...feature.properties, displayName: `${label} [${message}]` }
    };
  };

  const loadData = useCallback(
    (map: mapboxgl.Map) => {
      console.log("loading data");
      // Primary Substation features/data
      // let features = { type: "FeatureCollection", features: [] } as FeatureCollection;
      let primariesFeatures: Feature[];
      const primariesShapeJson = ukpnShapeData as FeatureCollection;
      // const primariesMeta = ukpnData as FeatureCollection;
      console.log("primariesShapeJson", primariesShapeJson.features);

      const substationsForecastData = substationsForecastRef.current;
      const listSubstationsData = listSubstationsRef.current;
      const gspSystemData = gspSystemRef.current;
      console.log("substationsForecast", substationsForecastData);

      const primariesWithoutMeta: Record<string, string[]> = {};

      primariesFeatures = primariesShapeJson.features.map((feature) => {
        // console.log("feature", feature);
        const id = feature.properties?.primary;
        const gspName = feature.properties?.grid_supply_point;
        if (!id) {
          return returnFeatureAndLog(id, "no id", primariesWithoutMeta, feature);
        } else if (!gspName) {
          return returnFeatureAndLog(id, "no id or gspName", primariesWithoutMeta, feature);
        }

        // remove any words with numeric characters from the primary name
        let primaryStrippedName = feature.properties?.primary
          ?.split(" ")
          .filter((s: string) => !/\d/.test(s))
          .join("_")
          .toLowerCase();
        let primarySanitizedName = primaryStrippedName
          .replace("_primary", "")
          .replace("_", " ")
          .replace("&", "and")
          .replace("lane", "ln")
          .replace("road", "rd")
          .replace(/\|/, " and ");
        // Capitalise the first letter of each word
        primarySanitizedName = primarySanitizedName?.replace(/\b\w/g, (l: string) =>
          l.toUpperCase()
        );
        const snakeCaseName = primarySanitizedName.replace(/\s+/g, "_").toLowerCase();

        const primaryMeta = listSubstationsData?.find((f) =>
          f.substation_name?.toLowerCase().includes(snakeCaseName)
        );
        if (!primaryMeta) {
          return returnFeatureAndLog(
            primarySanitizedName,
            "primary name not in substations list",
            primariesWithoutMeta,
            feature
          );
        }

        const primaryUuid = primaryMeta?.substation_uuid;
        if (!primaryUuid) {
          return returnFeatureAndLog(
            primarySanitizedName,
            "no primaryUuid",
            primariesWithoutMeta,
            feature
          );
        }

        const primaryForecast = substationsForecastData?.forecast_values_kw[primaryUuid];
        if (!primaryForecast) {
          return returnFeatureAndLog(
            primarySanitizedName,
            "primary UUID not in subs forecast data",
            primariesWithoutMeta,
            feature
          );
        }

        let gspMeta = gspSystemData?.find((f) =>
          f.regionName?.toLowerCase().includes(gspName.toLowerCase())
        );
        if (!gspMeta) {
          // Check primaryCapacities for matching GSP name
          const primaryCapacity = primaryCapacities?.find((f) =>
            f.location?.toLowerCase().includes(primaryStrippedName)
          );
          if (primaryCapacity) {
            gspMeta = gspSystemData?.find((f) => f.gspId === primaryCapacity.gsp_numeric_id);
            feature.properties = { ...feature.properties, primaryCapacityFromJson: true };
          }
        }
        // console.log("gspMeta", gspMeta);
        // console.log("feature.properties", feature.properties);
        // console.log("primaryMeta", primaryMeta);
        // console.log("snakeCaseName", snakeCaseName);
        const gspCode = gspMeta?.gspName;
        if (!gspMeta) {
          return returnFeatureAndLog(
            primarySanitizedName,
            "no gspMeta",
            primariesWithoutMeta,
            feature
          );
        }

        feature = {
          ...feature,
          properties: {
            ...feature.properties,
            GSPs: gspCode
          }
        };

        if (!primaryMeta)
          return returnFeatureAndLog(id, "no primaryMeta", primariesWithoutMeta, feature);
        // if (!gspForecastsData) return feature;

        // Get forecast for selected time and correct GSP
        // const forecastForTime = getGspForecastForTime(gspForecastsData, selectedTime);
        // const forecastForGsp = forecastForTime?.forecastValues[gspMeta.gspId] || 0;
        // const forecastForGspYield = forecastForGsp / gspMeta.installedCapacityMw;

        // // remove any words with numeric characters from the primary name
        // let strippedName = feature.properties?.primary
        //   ?.split(" ")
        //   .filter((s: string) => !/\d/.test(s))
        //   .join(" ")
        //   .toLowerCase();
        // Capitalise the first letter of each word
        // strippedName = strippedName?.replace(/\b\w/g, (l: string) => l.toUpperCase());
        // const snakeCaseName = strippedName.replace(/\s+/g, "_").toLowerCase();
        // const primaryCapacitiesMw =
        //   primaryCapacities.find((p) => p.location === snakeCaseName)?.mean_embedded_capacity_mw || 0;
        // const installedCapacityKw = primaryCapacitiesMw || 0;

        // const gspFeature = {
        //   ...feature,
        //   properties: {
        //     ...feature.properties,
        //     expectedPowerGenerationMegawatts: primaryEstimatedGeneration
        //   }
        // };

        // const gspFeature = mapGspFeature(
        //   feature,
        //   combinedData,
        //   gspForecastsDataByTimestamp,
        //   targetTime,
        //   gspDeltas
        // );
        // const gspFeature = mapFeature(feature, gspMeta, gspForecastsData || [], selectedTime);
        // if (!gspFeature) return feature;

        const primaryCapacityKw = primaryMeta.capacity_kw;

        return {
          ...feature,
          id: id,
          properties: {
            ...feature.properties,
            installedCapacityKw: primaryCapacityKw,
            gspId: gspMeta.gspId,
            displayName: primarySanitizedName,
            expectedPowerGenerationMegawatts: primaryForecast,
            expectedPowerGenerationNormalized: primaryForecast / primaryCapacityKw
          }
        };
      });

      console.log("primariesWithoutMeta", primariesWithoutMeta);

      const gspsWithMissingData: number[] = [];
      primariesFeatures.forEach((f) => {
        if (f.properties?.expectedPowerGenerationMegawatts === undefined) {
          if (gspsWithMissingData.indexOf(f.properties?.grid_supply_point) === -1) {
            gspsWithMissingData.push(f.properties?.grid_supply_point);
          }
        }
      });
      console.log("gspsWithMissingData", gspsWithMissingData);

      const primariesSource = map.getSource("primaries-data") as unknown as mapboxgl.GeoJSONSource;
      if (!primariesSource) {
        map.addSource("primaries-data", {
          type: "geojson",
          data: { ...primariesShapeJson, features: primariesFeatures } as GeoJSON.FeatureCollection
        });
      } else {
        primariesSource.setData({
          ...primariesShapeJson,
          features: primariesFeatures
        } as GeoJSON.FeatureCollection);
      }
      const primariesBoundariesLayer = map.getLayer("primaries-boundaries");
      if (!primariesBoundariesLayer) {
        map.addLayer({
          id: "primaries-boundaries",
          type: "line",
          source: "primaries-data",
          paint: {
            "line-color": "#ffcc2d",
            "line-opacity": 0.4
          }
        });
      }
      const primariesFillLayer = map.getLayer("primaries-data-fill");
      if (!primariesFillLayer) {
        map.addLayer({
          id: "primaries-data-fill",
          type: "fill",
          source: "primaries-data",
          paint: {
            "fill-color": "#ffcc2d",
            // "fill-opacity": ["case", ["boolean", ["feature-state", "clicked"], false], 0.5, 0.2]
            "fill-opacity": [
              "interpolate",
              ["linear"],
              ["to-number", ["get", "expectedPowerGenerationMegawatts"]],
              // on value 0 the opacity will be 0
              0,
              0,
              // on value maximum the opacity will be 1
              700,
              1
            ]
          }
        });
      }
      const primariesMissingDataLayer = map.getLayer("primaries-missing-data");
      if (!primariesMissingDataLayer) {
        map.addLayer({
          id: "primaries-missing-data",
          type: "fill",
          source: "primaries-data",
          paint: {
            "fill-color": [
              "if",
              ["get", ["primaryCapacityFromJson", true], false],
              "#b10400",
              "#00c"
            ],
            "fill-opacity": 0.5
          },
          // filter to show only if doesn't have expectedPowerGenerationMegawatts property
          filter: ["==", ["get", "expectedPowerGenerationMegawatts"], null]
        });
      }

      // GSP features/data
      const gspSource = map.getSource("gsp-data");
      if (!gspSource) {
        map.addSource("gsp-data", {
          type: "geojson",
          data: gspShapeData as GeoJSON.FeatureCollection
        });
      }
      const gspLayer = map.getLayer("gsp-data");
      if (gspLayer) {
        map.removeLayer("gsp-data");
      }
      const gspFillLayer = map.getLayer("gsp-data-fill");
      if (gspFillLayer) {
        map.removeLayer("gsp-data-fill");
      }
      const selectedGspLayer = map.getLayer("gsp-data-selected");
      if (selectedGspLayer) {
        map.removeLayer("gsp-data-selected");
      }
      // if (!layer) {
      map.addLayer({
        id: "gsp-data",
        type: "line",
        source: "gsp-data",
        paint: {
          "line-color": "#ff8c2d",
          "line-opacity": 0.6,
          "line-width": 2
        }
      });
      // map.addLayer({
      //   id: "gsp-data-fill",
      //   type: "fill",
      //   source: "gsp-data",
      //   paint: {
      //     "fill-color": "#ffcc2d",
      //     "fill-opacity": ["case", ["boolean", ["feature-state", "clicked"], false], 0.5, 0.2]
      //   }
      // });
      map.addLayer({
        id: "gsp-data-selected",
        type: "line",
        source: "gsp-data",
        paint: {
          "line-color": "#ddd",
          "line-width": 3,
          "line-opacity": ["case", ["boolean", ["feature-state", "clicked"], false], 1, 0]
        }
      });
      map.on("click", "primaries-data-fill", (e): void => {
        console.log("clicked", e.features?.[0].properties, e.features?.[0].state);
        toggleSelectedRegion(e.features?.[0].properties?.["GSPs"]);

        map.setFeatureState(
          { source: "primaries-data-fill", id: e.features?.[0].id || "" },
          { clicked: !e.features?.[0].state?.clicked }
        );
      });
      map.on("mousemove", "primaries-data-fill", (e) => {
        const features = e.features;
        if (features && features.length > 0) {
          const feat = features[0];
          const popupContent = `<div class="flex flex-col min-w-[16rem] text-white">
          <div class="flex justify-between gap-3 items-center mb-1">
            <div class="text-sm font-semibold">${feat.properties?.displayName}</div>
            <div class="text-xs text-mapbox-black-300">${feat.properties?.gspId} • ${
            feat.properties?.GSPs || ""
          }</div>
          </div>
          <div class="flex justify-between items-center">
            <div class="flex flex-col text-xs">
              <span class="text-2xs uppercase tracking-wide text-mapbox-black-300">Capacity</span>
              <div><span>${
                feat.properties?.installedCapacityKw
              }</span> <span class="text-2xs text-mapbox-black-300">KW</span></div>
            </div>
            <div class="flex flex-col text-xs">
              <span class="text-2xs uppercase tracking-wide text-mapbox-black-300">GSP Yield</span>
              <div><span>${
                feat.properties?.gspPredictedYield?.toFixed(2) || "– "
              }</span> <span class="text-2xs text-mapbox-black-300">%</span></div>
            </div>
            <div class="flex flex-col text-xs items-end">
              <span class="text-2xs uppercase tracking-wide text-mapbox-black-300">Predicted</span>
            ${feat.properties?.["expectedPowerGenerationMegawatts"]?.toFixed(2) || "– "} KW
            </div>
          </div>
        </div>`;
          popup.trackPointer().setHTML(popupContent).addTo(map);
        }
      });
      map.on("mouseleave", "primaries-data-fill", () => {
        popup.remove();
      });

      setShouldUpdateMap(false);
    },
    [selectedRegions]
  );

  useEffect(() => {
    console.log("useEffect shouldUpdate", shouldUpdate);
  }, [shouldUpdate]);

  useEffect(() => {
    console.log("### selectedRegions", selectedRegions);
  }, [selectedRegions]);

  useEffect(() => {
    if (!showMap) {
      setShowMap(true);
    }
  }, [showMap]);

  console.log("UKPNRegionGspIds", UKPNRegionGspIds);

  const UKPNGspNames = gspSystemData
    ?.filter((gsp) => UKPNRegionGspIds.includes(gsp.gspId))
    .map((gsp) => gsp.gspName);
  console.log("UKPN GSP Names", UKPNGspNames);

  if (!showMap) {
    return <div>Reset</div>;
  }

  return (
    <Layout>
      <div className={`h-full relative pt-16`}>
        <header className="h-16 text-white text-right sm:px-4 bg-black flex absolute top-0 w-full overflow-y-visible p-1 text-sm items-center z-30">
          <div className="flex-grow-0 -mt-0.5 flex-shrink-0">
            <a
              className="flex h-8 self-center w-auto"
              target="_blank"
              href="https://quartz.solar/"
              rel="noreferrer"
            >
              <img src="/QUARTZSOLAR_LOGO_ICON.svg" alt="quartz_logo" className="h-8 w-auto" />
            </a>
          </div>
          <div className="p-1 mt-0.5 mb-1.5 items-end flex flex-col">
            <a
              className="flex h-6 w-auto"
              target="_blank"
              href="https://quartz.solar/"
              rel="noreferrer"
            >
              <img
                src="/QUARTZSOLAR_LOGO_TEXTONLY_WHITE.svg"
                alt="quartz_logo"
                className="h-8 w-auto"
              />
            </a>
            <div className="mr-[6px] flex items-center">
              <span className="block mr-[1px] font-light tracking-wide text-[10px]">
                powered by
              </span>
              <OCFlogo />
            </div>
          </div>
          <div className="grow text-center inline-flex px-2 sm:px-8 gap-2 sm:gap-5 items-center">
            {/*{isLoggedIn && (*/}
            {/*  <Menu>*/}
            {/*    <HeaderLink*/}
            {/*      url="/"*/}
            {/*      view={VIEWS.FORECAST}*/}
            {/*      currentView={view}*/}
            {/*      setViewFunc={setView}*/}
            {/*      text={getViewTitle(VIEWS.FORECAST)}*/}
            {/*    />*/}
            {/*    <HeaderLink*/}
            {/*      url="/"*/}
            {/*      view={VIEWS.SOLAR_SITES}*/}
            {/*      currentView={view}*/}
            {/*      setViewFunc={setView}*/}
            {/*      text={getViewTitle(VIEWS.SOLAR_SITES)}*/}
            {/*      disabled={isProduction}*/}
            {/*    />*/}
            {/*    <HeaderLink*/}
            {/*      url="/"*/}
            {/*      view={VIEWS.DELTA}*/}
            {/*      currentView={view}*/}
            {/*      setViewFunc={setView}*/}
            {/*      text={getViewTitle(VIEWS.DELTA)}*/}
            {/*    />*/}
            {/*  </Menu>*/}
            {/*)}*/}
          </div>
          <div className="py-1">{isLoggedIn && <ProfileDropDown />}</div>
        </header>
        <div
          id="map-container"
          className={`pv-map relative float-right h-full`}
          style={{ width: "50%" }}
        >
          <Map
            loadDataOverlay={(map: { current: mapboxgl.Map }) => loadData(map.current)}
            controlOverlay={() => (
              <>
                <button className="btn mr-3" onClick={() => setShouldUpdateMap(true)}>
                  Update Map
                </button>
                <button className="btn" onClick={() => setShowMap(false)}>
                  Reset Map
                </button>
              </>
            )}
            updateData={{
              newData: shouldUpdateMap,
              updateMapData: (map: mapboxgl.Map) => {
                console.log("updatingData");
                console.log(
                  "updateMapData",
                  map.getZoom(),
                  map.getCenter(),
                  map.getCenter().toArray(),
                  map.getCenter().wrap(),
                  map.getCenter().wrap().toArray()
                );
                loadData(map);
              }
            }}
            title={"Test"}
          />
        </div>

        <SideLayout bottomPadding={false}>
          {/*<PvRemixChart*/}
          {/*  combinedData={combinedData}*/}
          {/*  combinedErrors={combinedErrors}*/}
          {/*  className={currentView(VIEWS.FORECAST) ? "" : "hidden"}*/}
          {/*/>*/}
          <span></span>
        </SideLayout>
      </div>
    </Layout>
  );
}
