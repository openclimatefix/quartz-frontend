import {
  AllGspRealData,
  AllSites,
  FcAllResData,
  ForecastData,
  GspAllForecastData,
  National4HourData,
  PvRealData,
  SitesPvActual,
  SitesPvForecast,
  SolarStatus
} from "../types";
import useSWR, { SWRConfiguration, SWRResponse } from "swr";
import { axiosFetcherAuth } from "../helpers/utils";

const t5min = 1000 * 60 * 5;
const t2min = 1000 * 60 * 2;

type APIResponseType =
  | ForecastData
  | PvRealData
  | National4HourData
  | GspAllForecastData
  | AllGspRealData
  | AllSites
  | SitesPvForecast
  | SitesPvActual
  | SolarStatus
  | FcAllResData;
export const useLoadDataFromApi = <T extends APIResponseType>(
  url: string | null,
  config: SWRConfiguration<T, Error> = {}
): SWRResponse<T, Error> => {
  return useSWR<T, Error>(url, axiosFetcherAuth, {
    refreshInterval: t5min,
    dedupingInterval: t2min,
    keepPreviousData: true,
    onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
      if (error.toString().includes("403")) return;
      if (retryCount >= 10) return;
      setTimeout(() => revalidate({ retryCount }), 2000);
    },
    ...config
  });
};
