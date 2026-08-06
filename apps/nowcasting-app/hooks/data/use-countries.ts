import { useUser } from "@auth0/nextjs-auth0/client";
import { useMemo } from "react";
import useSWR, { type SWRConfiguration } from "swr";

import { getCountryConfig } from "../../config/countries";
import useGlobalState from "../../components/helpers/globalState";
import { readCountryClaim, isEntitled } from "../../lib/api/auth/entitlement";
import { ApiV1Error, apiV1Client, isNonRetryableApiV1Error } from "../../lib/api/v1/client";
import * as queries from "../../lib/api/v1/queries";
import { queryKey } from "../../lib/api/v1/queries";
import { normaliseCountries } from "../../lib/domain/normalise";
import type { CountryListing } from "../../lib/domain/types";

// The country manifest, joined to the static registry and to entitlement.
//
// This is the one hook that has no `Scope`: it is what tells the rest of the app which
// scopes exist. Everything downstream takes an explicit country.

/** The manifest is near-static — capacity and model lists change on deploys, not minutes. */
const ONE_HOUR_MS = 60 * 60 * 1000;

/** Base for the retry backoff. Doubles per attempt, capped, up to `MAX_RETRIES`. */
const RETRY_BASE_MS = 1000;
const RETRY_CAP_MS = 30_000;
const MAX_RETRIES = 4;

/**
 * The country assumed before a cookie or the toggle says otherwise.
 *
 * Duplicated in `components/helpers/countryState.ts` (which cannot import this module
 * without dragging SWR, Auth0 and the v1 client into every component that touches state).
 * `countryState.test.ts` pins the two equal so they cannot drift; Phase 4 moves the
 * constant into `config/countries.ts`, which both can import for free.
 */
export const DEFAULT_COUNTRY_CODE = "GB";

const countriesDescriptor = queries.countries();
export const COUNTRIES_CACHE_KEY = queryKey(countriesDescriptor);

/**
 * `apiV1Client` reports failures in its return value rather than throwing, but SWR needs a
 * rejection to enter its error state — and `onErrorRetry` needs the status to decide
 * whether retrying can ever help. Converting to `ApiV1Error` at the fetcher boundary is
 * what makes `isNonRetryableApiV1Error` usable below.
 */
const fetchCountries = async () => {
  const { data, error, response } = await apiV1Client.GET(countriesDescriptor.path, {
    params: countriesDescriptor.params
  });
  if (error !== undefined || !response.ok) throw new ApiV1Error(response.status, error);
  return normaliseCountries(data ?? []);
};

/**
 * Cold `period`/`snapshot` caches answer 503 "retry in 60 seconds", so a failed request is
 * usually worth repeating; a 403 never is, because the token that produced it will not
 * become authorised. That distinction is the whole reason `ApiV1Error` carries a status.
 */
const swrOptions: SWRConfiguration = {
  dedupingInterval: ONE_HOUR_MS,
  refreshInterval: ONE_HOUR_MS,
  revalidateOnFocus: false,
  revalidateIfStale: false,
  shouldRetryOnError: true,
  onErrorRetry: (error, _key, _config, revalidate, { retryCount }) => {
    if (isNonRetryableApiV1Error(error)) return;
    if (retryCount >= MAX_RETRIES) return;
    const delay = Math.min(RETRY_BASE_MS * 2 ** (retryCount - 1), RETRY_CAP_MS);
    setTimeout(() => revalidate({ retryCount }), delay);
  }
};

export type UseCountriesResult = {
  countries: CountryListing[];
  isLoading: boolean;
  error: unknown;
};

/**
 * Every country the API serves, each marked with its registry config and entitlement.
 *
 * Nothing is filtered out here. `/countries` deliberately returns all countries so
 * prospects can see what is available before a subscription completes, and a country this
 * build has no registry entry for still appears (with `configured: false`). Callers that
 * want only the usable subset use `useEntitledCountries`.
 */
export const useCountries = (): UseCountriesResult => {
  const { user } = useUser();
  const { data, error, isLoading } = useSWR(COUNTRIES_CACHE_KEY, fetchCountries, swrOptions);

  const claim = useMemo(() => readCountryClaim(user), [user]);

  const countries = useMemo<CountryListing[]>(
    () =>
      (data ?? []).map((country) => {
        const config = getCountryConfig(country.code);
        return {
          ...country,
          config,
          configured: config !== undefined,
          entitled: isEntitled(country.code, claim)
        };
      }),
    [data, claim]
  );

  return { countries, isLoading, error };
};

/**
 * The subset the user may actually use — the manifest intersected with the claim.
 *
 * This is what the map fans out over. Unconfigured countries are excluded even when
 * entitled: without a registry entry there are no boundaries to draw and no timezone to
 * render in, so including one would be a crash rather than a degraded view.
 */
export const useEntitledCountries = (): UseCountriesResult => {
  const { countries, isLoading, error } = useCountries();
  const entitled = useMemo(
    () => countries.filter((country) => country.entitled && country.configured),
    [countries]
  );
  return { countries: entitled, isLoading, error };
};

/**
 * The country charts, headline figures and CSV default to.
 *
 * Now backed by global state, which is seeded from the `country` cookie and written by the
 * header's country toggle through `setCurrentCountry`. The signature is unchanged from when
 * this returned a constant, which is what made the swap a one-line edit — and the reason to
 * keep it that way: do not read `currentCountry` from global state anywhere but here.
 *
 * The value is always a valid code: `getValidatedCountry` falls the cookie back to
 * `DEFAULT_COUNTRY_CODE` on load, and `setCurrentCountry` normalises whatever it is given.
 */
export const useCurrentCountry = (): string => useGlobalState("currentCountry")[0];
