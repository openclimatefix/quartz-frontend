import {
  AllGspRealData,
  AllSites,
  FcAllResData,
  ForecastData,
  GspAllForecastData,
  GspEntities,
  National4HourData,
  PvRealData,
  SitesPvActual,
  SitesPvForecast,
  SolarStatus
} from "../types";
import useSWR, { SWRConfiguration, SWRResponse } from "swr";
import { axiosFetcherAuth, openapiFetcherAuth } from "../helpers/utils";
import { components, operations, paths } from "../../types/quartz-api";
import createClient from "openapi-fetch";
import { HttpMethod, PathsWithMethod, ResponseObjectMap } from "openapi-typescript-helpers";
import { FetchResponse } from "openapi-fetch/src";

const t5min = 1000 * 60 * 5;
const t2min = 1000 * 60 * 2;

type APIResponseType =
  | ForecastData
  | PvRealData
  | National4HourData
  | GspAllForecastData
  | GspEntities
  | AllGspRealData
  | AllSites
  | SitesPvForecast
  | SitesPvActual
  | SolarStatus
  | FcAllResData
  | ResponseObjectMap<operations>;
export const useLoadDataFromApi = <T extends APIResponseType>(
  url: string | null,
  config: SWRConfiguration<T, Error> = {}
): SWRResponse<T, Error> => {
  const uiFlag = url?.includes("?") ? "&UI" : "?UI";
  return useSWR<T, Error>(url ? `${url}${uiFlag}` : null, axiosFetcherAuth, {
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

// TODO: Not currently used but might be able to
export const useLoadTypedDataFromApi = <T extends ResponseObjectMap<operations>>(
  url: keyof paths,
  config: SWRConfiguration<T, Error> = {}
): SWRResponse<T, Error> => {
  // type ResponseType = PathsWithMethod<paths, "get">[typeof url]["responses"][200]["content"]["application/json"]["schema"];
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
