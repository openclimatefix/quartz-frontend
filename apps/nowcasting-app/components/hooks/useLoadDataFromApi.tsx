import useSWR, { SWRConfiguration, SWRResponse } from "swr";
import { axiosFetcherAuth } from "../helpers/utils";

const t5min = 1000 * 60 * 5;
const t2min = 1000 * 60 * 2;

// `T` is deliberately unconstrained.
//
// This used to be bounded by a union of every known response type, with
// `ResponseObjectMap<operations>` as the last member. That final member — pulled from
// the generated API types for a typed client that was never wired up — matched almost
// anything, so the bound admitted every call site while appearing to check them. Several
// callers pass compact shapes (`{ datetimeUtc, generationKwByGspId }[]` and friends) that
// no other member of the union describes; they type-checked only because of the
// wildcard.
//
// Removing the dead typed client removed the wildcard and those call sites stopped
// compiling, which is the bound finally telling the truth: it was never constraining
// anything. Rather than re-enumerate shapes that the v1 migration is about to delete,
// the bound is dropped. Real response typing arrives with the generated v1 client, where
// the URL determines the response type instead of the caller asserting it.
export const useLoadDataFromApi = <T,>(
  url: string | null,
  config: SWRConfiguration<T, Error> = {}
): SWRResponse<T, Error> => {
  const uiFlag = url?.includes("?") ? "&UI=true" : "?UI=true";
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
