import type { Scope } from "../../lib/domain/types";

/**
 * Scope helpers shared by the data hooks. Pure — no React, no fetching.
 *
 * There is no ambient country anywhere in this layer. Every hook takes an explicit `Scope`,
 * which is what makes the map's N-country fanout cost one extra argument instead of a second
 * refactor. `useCurrentCountry()` supplies the default scope in the UI, never here.
 */

/**
 * The region type — and, conveniently, the path alias — for a country's whole-country region.
 *
 * GB's national region is *named* "Great Britain"; `national` is accepted as a path alias.
 * Key on the alias, display the name (`Region.label`, from `metadata.full_name`). Raw codes
 * must never reach users.
 */
export const NATIONAL_REGION_TYPE = "national";

/**
 * The region name a region-scoped request should use, or `undefined` if the scope does not
 * name one yet.
 *
 * A national scope needs no explicit region: the region type doubles as the path alias. Any
 * other region type does — `"gsp"` is a region *type*, never a region — and until the user
 * has selected one the query is disabled rather than sent with a bogus path segment.
 */
export const resolveRegionName = (scope: Scope): string | undefined =>
  scope.region ?? (scope.regionType === NATIONAL_REGION_TYPE ? NATIONAL_REGION_TYPE : undefined);

/** A scope narrowed to a single region, as `queries.ts`'s region-scoped builders want it. */
export type RegionScope = { country: string; source: string; region: string };

/**
 * `scope` as a region-scoped request, or `null` when no region is resolvable — which is
 * exactly the argument `useApiQuery` treats as "do not fetch".
 */
export const toRegionScope = (scope: Scope | null | undefined): RegionScope | null => {
  if (!scope) return null;
  const region = resolveRegionName(scope);
  if (region === undefined || region === "") return null;
  return { country: scope.country, source: scope.source, region };
};

/** True when a scope is complete enough to address a whole region type. */
export const isFetchableScope = (scope: Scope | null | undefined): scope is Scope =>
  !!scope && !!scope.country && !!scope.source && !!scope.regionType;
