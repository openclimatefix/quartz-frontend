import useSWR from "swr";
import { API_PREFIX, getAllForecastUrl } from "../../../constant";
import { FcAllResData, ForecastValue } from "../../types";
import { axiosFetcher } from "../../helpers/utils";

const t5min = 60 * 1000 * 5;
const useGetGspData = (gspId: number) => {
  const { data: fcAll, error: fcAllError } = useSWR<FcAllResData>(
    getAllForecastUrl(true, true),
    axiosFetcher,
    {
      refreshInterval: t5min
    }
  );

  const { data: pvRealDataIn, error: pvRealInDat } = useSWR<
    {
      datetimeUtc: string;
      solarGenerationKw: number;
    }[]
  >(`${API_PREFIX}/solar/GB/gsp/pvlive/${gspId}?regime=in-day`, axiosFetcher, {
    refreshInterval: t5min
  });

  const { data: pvRealDataAfter, error: pvRealDayAfter } = useSWR<
    {
      datetimeUtc: string;
      solarGenerationKw: number;
    }[]
  >(`${API_PREFIX}/solar/GB/gsp/pvlive/${gspId}?regime=day-after`, axiosFetcher, {
    refreshInterval: t5min
  });

  const { data: gsp4HourData, error: pv4HourError } = useSWR<ForecastValue[]>(
    `${API_PREFIX}/solar/GB/gsp/forecast/${gspId}?forecast_horizon_minutes=240&historic=true&only_forecast_values=true`,
    axiosFetcher,
    {
      refreshInterval: 60 * 1000 * 5 // 5min
    }
  );

  return {
    errors: [fcAllError, pvRealInDat, pvRealDayAfter, pv4HourError].filter((e) => !!e),
    fcAll,
    // gsp4HourData,
    pvRealDataIn,
    pvRealDataAfter
  };
};
export default useGetGspData;
