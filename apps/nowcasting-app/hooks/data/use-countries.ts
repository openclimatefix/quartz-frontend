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
 * The country the chart, the headline figures, the level selector and the CSV follow.
 *
 * One of the two halves `useCurrentCountry` split into (`docs/phase6-layout-contract.md`
 * §1). This is the "which country am I reading" question; `useEnabledCountries` is the
 * "which countries am I looking at" one.
 *
 * Backed by global state, seeded from the `country` cookie and written by
 * `setFocusedCountry` — from the header toggle, and from a map region click, which focuses
 * the country the region belongs to. Do not read `focusedCountry` from global state
 * anywhere but here.
 *
 * The value is always a valid, enabled code: `getValidatedFocusedCountry` falls the cookie
 * back to `DEFAULT_COUNTRY_CODE` on load, and `setFocusedCountry` normalises whatever it is
 * given and enables it if it was not already.
 */
export const useFocusedCountry = (): string => useGlobalState("focusedCountry")[0];

/**
 * Every country currently drawn on the map, focused one included.
 *
 * The other half of the split. Never empty, and always contains the focused country — see
 * `setEnabledCountries` for where those invariants are kept.
 *
 * Codes rather than listings, on purpose: this is synchronous global state with no request
 * behind it, so a map layer or a cursor grid can depend on it without inheriting the
 * manifest's loading and error states. Use `useEnabledCountryListings` when you need the
 * name, the config or the entitlement alongside.
 */
export const useEnabledCountries = (): string[] => useGlobalState("enabledCountries")[0];

/**
 * The enabled set as manifest listings — name, config and entitlement attached.
 *
 * The intersection of three things: enabled (what the user turned on), entitled (what they
 * may see) and configured (what this build can draw). Entitlement is applied *here* rather
 * than in the state layer because the claim arrives asynchronously and does not exist on the
 * tenant yet: a hook can wait for it behind `isLoading`, whereas state initialisation
 * cannot, and would have emptied the set for every user in production.
 *
 * Ordered by the enabled set, not the manifest, so the order the user built is the order
 * things render in.
 */
export const useEnabledCountryListings = (): UseCountriesResult => {
  const { countries, isLoading, error } = useEntitledCountries();
  const enabled = useEnabledCountries();
  const listings = useMemo(
    () =>
      enabled
        .map((code) => countries.find((country) => country.code === code))
        .filter((country): country is CountryListing => country !== undefined),
    [countries, enabled]
  );
  return { countries: listings, isLoading, error };
};
