import React from "react";

import {
  setEnabledCountries,
  setEnabledCountriesDerived
} from "../../components/helpers/globalState";
import {
  CookieStorageKeys,
  getArraySettingFromCookieStorage
} from "../../components/helpers/cookieStorage";
import { normaliseCountryCodes } from "../../components/helpers/countryState";
import { useEnabledCountries, useEntitledCountries, useIsOcfAdmin } from "./use-countries";

/**
 * Keeps the enabled set in line with entitlement. Two rules, by who is signed in.
 *
 * **Regular users: the enabled set IS the entitled, configured set.** Switching countries on
 * and off is for OCF staff giving demos, so for everyone else the set is derived, not chosen.
 * Whenever the two differ — on load, when the manifest or the claim arrives, when entitlement
 * changes mid-session, or after anything else writes the set — this puts it back. The
 * enabled-countries cookie is not read, and `setEnabledCountriesDerived(true)` stops it being
 * written. Global state is still seeded from the cookie at module load, before the user is
 * known; that stale set (say GB alone, from before this rule) is overwritten here as soon as
 * the entitled list is known. The cookie is left where it is.
 *
 * **OCF admins (`useIsOcfAdmin`): SEEDS the set once, for a visitor who has never chosen.**
 * The set is theirs to change in the map drawer, so the sync only runs when the cookie holds
 * no set at all. It still matters: the default enabled set is GB alone, so without it an
 * account entitled only to NL or DE would open on an empty map.
 *
 * Both are guarded against calling `setEnabledCountries([])`: the manifest is an hour-cached
 * request that can be loading or can fail, and `useEntitledCountries` reports an empty list in
 * both cases (and while the Auth0 user is still loading, since there is no claim yet). The set
 * already there is left alone. A regular user entitled to nothing therefore keeps the set
 * global state started with (the cookie's, else GB); `useEnabledCountryListings` intersects it
 * with entitlement, so nothing is drawn.
 */
const useSyncEnabledCountries = (): void => {
  const { countries, isLoading, error } = useEntitledCountries();
  const isAdmin = useIsOcfAdmin();
  const enabled = useEnabledCountries();
  const codes = countries.map((country) => country.code);
  // Stable across renders that yield the same set, so the effect below only fires on an
  // actual change to which countries are entitled or enabled — not on every unrelated
  // re-render this hook's owner goes through.
  // Normalised the way `setEnabledCountries` stores codes, so the regular-user comparison
  // below cannot see a difference that writing would not remove, and loop.
  const key = normaliseCountryCodes(codes).sort().join(",");
  const enabledKey = enabled.slice().sort().join(",");

  React.useEffect(() => {
    if (isLoading || error) return;
    if (codes.length === 0) return;
    setEnabledCountriesDerived(!isAdmin);
    if (!isAdmin) {
      if (enabledKey !== key) setEnabledCountries(codes);
      return;
    }
    // Someone who has used the drawer has a set of their own; leave it alone.
    const chosen = getArraySettingFromCookieStorage<string>(CookieStorageKeys.ENABLED_COUNTRIES);
    if (chosen && chosen.length > 0) return;
    setEnabledCountries(codes);
    // `codes` is intentionally not a dependency: `key` already captures its identity, and
    // recomputing it inside the effect would defeat the point of the guard above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabledKey, isAdmin, isLoading, error]);
};

export default useSyncEnabledCountries;
