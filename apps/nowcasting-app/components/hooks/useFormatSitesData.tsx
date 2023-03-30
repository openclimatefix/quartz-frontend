// TABLE DATA MANIPULATION
// site level
import { formatISODateString } from "../helpers/utils";
import { useEffect, useMemo, useState } from "react";
import {
  AggregatedSitesCombinedData,
  CombinedSitesData,
  SitePvActual,
  SitePvForecast
} from "../types";
import gspLatLongData from "../../data/gsp_lat_long_map.json";
import { AGGREGATION_LEVELS } from "../../constant";

const gspLatLongMap = new Map(gspLatLongData as [string, { lat: number; long: number }][]);

const getExpectedPowerGenerationForSite = (
  forecastData: SitePvForecast[],
  site_uuid: string,
  targetTime: string
) => {
  const siteForecast = forecastData.find((fc) => fc.site_uuid === site_uuid);
  return (
    siteForecast?.forecast_values.find(
      (fv) => formatISODateString(fv.target_datetime_utc) === formatISODateString(targetTime)
    )?.expected_generation_kw || 0
  );
};

const getPvActualGenerationForSite = (
  pvActualData: SitePvActual[],
  site_uuid: string,
  targetTime: string
) => {
  const siteForecast = pvActualData.find((pv) => pv.site_uuid === site_uuid);
  return (
    siteForecast?.pv_actual_values.find(
      (pv) => formatISODateString(pv.datetime_utc) === formatISODateString(targetTime)
    )?.actual_generation_kw || 0
  );
};

export const useFormatSitesData = (
  combinedSitesData: CombinedSitesData,
  selectedISOTime: string
) => {
  // const [sitesTableData, setSitesTableData] = useState<{
  //   sites: Map<string, SiteData>;
  //   regions: Map<string, SiteData>;
  //   gsps: Map<string, SiteData>;
  //   national: SiteData;
  // }>({
  //   sites: new Map(),
  //   regions: new Map(),
  //   gsps: new Map(),
  //   national: { label: "National", capacity: 0, actualPV: 0, expectedPV: 0, aggregatedYield: 0 }
  // });

  const data = useMemo(() => {
    const sitesTableData: AggregatedSitesCombinedData = {
      sites: new Map(),
      regions: new Map(),
      gsps: new Map(),
      national: new Map()
    };

    // Loop through the sites and aggregate the data by Region, GSP, and National
    for (const i in combinedSitesData?.allSitesData || []) {
      if (!combinedSitesData?.allSitesData) break;

      const site = combinedSitesData.allSitesData?.[i];
      if (!site) continue;
      const lastSite = (combinedSitesData?.allSitesData || []).length - 1 === Number(i);
      const siteCapacity = site.installed_capacity_kw;
      const siteActualPV = getPvActualGenerationForSite(
        combinedSitesData.sitesPvActualData,
        site.site_uuid,
        selectedISOTime
      );
      const siteExpectedPV = getExpectedPowerGenerationForSite(
        combinedSitesData.sitesPvForecastData,
        site.site_uuid,
        selectedISOTime
      );

      // site level
      const siteName = site.client_site_name || site.client_site_id || site.site_uuid;
      let updatedSiteData = sitesTableData.sites.get(siteName) || {
        id: site.site_uuid,
        label: siteName,
        capacity: 0,
        actualPV: 0,
        expectedPV: 0,
        aggregatedYield: 0,
        lat: 0,
        lng: 0
      };
      updatedSiteData.capacity += siteCapacity;
      updatedSiteData.actualPV += siteActualPV;
      updatedSiteData.expectedPV += siteExpectedPV;
      updatedSiteData.aggregatedYield =
        ((updatedSiteData.actualPV || updatedSiteData.expectedPV) / updatedSiteData.capacity) * 100;
      updatedSiteData.lat = site.latitude;
      updatedSiteData.lng = site.longitude;
      sitesTableData.sites.set(siteName, updatedSiteData);

      // region level
      const region = JSON.parse(site.dno);
      const regionName: string = region?.long_name || "";
      const regionLatLong = gspLatLongMap.get(region.dno_id);
      const regionLat = regionLatLong?.lat || 0;
      const regionLong = regionLatLong?.long || 0;
      let updatedRegionData = sitesTableData.regions.get(regionName) || {
        id: region.dno_id,
        label: regionName,
        capacity: 0,
        actualPV: 0,
        expectedPV: 0,
        aggregatedYield: 0,
        lat: regionLat,
        lng: regionLong
      };
      updatedRegionData.capacity += siteCapacity;
      updatedRegionData.actualPV += siteActualPV;
      updatedRegionData.expectedPV += siteExpectedPV;
      sitesTableData.regions.set(regionName, updatedRegionData);

      // gsp level
      const gsp = JSON.parse(site.gsp);
      const gspName: string = gsp?.name || "";
      const gspLatLong = gspLatLongMap.get(gsp.gsp_id);
      const gspLat = gspLatLong?.lat || 0;
      const gspLong = gspLatLong?.long || 0;
      let updatedGspData = sitesTableData.gsps.get(gspName) || {
        id: gsp.gsp_id,
        label: gspName,
        capacity: 0,
        actualPV: 0,
        expectedPV: 0,
        aggregatedYield: 0,
        lat: gspLat,
        lng: gspLong
      };
      updatedGspData.capacity += siteCapacity;
      updatedGspData.actualPV += siteActualPV;
      updatedGspData.expectedPV += siteExpectedPV;
      if (lastSite) {
        updatedGspData.aggregatedYield =
          ((updatedGspData.actualPV || updatedGspData.expectedPV) / updatedGspData.capacity) * 100;
      }
      sitesTableData.gsps.set(gspName, updatedGspData);

      // national level
      const national = "National";
      let updatedNationalData = sitesTableData.national.get(national) || {
        id: "national",
        label: "National Aggregate Value",
        capacity: 0,
        actualPV: 0,
        expectedPV: 0,
        aggregatedYield: 0,
        lat: 0,
        lng: 0
      };
      updatedNationalData.capacity += siteCapacity;
      updatedNationalData.actualPV += siteActualPV;
      updatedNationalData.expectedPV += siteExpectedPV;
      if (lastSite) {
        updatedNationalData.aggregatedYield =
          ((updatedNationalData.actualPV || updatedNationalData.expectedPV) /
            updatedNationalData.capacity) *
          100;
      }
      sitesTableData.national.set(national, updatedNationalData);

      // set aggregated yield at the end of the loop
      if (lastSite) {
        sitesTableData.regions.forEach((region, regionName) => {
          let updatedRegionFinalData = sitesTableData.regions.get(regionName);
          if (!updatedRegionFinalData) return;
          updatedRegionFinalData.aggregatedYield =
            ((updatedRegionFinalData.actualPV || updatedRegionFinalData.expectedPV) /
              updatedRegionFinalData.capacity) *
            100;
          sitesTableData.regions.set(regionName, updatedRegionFinalData);
        });
        sitesTableData.gsps.forEach((gsp, gspName) => {
          let updatedGspFinalData = sitesTableData.gsps.get(gspName);
          if (!updatedGspFinalData) return;
          updatedGspFinalData.aggregatedYield =
            ((updatedGspFinalData.actualPV || updatedGspFinalData.expectedPV) /
              updatedGspFinalData.capacity) *
            100;
          sitesTableData.gsps.set(gspName, updatedGspFinalData);
        });
      }
    }
    return sitesTableData;
  }, [combinedSitesData, selectedISOTime]);
  return data;
};
