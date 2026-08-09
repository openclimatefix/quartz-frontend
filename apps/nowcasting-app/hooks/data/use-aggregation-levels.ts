import { useMemo } from "react";

import { getCountryConfig } from "../../config/countries";
import { useCountryState } from "../../components/helpers/globalState";
import {
  defaultLevelOf,
  deriveAggregationLevels,
  type AggregationLevel
} from "../../components/helpers/aggregationLevels";
import { useCurrentCountry } from "./use-countries";
import { useRegionTypes } from "./use-regions";

// The current country's region-type hierarchy, as the UI consumes it.
//
// This is the hook side of `aggregationLevels.ts`: the pure derivation lives there and is
// tested there, and this only joins it to the two runtime inputs — the current country and
// the manifest's region types. Nothing here reimplements a rule.
//
// There is no `isLoading` on the return, unlike the other hooks in this layer. The registry
// alone produces a complete, usable list (see `deriveAggregationLevels`'s fallbacks), so
// there is no loading state to expose: the manifest arriving only refines the labels and
// level numbers of a list the map could already draw. Callers wanting the manifest's own
// loading state have `useRegionTypes`.

/** The current country's aggregation levels, outermost first. `[]` for an unconfigured country. */
export const useAggregationLevels = (): AggregationLevel[] => {
  const country = useCurrentCountry();
  // `useRegionTypes` takes a `Pick<Scope, "country">`; memoised so the identity is stable
  // across renders and the hook's own `useMemo` on `scope?.country` is not defeated.
  const scope = useMemo(() => ({ country }), [country]);
  const regionTypes = useRegionTypes(scope);

  return useMemo(
    () => deriveAggregationLevels(getCountryConfig(country), regionTypes.data),
    [country, regionTypes.data]
  );
};

/**
 * The level matching the current `nationalAggregationLevel`, or the country's default.
 *
 * The fallback is not defensive padding — it is the country switch. `nationalAggregationLevel`
 * is country-keyed but its *value* is a bare region type name, so a country visited for the
 * first time inherits nothing, and a stored name from an earlier build (or a level the
 * registry has since dropped) names something this country does not have. In every one of
 * those cases the answer is the country's default level, not `undefined`.
 *
 * `undefined` therefore means one thing only: the country has no levels at all, i.e. no
 * registry entry.
 */
export const useCurrentAggregationLevel = (): AggregationLevel | undefined => {
  const levels = useAggregationLevels();
  const [regionType] = useCountryState("nationalAggregationLevel");

  return useMemo(
    () => levels.find((level) => level.regionType === regionType) ?? defaultLevelOf(levels),
    [levels, regionType]
  );
};
