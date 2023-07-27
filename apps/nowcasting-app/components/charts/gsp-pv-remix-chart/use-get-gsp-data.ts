import useSWR from "swr";
import { API_PREFIX, getAllForecastUrl } from "../../../constant";
import { FcAllResData, ForecastData, ForecastValue, GspEntity } from "../../types";
import useGlobalState from "../../helpers/globalState";
import { axiosFetcherAuth } from "../../helpers/utils";

const t5min = 60 * 1000 * 5;
const useGetGspData = (gspId: number) => {
  const [show4hView] = useGlobalState("show4hView");

  const { data: pvRealDataIn, error: pvRealInDat } = useSWR<
    {
      datetimeUtc: string;
      solarGenerationKw: number;
    }[]
  >(`${API_PREFIX}/solar/GB/gsp/pvlive/${gspId}?regime=in-day`, axiosFetcherAuth, {
    refreshInterval: t5min
  });

  const { data: pvRealDataAfter, error: pvRealDayAfter } = useSWR<
    {
      datetimeUtc: string;
      solarGenerationKw: number;
    }[]
  >(`${API_PREFIX}/solar/GB/gsp/pvlive/${gspId}?regime=day-after`, axiosFetcherAuth, {
    refreshInterval: t5min
  });

  //add new useSWR for gspChartData
  const { data: gspForecastDataOneGSP, error: gspForecastDataOneGSPError } = useSWR<ForecastData>(
    `${API_PREFIX}/solar/GB/gsp/forecast/${gspId}?forecast_horizon_minutes=0&historic=false&only_forecast_values=true`,
    axiosFetcherAuth,
    {
      refreshInterval: 60 * 1000 * 5 // 5min
    }
  );

  //add new useSWR for gspLocationInfo since this is not
  const { data: gspLocationInfo, error: gspLocationError } = useSWR<GspEntity[]>(
    `${API_PREFIX}/system/GB/gsp/?gsp_id=${gspId}`,
    axiosFetcherAuth
  );

  const { data: gsp4HourData, error: pv4HourError } = useSWR<ForecastData>(
    show4hView
      ? `${API_PREFIX}/solar/GB/gsp/forecast/${gspId}?forecast_horizon_minutes=240&historic=true&only_forecast_values=true`
      : null,
    axiosFetcherAuth,
    {
      refreshInterval: 60 * 1000 * 5 // 5min
    }
  );

  return {
    errors: [
      pvRealInDat,
      pvRealDayAfter,
      gspForecastDataOneGSPError,
      gspLocationError,
      pv4HourError
    ].filter((e) => !!e),
    gsp4HourData,
    pvRealDataIn,
    pvRealDataAfter,
    gspForecastDataOneGSP,
    gspLocationInfo
  };
};

export default useGetGspData;
