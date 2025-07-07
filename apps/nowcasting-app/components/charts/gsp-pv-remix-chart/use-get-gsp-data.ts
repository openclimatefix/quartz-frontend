import { API_PREFIX, getAllForecastUrl } from "../../../constant";
import { FcAllResData, ForecastData, GspEntities, PvRealData } from "../../types";
import dnoGspGroupings from "../../../data/dno_gsp_groupings.json";
import ngGspZoneGroupings from "../../../data/ng_gsp_zone_groupings.json";
import nationalGspZone from "../../../data/national_gsp_zone.json";
import useGlobalState from "../../helpers/globalState";
import { useLoadDataFromApi } from "../../hooks/useLoadDataFromApi";
import { NationalAggregation } from "../../map/types";
import { components } from "../../../types/quartz-api";
import { getEarliestForecastTimestamp } from "../../helpers/data";

const aggregateTruthData = (
  pvDataRaw: components["schemas"]["GSPYieldGroupByDatetime"][] | undefined,
  gspIds: string[],
  key: string
) => {
  if (!pvDataRaw?.length) return [];
  return pvDataRaw?.map((d) => {
    return {
      datetimeUtc: d.datetimeUtc,
      [key]: Number(
        gspIds.reduce((acc, gspId) => {
          if (!d.generationKwByGspId?.[gspId]) return acc;
          const value = Number(d.generationKwByGspId[gspId]);
          if (isNaN(value)) return acc;
          return acc + value;
        }, 0)
      )
    };
  }) as PvRealData;
};
const aggregateForecastData = (
  pvDataRaw: components["schemas"]["OneDatetimeManyForecastValues"][] | undefined,
  gspIds: string[]
) => {
  if (!pvDataRaw?.length) return [];
  return pvDataRaw?.map((d) => {
    return {
      targetTime: d.datetimeUtc,
      expectedPowerGenerationMegawatts: Number(
        gspIds.reduce((acc, gspId) => {
          if (!d.forecastValues?.[gspId]) return acc;
          const value = Number(d.forecastValues[gspId]);
          if (isNaN(value)) return acc;
          return acc + value;
        }, 0)
      )
    };
  }) as ForecastData;
};

