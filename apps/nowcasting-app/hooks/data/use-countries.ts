import { useUser } from "@auth0/nextjs-auth0/client";
import { useMemo } from "react";

import { getCountryConfig } from "../../config/countries";
import useGlobalState from "../../components/helpers/globalState";
import { readCountryClaim, isEntitled } from "../../lib/api/auth/entitlement";
import * as queries from "../../lib/api/v1/queries";
import { queryKey } from "../../lib/api/v1/queries";
import { normaliseCountries } from "../../lib/domain/normalise";
import type { CountryListing } from "../../lib/domain/types";
import { manifestSwrOptions, useApiQuery } from "./query";

// The country manifest, joined to the static registry and to entitlement.
//
// This is the one hook that has no `Scope`: it is what tells the rest of the app which
// scopes exist. Everything downstream takes an explicit country.

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
  // The same descriptor, normaliser and options `useRegionTypes`/`useGenerationSources` use,
  // so all three share one cache entry and one request per hour. The 503-retry / 403-no-retry
  // policy lives in `manifestSwrOptions`; see `query.ts`.
  const { data, error, isLoading } = useApiQuery(
    countriesDescriptor,
    normaliseCountries,
    manifestSwrOptions
  );

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
