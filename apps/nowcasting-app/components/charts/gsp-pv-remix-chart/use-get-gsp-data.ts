import useSWR from "swr";
import { API_PREFIX, getAllForecastUrl } from "../../../constant";
import { FcAllResData, ForecastValue } from "../../types";
import useGlobalState from "../../helpers/globalState";
import { axiosFetcherAuth } from "../../helpers/utils";

const t5min = 60 * 1000 * 5;
const useGetGspData = (gspId: number) => {
  const [show4hView] = useGlobalState("show4hView");
  const { data: fcAll, error: fcAllError } = useSWR<FcAllResData>(
    getAllForecastUrl(true, true),
    axiosFetcherAuth,
    {
      refreshInterval: t5min
    }
  );

  const { data: pvRealDataIn, error: pvRealInDat } = useSWR<
    {
      datetimeUtc: string;
      solarGenerationKw: number;
    }[]
  >(`${API_PREFIX}/solar/GB/gsp/pvlive/${gspId}?regime=in-day&UI`, axiosFetcherAuth, {
    refreshInterval: t5min
  });

  const { data: pvRealDataAfter, error: pvRealDayAfter } = useSWR<
    {
      datetimeUtc: string;
      solarGenerationKw: number;
    }[]
  >(`${API_PREFIX}/solar/GB/gsp/pvlive/${gspId}?regime=day-after&UI`, axiosFetcherAuth, {
    refreshInterval: t5min
  });

  const { data: gsp4HourData, error: pv4HourError } = useSWR<ForecastValue[]>(
    show4hView
      ? `${API_PREFIX}/solar/GB/gsp/forecast/${gspId}?forecast_horizon_minutes=240&historic=true&only_forecast_values=true&UI`
      : null,
    axiosFetcherAuth,
    {
      refreshInterval: 60 * 1000 * 5 // 5min
    }
  );

  return {
    errors: [fcAllError, pvRealInDat, pvRealDayAfter, pv4HourError].filter((e) => !!e),
    fcAll,
    gsp4HourData,
    pvRealDataIn,
    pvRealDataAfter
  };
};

export default useGetGspData;
