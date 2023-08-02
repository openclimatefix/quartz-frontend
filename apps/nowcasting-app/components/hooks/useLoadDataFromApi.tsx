import {
  AllGspRealData,
  AllSites,
  ForecastData,
  GspAllForecastData,
  National4HourData,
  PvRealData,
  SitesPvActual,
  SitesPvForecast
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
  | SitesPvActual;
export const useLoadDataFromApi = <T extends APIResponseType>(
  url: string | null,
  config: SWRConfiguration<T, Error> = {}
): SWRResponse<T, Error> => {
  return useSWR<T, Error>(url, axiosFetcherAuth, {
    refreshInterval: t5min,
    dedupingInterval: t2min,
    ...config
  });
};
