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
  gspIds: number[],
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
  gspIds: number[]
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

const useGetGspData = (selectedRegions: number[]) => {
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

  // TODO: Reimplement aggregation as is now
  // let gspIds: number[] = typeof gspId === "number" ? [gspId] : [];
  // if (nationalAggregationLevel === NationalAggregation.DNO) {
  //   // Get the GSP ids for the DNO
  //   gspIds = dnoGspGroupings[gspId as keyof typeof dnoGspGroupings] || [];
  // }
  // if (nationalAggregationLevel === NationalAggregation.zone) {
  //   gspIds = ngGspZoneGroupings[gspId as keyof typeof ngGspZoneGroupings] || [];
  // }
  // if (nationalAggregationLevel === NationalAggregation.national) {
  //   gspIds = nationalGspZone[gspId as keyof typeof nationalGspZone] || [];
  // }
  // if (nationalAggregationLevel === NationalAggregation.GSP && Number(gspId) !== 0) {
  //   gspIds = [Number(gspId)];
  // }

  const {
    data: pvRealDataInRaw,
    isLoading: pvRealInDayLoading,
    error: pvRealInDayError
  } = useLoadDataFromApi<components["schemas"]["GSPYieldGroupByDatetime"][]>(
    `${API_PREFIX}/solar/GB/gsp/pvlive/all?regime=in-day&gsp_ids=${encodeURIComponent(
      selectedRegions.join(",")
    )}&compact=true`
  );
  const pvRealDataIn = aggregateTruthData(pvRealDataInRaw, selectedRegions, "solarGenerationKw");

  const {
    data: pvRealDataAfterRaw,
    isLoading: pvRealDayAfterLoading,
    error: pvRealDayAfterError
  } = useLoadDataFromApi<components["schemas"]["GSPYieldGroupByDatetime"][]>(
    `${API_PREFIX}/solar/GB/gsp/pvlive/all?regime=day-after&gsp_ids=${encodeURIComponent(
      selectedRegions.join(",")
    )}&compact=true`
  );
  const pvRealDataAfter = aggregateTruthData(
    pvRealDataAfterRaw,
    selectedRegions,
    "solarGenerationKw"
  );

  const startDatetime = getEarliestForecastTimestamp();
  const {
    data: gspForecastDataOneGSPRaw,
    isLoading: gspForecastSelectedGSPsLoading,
    error: gspForecastDataOneGSPError
  } = useLoadDataFromApi<components["schemas"]["OneDatetimeManyForecastValues"][]>(
    `${API_PREFIX}/solar/GB/gsp/forecast/all/?gsp_ids=${encodeURIComponent(
      selectedRegions.join(",")
    )}&compact=true&historic=true`,
    {
      dedupingInterval: 1000 * 30
    }
  );
  const gspForecastDataOneGSP = aggregateForecastData(gspForecastDataOneGSPRaw, selectedRegions);

  const { data: gspLocationInfoRaw, error: gspLocationError } = useLoadDataFromApi<GspEntities>(
    isZoneAggregation || (selectedMapRegionIds?.length && selectedMapRegionIds.length > 1)
      ? `${API_PREFIX}/system/GB/gsp/?zones=true` // TODO: API seems to struggle with UI flag if no other query params
      : `${API_PREFIX}/system/GB/gsp/?gsp_id=${selectedRegions[0]}`
  );
  let gspLocationInfo = gspLocationInfoRaw?.filter((gsp) => selectedRegions.includes(gsp.gspId));
  if (isZoneAggregation && gspLocationInfo) {
    const zoneCapacity = gspLocationInfo.reduce((acc, gsp) => acc + gsp.installedCapacityMw, 0);
    gspLocationInfo = [
      {
        gspId: selectedRegions[0] as number,
        gspName: String(selectedRegions[0]) as string,
        regionName: String(selectedRegions[0]) as string,
        installedCapacityMw: zoneCapacity,
        rmMode: true,
        label: "Zone",
        gspGroup: "Zone"
      }
    ];
  }

  // TODO: nHour with aggregation when /forecast/all API endpoint has new forecast_horizon_minutes param
  const nMinuteForecast = nHourForecast * 60;
  const { data: gspNHourDataRaw, error: pvNHourError } = useLoadDataFromApi<
    components["schemas"]["ForecastValue"][]
  >(
    show4hView && !isZoneAggregation
      ? `${API_PREFIX}/solar/GB/gsp/${String(
          selectedRegions[0]
        )}/forecast?forecast_horizon_minutes=${nMinuteForecast}&historic=true&only_forecast_values=true`
      : null
  );
  let gspNHourData = gspNHourDataRaw || [];

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
