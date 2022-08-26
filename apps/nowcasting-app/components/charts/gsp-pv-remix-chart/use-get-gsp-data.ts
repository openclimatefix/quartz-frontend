/*
Pulls data for GSP chart
*/
import useSWR from "swr";
import { API_PREFIX, getAllForecastUrl } from "../../../constant";
import { FcAllResData } from "../../types";
import { axiosFetcher } from "../../utils";

const t5min = 60 * 1000 * 5;
const useGetGspData = (gspId: number) => {
  const { data: fcAll, error: error1 } = useSWR<FcAllResData>(
    getAllForecastUrl(true, true),
    axiosFetcher,
    {
      refreshInterval: t5min,
    },
  );

  const { data: pvRealDataIn, error: error2 } = useSWR<
    {
      datetimeUtc: string;
      solarGenerationKw: number;
    }[]
  >(`${API_PREFIX}/GB/solar/gsp/pvlive/one_gsp/${gspId}/?regime=in-day`, axiosFetcher, {
    refreshInterval: t5min,
  });

  const { data: pvRealDataAfter, error: error3 } = useSWR<
    {
      datetimeUtc: string;
      solarGenerationKw: number;
    }[]
  >(`${API_PREFIX}/GB/solar/gsp/pvlive/one_gsp/${gspId}/?regime=day-after`, axiosFetcher, {
    refreshInterval: t5min,
  });
  return {
    errors: [error1, error2, error3].filter((e) => !!e),
    fcAll,
    pvRealDataIn,
    pvRealDataAfter,
  };
};
export default useGetGspData;
