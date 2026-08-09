import useSWR, { SWRConfiguration, SWRResponse } from "swr";
import { axiosFetcherAuth } from "../helpers/utils";
import type { Scope } from "../../lib/domain/types";

const t5min = 1000 * 60 * 5;
const t2min = 1000 * 60 * 2;

// Auth: this already goes through the app-wide shared token cache. `axiosFetcherAuth`
// (components/helpers/utils.ts) calls `lib/api/auth/token.ts#getAccessToken()`, the same
// cache satellite and the v1 client use — there is no separate ad-hoc auth path left in
// this hook to retire.
//
// `scope`, if a caller passes one, is accepted and otherwise unused. Every v0 peripheral
// (sites, satellite, the status banner) is meant to carry a `Scope` from Phase 5 onward
// even though the v0 URLs below ignore country — see docs/phase5-track-e-notes.md. That is
// what makes the later v1 swap a change to the URL-building call site, not a hunt through
// every caller for where the country should have been threaded.
type LoadDataFromApiConfig<T> = SWRConfiguration<T, Error> & { scope?: Scope };

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
  config: LoadDataFromApiConfig<T> = {}
): SWRResponse<T, Error> => {
  const { scope, ...swrConfig } = config;
  void scope;
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
    ...swrConfig
  });
};
