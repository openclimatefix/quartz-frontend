import React from "react";

import { setEnabledCountries } from "../../components/helpers/globalState";
import { useEntitledCountries } from "./use-countries";

/**
 * Temporary scaffolding: keeps the enabled set equal to "every entitled and configured
 * country", now that the header's country control owns focus rather than the enabled set.
 *
 * The enable/disable UI is moving to a sidebar and has not landed yet, so until it does there
 * is no control left that can shrink the enabled set on purpose — this hook is what stands in
 * for it, mounted once in the header. `setEnabledCountries`/`toggleCountryEnabled` in
 * `globalState` are untouched and ready for that control to call directly when it exists;
 * delete this hook and its mount point then.
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
    setEnabledCountries(codes);
    // `codes` is intentionally not a dependency: `key` already captures its identity, and
    // recomputing it inside the effect would defeat the point of the guard above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, isLoading, error]);
};

export default useSyncEnabledCountries;
