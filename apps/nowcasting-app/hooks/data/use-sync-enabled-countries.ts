import React from "react";

import { setEnabledCountries } from "../../components/helpers/globalState";
import {
  CookieStorageKeys,
  getArraySettingFromCookieStorage
} from "../../components/helpers/cookieStorage";
import { useEntitledCountries } from "./use-countries";

/**
 * SEEDS the enabled set to "every entitled and configured country", once, for a visitor who
 * has never chosen.
 *
 * It used to *pin* the set to that list on every load, standing in for an enable/disable UI
 * that did not exist. The UI exists now (`map-extras-drawer.tsx`), and a control whose
 * choices are overwritten on the next render is not a control — so the sync only runs when
 * the cookie holds no set at all. It still matters: the default enabled set is GB alone, so
 * without it an account entitled only to NL or DE would open on an empty map.
 *
 * Guarded against calling `setEnabledCountries([])`: the manifest is an hour-cached request
 * that can be loading or can fail, and `useEntitledCountries` reports an empty list in both
 * cases. `setEnabledCountries` already refuses an empty set, but an empty *entitled* list
 * during a transient failure should not even attempt to collapse the map that far — the
 * enabled set the user already had (from the cookie) should simply be left alone.
 */
const useSyncEnabledCountries = (): void => {
  const { countries, isLoading, error } = useEntitledCountries();
  const codes = countries.map((country) => country.code);
  // Stable across renders that yield the same set, so the effect below only fires on an
  // actual change to which countries are entitled — not on every unrelated re-render this
  // hook's owner goes through.
  const key = codes.slice().sort().join(",");

  React.useEffect(() => {
    if (isLoading || error) return;
    if (codes.length === 0) return;
    // Someone who has used the drawer has a set of their own; leave it alone.
    const chosen = getArraySettingFromCookieStorage<string>(CookieStorageKeys.ENABLED_COUNTRIES);
    if (chosen && chosen.length > 0) return;
    setEnabledCountries(codes);
    // `codes` is intentionally not a dependency: `key` already captures its identity, and
    // recomputing it inside the effect would defeat the point of the guard above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, isLoading, error]);
};

export default useSyncEnabledCountries;
