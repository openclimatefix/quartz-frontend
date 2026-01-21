import Layout from "../components/layout/layout";
import { LoadStateMap, Map } from "../components/map";
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
import { safelyUpdateMapData } from "../components/helpers/mapUtils";
import { CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from "recharts";
import { theme } from "../tailwind.config";
import { prettyPrintDayLabelWithDate } from "../components/helpers/utils";
import { debounce } from "next/dist/server/utils";
import Spinner from "../components/icons/spinner";

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

const yellow = theme.extend.colors["ocf-yellow"].DEFAULT;
const navyBlue = theme.extend.colors["ocf-blue"]["900"];

type Substation = {
  capacity_kW: number;
  latitude: number;
  longitude: number;
  substation_name: string;
  substation_type: string;
  substation_uuid: string;
};

type ForecastForPrimary = {
  power_kW: number;
  time: string;
}[];

type ForecastForTimestamp = {
  datetime_utc: string;
  forecast_values_kW: Record<string, number>;
};

const getDefaultForecastTimes = () => {
  const now = DateTime.now();
  let start = now.startOf("day").minus({ days: 2 });
  const end = now.endOf("day").plus({ days: 1, minutes: 30 });
  const times = [];
  while (start <= end) {
    times.push(start.toMillis());
    start = start.plus({ minutes: 30 });
  }
  return times;
};

export default function Ukpn() {
  const { user, isLoading, error } = useUser();
  const isLoggedIn = !isLoading && !!user;
  // const isLoggedIn = true;
  const [shouldUpdate, setShouldUpdate] = useState(false);
  const [shouldUpdateMap, setShouldUpdateMap] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [mapInitialLoadComplete, setMapInitialLoadComplete] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string>(
    DateTime.now()
      .minus({ day: 1 })
      .set({ hour: 12, minute: 0, second: 0, millisecond: 0 })
      .toUTC()
      .toISO({ suppressMilliseconds: true })
  );

  const forecastTimes = getDefaultForecastTimes();
  console.log("forecastTimes", forecastTimes);
  const forecastPosition =
    (forecastTimes.indexOf(DateTime.fromISO(selectedTime).toMillis()) / forecastTimes.length) * 100;
  console.log("forecastPosition", forecastPosition);

  // Load data
  const {
    data: listSubstationsData,
    isLoading: listSubstationsLoading,
    isValidating: listSubstationsValidating,
    error: listSubstationsError
  } = useLoadDataFromApi<Substation[]>(`https://ukpn.quartz.solar/substations`, {});
  const {
    data: substationsForecastData,
    isLoading: substationsForecastLoading,
    isValidating: substationsForecastValidating,
    error: substationsForecastError
  } = useLoadDataFromApi<ForecastForTimestamp>(
    `https://ukpn.quartz.solar/substations/forecast?datetime_utc=${selectedTime}`,
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
    `${process.env.NEXT_PUBLIC_API_PREFIX}/system/GB/gsp/`,
    {
      onSuccess: (data) => {
        setShouldUpdateMap(true);
      }
    }
  );
  const getPrimaryUuidByName = (name: string) => {
    return listSubstationsData?.find((primary) => primary.substation_name === name)
      ?.substation_uuid;
  };
  const getPrimaryNameByUuid = (uuid: string) => {
    return listSubstationsData
      ?.find((primary) => primary.substation_uuid === uuid)
      ?.substation_name?.replace("_", " ")
      .replace(/\b\w/g, (l: string) => l.toUpperCase());
  };
  const {
    data: selectedPrimaryForecastData,
    isLoading: selectedPrimaryForecastLoading,
    isValidating: selectedPrimaryForecastValidating,
    error: selectedPrimaryForecastError
  } = useLoadDataFromApi<ForecastForPrimary>(
    selectedRegions.length
      ? `https://ukpn.quartz.solar/substations/${selectedRegions[0]}/forecast`
      : null,
    {
      keepPreviousData: false
    }
  );

  console.log("selectedPrimaryForecastData", selectedPrimaryForecastData);

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
  const mapInitialLoadCompleteRef = useRef<Boolean>(false);
  const selectedRegionsRef = useRef<string[]>([]);

  useEffect(() => {
    substationsForecastRef.current = substationsForecastData ?? null;
  }, [substationsForecastData]);

  useEffect(() => {
    listSubstationsRef.current = listSubstationsData ?? null;
  }, [listSubstationsData]);

  useEffect(() => {
    gspSystemRef.current = gspSystemData ?? null;
  }, [gspSystemData]);

  useEffect(() => {
    mapInitialLoadCompleteRef.current = mapInitialLoadComplete;
  }, [mapInitialLoadComplete]);

  useEffect(() => {
    selectedRegionsRef.current = selectedRegions;
  }, [selectedRegions]);

  const toggleSelectedRegion = (id: string) => {
    console.log("id", id);
    console.log("currentSelection", selectedRegionsRef.current);
    if (selectedRegionsRef.current.includes(id)) {
      setSelectedRegions(selectedRegionsRef.current.filter((region) => region !== id));
    } else {
      setSelectedRegions([...selectedRegionsRef.current, id]);
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

      const substationsForecastData = substationsForecastRef.current;
      const listSubstationsData = listSubstationsRef.current;
      const gspSystemData = gspSystemRef.current;
      const initialMapLoadComplete = mapInitialLoadCompleteRef.current;

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
        const snakeCaseName = primarySanitizedName.replace(/\s+/g, "_").toLowerCase();
        primarySanitizedName = primarySanitizedName?.replace(/\b\w/g, (l: string) =>
          l.toUpperCase()
        );
        feature = {
          ...feature,
          properties: {
            ...feature.properties,
            snakeCaseName
          }
        };

        const primaryMeta = listSubstationsData?.find(
          (f) => f.substation_name?.toLowerCase() === snakeCaseName
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
        feature = { ...feature, properties: { ...feature.properties, primaryUuid } };

        const primaryForecast = substationsForecastData?.forecast_values_kW[primaryUuid];
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

        const primaryCapacityKw = primaryMeta.capacity_kW;

        return {
          ...feature,
          id: primaryUuid,
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
          promoteId: "primaryUuid",
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
              600,
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
            "fill-color": navyBlue,
            // "if",
            // ["get", ["primaryCapacityFromJson", true], false],
            // "#b10400"
            // "#00c"
            // ],
            "fill-opacity": 0.5
          },
          // filter to show only if doesn't have expectedPowerGenerationMegawatts property
          filter: ["==", ["get", "expectedPowerGenerationMegawatts"], null]
        });
      }
      const selectedPrimariesLayer = map.getLayer("primaries-data-selected");
      if (!selectedPrimariesLayer) {
        map.addLayer({
          id: "primaries-data-selected",
          type: "line",
          source: "primaries-data",
          paint: {
            "line-color": "#ddd",
            "line-width": 3
            // "line-opacity": ["case", ["boolean", ["feature-state", "clicked"], false], 1, 0]
          },
          filter: ["==", ["id"], "not-set"]
        });
      } else {
        map.setFilter("primaries-data-selected", [
          "==",
          ["id"],
          selectedRegionsRef.current[0] ?? "not-set"
        ]);
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
      // map.addLayer({
      //   id: "gsp-data",
      //   type: "line",
      //   source: "gsp-data",
      //   paint: {
      //     "line-color": "#ff8c2d",
      //     "line-opacity": 0.6,
      //     "line-width": 2
      //   }
      // });
      // map.addLayer({
      //   id: "gsp-data-fill",
      //   type: "fill",
      //   source: "gsp-data",
      //   paint: {
      //     "fill-color": "#ffcc2d",
      //     "fill-opacity": ["case", ["boolean", ["feature-state", "clicked"], false], 0.5, 0.2]
      //   }
      // });
      if (!initialMapLoadComplete) {
        map.on("click", "primaries-data-fill", (e): void => {
          console.log("clicked", e.features?.[0].properties, e.features?.[0]);
          const id = String(e.features?.[0]?.properties?.primaryUuid);
          if (!id) return;

          if (id === selectedRegionsRef.current[0]) {
            setSelectedRegions([]);
            if (map.getLayer("primaries-data-selected")) {
              map.setFilter("primaries-data-selected", ["in", ["get", "primaryUuid"], "not-set"]);
            }
          } else {
            setSelectedRegions([id]);
            if (map.getLayer("primaries-data-selected")) {
              map.setFilter("primaries-data-selected", ["in", ["get", "primaryUuid"], id]);
            }
          }
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
              <span class="text-2xs uppercase tracking-wide text-mapbox-black-300">Forecast</span>
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
      }

      setShouldUpdateMap(false);
      setMapInitialLoadComplete(true);
    },
    [selectedRegions]
  );

  useEffect(() => {
    console.log("useEffect shouldUpdate", shouldUpdate);
  }, [shouldUpdate]);

  useEffect(() => {
    console.log("### selectedRegions", selectedRegions);
    // Selection should NOT trigger a full data refresh; we update the selected layer filter directly on click.
  }, [selectedRegions]);

  useEffect(() => {
    if (!showMap) {
      setMapInitialLoadComplete(false);
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

  const formattedData =
    selectedPrimaryForecastData?.map((d) => ({
      power: d.power_kW,
      time: new Date(d.time).getTime()
    })) ?? [];

  console.log("formattedData", formattedData);

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
          <div className="grow text-center inline-flex px-2 sm:px-8 gap-2 sm:gap-5 items-center"></div>
          <div className="py-1">{isLoggedIn && <ProfileDropDown />}</div>
        </header>
        <div
          id="map-container"
          className={`pv-map relative float-right h-full w-full`}
          style={{ width: "100%" }}
        >
          {(listSubstationsLoading ||
            listSubstationsValidating ||
            substationsForecastLoading ||
            substationsForecastValidating) && (
            <LoadStateMap>
              <Spinner />
            </LoadStateMap>
          )}
          <Map
            loadDataOverlay={(map: { current: mapboxgl.Map }) => loadData(map.current)}
            controlOverlay={() => (
              <>
                {/*<button className="btn float-right" onClick={() => setShouldUpdateMap(true)}>*/}
                {/*  Update Map*/}
                {/*</button>*/}
                {/*<button className="btn mr-3 float-right" onClick={() => setShowMap(false)}>*/}
                {/*  Reset Map*/}
                {/*</button>*/}
                <span className="float-right text-white bg-black px-3 py-1.5 rounded-md">
                  {DateTime.fromISO(selectedTime).toFormat("EEE, dd MMMM yyyy, HH:mm")}
                </span>
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
                safelyUpdateMapData(map, loadData);
              }
            }}
            title={"Test"}
          >
            <div className="flex flex-col absolute bottom-8 left-0 right-0 mx-3 pb-2 pt-0.5 rounded-md bg-black">
              <div className="absolute flex right-5 left-6">
                <span
                  className="text-sm absolute top-1 -translate-x-1/2 bg-ocf-yellow px-2 py-1 text-black border-2 border-black rounded-md z-10"
                  style={{ left: `${forecastPosition}%` }}
                >
                  {DateTime.fromISO(selectedTime).toFormat("HH:mm")}
                </span>
              </div>
              <div className="flex-1 flex justify-around mx-6 text-xs pt-1 text-white">
                {forecastTimes.map((h, index) => {
                  const datetime = DateTime.fromMillis(h);
                  if (datetime.get("minute") !== 0 || datetime.get("hour") !== 12) return null;
                  const isoDate = datetime.toISO();
                  if (!isoDate) return null;

                  return (
                    <div key={`${h}${index}`} className="w-0 flex">
                      <span className="transform -translate-x-1/2 whitespace-nowrap">
                        {prettyPrintDayLabelWithDate(isoDate)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex-1 flex justify-between mx-6 text-xs pt-0.5 pb-1 text-white">
                {forecastTimes.map((h, index) => {
                  const datetime = DateTime.fromMillis(h);
                  if (datetime.get("minute") !== 0 || datetime.get("hour") % 6 > 0) return null;

                  return (
                    <div key={`${h}${index}`} className="w-0 flex">
                      <span className="transform -translate-x-1/2">
                        {datetime.toFormat("HH:mm")}
                      </span>
                    </div>
                  );
                })}
              </div>
              <input
                type={"range"}
                className={
                  "flex-1 mx-4 appearance-none bg-mapbox-black-600 text-ocf-yellow rounded-md"
                }
                min={forecastTimes[0]}
                max={forecastTimes[forecastTimes.length - 1]}
                step={30 * 60 * 1000}
                defaultValue={DateTime.fromISO(selectedTime).toMillis()}
                // onChange={(e) => {
                //
                // }}
                onInput={debounce((e) => {
                  console.log(
                    "change forecastTimes",
                    DateTime.fromMillis(Number(e.target.value))
                      .toUTC()
                      .toISO({ suppressMilliseconds: true })
                  );
                  setSelectedTime(
                    DateTime.fromMillis(Number(e.target.value))
                      .toUTC()
                      .toISO({ suppressMilliseconds: true }) ?? selectedTime
                  );
                }, 500)}
              />
            </div>
          </Map>
        </div>

        {selectedRegions.length > 0 && (
          <SideLayout closedWidth={"40%"} bottomPadding={false}>
            <div className="relative flex flex-col rounded-md bg-mapbox-black-900 border border-mapbox-black-700 overflow-hidden">
              <div className="flex flex-initial w-full px-4 py-3 bg-mapbox-black-900 border-b border-mapbox-black-700">
                <h1 className="text-xl">{getPrimaryNameByUuid(selectedRegions[0])}</h1>
              </div>
              {(selectedPrimaryForecastLoading || selectedPrimaryForecastValidating) && (
                <LoadStateMap>
                  <Spinner />
                </LoadStateMap>
              )}
              <ComposedChart
                style={{
                  width: "100%",
                  // maxWidth: "700px",
                  maxHeight: "70vh",
                  aspectRatio: 1.618,
                  color: "white"
                }}
                className="select-none"
                data={formattedData}
                responsive
                margin={{
                  top: 20,
                  right: 32,
                  bottom: -12,
                  left: 5
                }}
              >
                <CartesianGrid verticalFill={["#242424", "#3C3C3C"]} fillOpacity={0.5} />
                <XAxis
                  dataKey="time"
                  scale="time"
                  type={"number"}
                  tick={{ fill: "white", style: { fontSize: "12px" } }}
                  tickLine={true}
                  domain={[(dataMin: number) => dataMin, (dataMax: number) => dataMax]}
                  tickFormatter={(t) => new Date(t).toISOString().slice(11, 16)}
                  interval={23}
                  // label={{ value: "Time", position: "insideBottom", offset: -5 }}
                />
                <XAxis
                  dataKey="time"
                  xAxisId={"x-axis-2"}
                  tickFormatter={prettyPrintDayLabelWithDate}
                  tick={{ fill: "white", style: { fontSize: "12px" } }}
                  interval={47}
                  tickLine={false}
                  orientation="bottom"
                  axisLine={false}
                  tickMargin={-12}
                />
                <YAxis
                  dataKey={"power"}
                  tick={{ fill: "white", style: { fontSize: "12px" } }}
                  tickLine={true}
                  // domain={[(dataMin: number) => dataMin, (dataMax: number) => dataMax]}
                  label={{
                    value: "Power (kW)",
                    angle: -90,
                    position: "insideLeft",
                    fill: "white",
                    style: { fontSize: "12px" },
                    // offset: 0,
                    dx: 8,
                    dy: 35
                  }}
                  width={60}
                />
                <Tooltip />

                <Line
                  type="monotone"
                  dataKey="power"
                  dot={false}
                  stroke={yellow} //yellow
                  fill="transparent"
                  fillOpacity={100}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </div>
          </SideLayout>
        )}
      </div>
    </Layout>
  );
}
