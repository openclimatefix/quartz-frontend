import useSWR from "swr";
import { API_PREFIX, getAllForecastUrl } from "../../../constant";
import { FcAllResData, ForecastValue } from "../../types";
import { axiosFetcher, axiosFetcherAuth } from "../../helpers/utils";

const t5min = 60 * 1000 * 5;
const useGetGspData = (gspId: number) => {
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

  // let gsp4HourData: ForecastValue[] = [];
  // let pv4HourError;
  // if (process.env.NEXT_PUBLIC_4H_VIEW === "true") {
  //   const dataResponse = useSWR<ForecastValue[]>(
  //     `${API_PREFIX}/solar/GB/gsp/forecast/${gspId}?forecast_horizon_minutes=240&historic=true&only_forecast_values=true`,
  //     axiosFetcherAuth,
  //     {
  //       refreshInterval: 60 * 1000 * 5 // 5min
  //     }
  //   );
  //   if (dataResponse.data) {
  //     gsp4HourData = dataResponse.data;
  //   } else {
  //     pv4HourError = dataResponse.error;
  //   }
  // }
  // add pv4HourError here
  return {
    errors: [fcAllError, pvRealInDat, pvRealDayAfter].filter((e) => !!e),
    fcAll,
    // gsp4HourData,
    pvRealDataIn,
    pvRealDataAfter
  };
};
export default useGetGspData;
