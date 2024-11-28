import { API_PREFIX, getAllForecastUrl } from "../../../constant";
import { FcAllResData, ForecastData, GspEntities, PvRealData } from "../../types";
import dnoGspGroupings from "../../../data/dno_gsp_groupings.json";
import ngGspZoneGroupings from "../../../data/ng_gsp_zone_groupings.json";
import useGlobalState from "../../helpers/globalState";
import { useLoadDataFromApi } from "../../hooks/useLoadDataFromApi";
import { NationalAggregation } from "../../map/types";
import { components } from "../../../types/quartz-api";

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

const useGetGspData = (gspId: number | string) => {
  const [show4hView] = useGlobalState("showNHourView");
  const [nHourForecast] = useGlobalState("nHourForecast");
  const [nationalAggregationLevel] = useGlobalState("nationalAggregationLevel");
  let errors: Error[] = [];
  let isZoneAggregation = [NationalAggregation.DNO, NationalAggregation.zone].includes(
    nationalAggregationLevel
  );

  let gspIds: number[] = typeof gspId === "number" ? [gspId] : [];
  if (nationalAggregationLevel === NationalAggregation.DNO) {
    // Get the GSP ids for the DNO
    gspIds = dnoGspGroupings[gspId as keyof typeof dnoGspGroupings] || [];
  }
  if (nationalAggregationLevel === NationalAggregation.zone) {
    gspIds = ngGspZoneGroupings[gspId as keyof typeof ngGspZoneGroupings] || [];
  }

  // TODO add check for gspIds before making the api call
  const { data: pvRealDataInRaw, error: pvRealInDayError } = useLoadDataFromApi<
    components["schemas"]["GSPYieldGroupByDatetime"][]
  >(
    // `${API_PREFIX}/solar/GB/gsp/pvlive/${gspId}?regime=in-day`
    `${API_PREFIX}/solar/GB/gsp/pvlive/all?regime=in-day&gsp_ids=${encodeURIComponent(
      gspIds.join(",")
    )}&compact=true`
  );
  const pvRealDataIn = aggregateTruthData(pvRealDataInRaw, gspIds, "solarGenerationKw");

  const { data: pvRealDataAfterRaw, error: pvRealDayAfterError } = useLoadDataFromApi<
    components["schemas"]["GSPYieldGroupByDatetime"][]
  >(
    // `${API_PREFIX}/solar/GB/gsp/pvlive/${gspId}?regime=day-after`
    `${API_PREFIX}/solar/GB/gsp/pvlive/all?regime=day-after&gsp_ids=${encodeURIComponent(
      gspIds.join(",")
    )}&compact=true`
  );
  const pvRealDataAfter = aggregateTruthData(pvRealDataAfterRaw, gspIds, "solarGenerationKw");

  //add new useSWR for gspChartData
  const { data: gspForecastDataOneGSPRaw, error: gspForecastDataOneGSPError } = useLoadDataFromApi<
    components["schemas"]["OneDatetimeManyForecastValues"][]
  >(
    // `${API_PREFIX}/solar/GB/gsp/${gspId}/forecast`,
    `${API_PREFIX}/solar/GB/gsp/forecast/all/?gsp_ids=${encodeURIComponent(
      gspIds.join(",")
    )}&compact=true&historic=true`,
    {
      dedupingInterval: 1000 * 30
    }
  );
  const gspForecastDataOneGSP = aggregateForecastData(gspForecastDataOneGSPRaw, gspIds);

  //add new useSWR for gspLocationInfo since this is not
  const { data: gspLocationInfoRaw, error: gspLocationError } = useLoadDataFromApi<GspEntities>(
    isZoneAggregation
      ? `${API_PREFIX}/system/GB/gsp/?zones=true` // TODO: API seems to struggle with UI flag if no other query params
      : `${API_PREFIX}/system/GB/gsp/?gsp_id=${gspId}`
  );
  let gspLocationInfo = gspLocationInfoRaw?.filter((gsp) => gspIds.includes(gsp.gspId));
  if (isZoneAggregation && gspLocationInfo) {
    const zoneCapacity = gspLocationInfo.reduce((acc, gsp) => acc + gsp.installedCapacityMw, 0);
    gspLocationInfo = [
      {
        gspId: gspId as number,
        gspName: gspId as string,
        regionName: gspId as string,
        installedCapacityMw: zoneCapacity,
        rmMode: true,
        label: "Zone",
        gspGroup: "Zone"
      }
    ];
  }

  // TODO: nHour with aggregation
  const nMinuteForecast = nHourForecast * 60;
  const { data: gspNHourData, error: pvNHourError } = useLoadDataFromApi<ForecastData>(
    show4hView
      ? `${API_PREFIX}/solar/GB/gsp/${gspId}/forecast?forecast_horizon_minutes=${nMinuteForecast}&historic=true&only_forecast_values=true`
      : null
  );

  return {
    errors: [
      pvRealInDayError,
      pvRealDayAfterError,
      gspForecastDataOneGSPError,
      gspLocationError,
      pvNHourError
    ].filter((e) => !!e),
    gspNHourData: gspNHourData,
    pvRealDataIn,
    pvRealDataAfter,
    gspForecastDataOneGSP,
    gspLocationInfo
  };
};

export default useGetGspData;