const useGetGspData = (selectedRegions: string[]) => {
  const [show4hView] = useGlobalState("showNHourView");
  const [nHourForecast] = useGlobalState("nHourForecast");
  const [selectedMapRegionIds] = useGlobalState("selectedMapRegionIds");
  const [nationalAggregationLevel] = useGlobalState("nationalAggregationLevel");
  let errors: Error[] = [];
  let isZoneAggregation = [
    NationalAggregation.DNO,
    NationalAggregation.zone,
    NationalAggregation.national
  ].includes(nationalAggregationLevel);

  let selectedGspIds = selectedRegions;

  const flattenSelectedGroupsToGspIds = (
    grouping: Record<string, number[]>,
    selectedRegionIds: string[]
  ) => {
    let selectedGspIds: string[] = [];
    for (const regionId of selectedRegionIds) {
      if (grouping[regionId]) {
        selectedGspIds = selectedGspIds.concat(grouping[regionId].map((gsp) => String(gsp)));
      }
    }
    return selectedGspIds;
  };

  // TODO: Reimplement aggregation as is now
  // let gspIds: number[] = typeof gspId === "number" ? [gspId] : [];
  if (nationalAggregationLevel === NationalAggregation.DNO) {
    // Get the GSP ids for the DNO
    selectedGspIds = flattenSelectedGroupsToGspIds(dnoGspGroupings, selectedRegions);
  }
  // (zone and national not fully reimplemented; not needed for now)
  // if (nationalAggregationLevel === NationalAggregation.zone) {
  //   selectedGspIds =
  //     ngGspZoneGroupings[selectedRegions[0] as keyof typeof ngGspZoneGroupings]?.map((gsp) =>
  //       String(gsp)
  //     ) || [];
  // }
  // if (nationalAggregationLevel === NationalAggregation.national) {
  //   selectedGspIds =
  //     nationalGspZone[selectedRegions[0] as keyof typeof nationalGspZone]?.map((gsp) =>
  //       String(gsp)
  //     ) || [];
  // }

  const {
    data: pvRealDataInRaw,
    isLoading: pvRealInDayLoading,
    error: pvRealInDayError
  } = useLoadDataFromApi<components["schemas"]["GSPYieldGroupByDatetime"][]>(
    `${API_PREFIX}/solar/GB/gsp/pvlive/all?regime=in-day&gsp_ids=${encodeURIComponent(
      selectedGspIds.join(",")
    )}&compact=true`
  );
  const pvRealDataIn = aggregateTruthData(pvRealDataInRaw, selectedGspIds, "solarGenerationKw");

  const {
    data: pvRealDataAfterRaw,
    isLoading: pvRealDayAfterLoading,
    error: pvRealDayAfterError
  } = useLoadDataFromApi<components["schemas"]["GSPYieldGroupByDatetime"][]>(
    `${API_PREFIX}/solar/GB/gsp/pvlive/all?regime=day-after&gsp_ids=${encodeURIComponent(
      selectedGspIds.join(",")
    )}&compact=true`
  );
  const pvRealDataAfter = aggregateTruthData(
    pvRealDataAfterRaw,
    selectedGspIds,
    "solarGenerationKw"
  );

  const startDatetime = getEarliestForecastTimestamp();
  const {
    data: gspForecastDataOneGSPRaw,
    isLoading: gspForecastSelectedGSPsLoading,
    error: gspForecastDataOneGSPError
  } = useLoadDataFromApi<components["schemas"]["OneDatetimeManyForecastValues"][]>(
    `${API_PREFIX}/solar/GB/gsp/forecast/all/?gsp_ids=${encodeURIComponent(
      selectedGspIds.join(",")
    )}&compact=true&historic=true&start_datetime_utc=${encodeURIComponent(startDatetime)}`,
    {
      dedupingInterval: 1000 * 30
    }
  );
  const gspForecastDataOneGSP = aggregateForecastData(gspForecastDataOneGSPRaw, selectedGspIds);

  const { data: gspLocationInfoRaw, error: gspLocationError } = useLoadDataFromApi<GspEntities>(
    isZoneAggregation || (selectedMapRegionIds?.length && selectedMapRegionIds.length > 1)
      ? `${API_PREFIX}/system/GB/gsp/?zones=true` // TODO: API seems to struggle with UI flag if no other query params
      : `${API_PREFIX}/system/GB/gsp/?gsp_id=${selectedGspIds[0]}`
  );
  // TODO: Need to sort out the string/number mismatch in the GSP IDs
  let gspLocationInfo =
    gspLocationInfoRaw && gspLocationInfoRaw?.length > 1
      ? gspLocationInfoRaw?.filter((gsp) => selectedGspIds.includes(String(gsp.gspId)))
      : gspLocationInfoRaw;
  if (isZoneAggregation && gspLocationInfo) {
    const zoneCapacity = gspLocationInfo.reduce((acc, gsp) => acc + gsp.installedCapacityMw, 0);
    gspLocationInfo = [
      {
        gspId: Number(selectedGspIds[0]),
        gspName: String(selectedGspIds[0]) as string,
        regionName: String(selectedGspIds[0]) as string,
        installedCapacityMw: zoneCapacity,
        rmMode: true,
        label: "Zone",
        gspGroup: "Zone"
      }
    ];
  }

  // TODO: nHour with aggregation when /forecast/all API endpoint has new forecast_horizon_minutes param
  // For now, let's disable the N hour forecast when multiple GSPs are selected
  const nMinuteForecast = nHourForecast * 60;
  const {
    data: gspNHourDataRaw,
    isLoading: gspNHourLoading,
    isValidating: gspNHourValidating,
    error: pvNHourError
  } = useLoadDataFromApi<components["schemas"]["ForecastValue"][]>(
    show4hView && !isZoneAggregation && selectedGspIds.length === 1
      ? `${API_PREFIX}/solar/GB/gsp/${String(
          selectedGspIds[0]
        )}/forecast?forecast_horizon_minutes=${nMinuteForecast}&historic=true&only_forecast_values=true`
      : null
  );
  let gspNHourData =
    selectedGspIds.length === 1 && !gspNHourValidating && !gspNHourLoading
      ? gspNHourDataRaw || []
      : [];

  return {
    errors: [
      pvRealInDayError,
      pvRealDayAfterError,
      gspForecastDataOneGSPError,
      gspLocationError,
      pvNHourError
    ].filter((e) => !!e),
    loading: {
      pvRealInDayLoading,
      pvRealDayAfterLoading,
      gspForecastSelectedGSPsLoading
    },
    gspNHourData,
    pvRealDataIn,
    pvRealDataAfter,
    gspForecastDataOneGSP,
    gspLocationInfo
  };
};

export default useGetGspData;
