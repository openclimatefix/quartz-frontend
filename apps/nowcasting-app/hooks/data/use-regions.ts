import { useMemo } from "react";

import * as queries from "../../lib/api/v1/queries";
import type { RegionsFilter } from "../../lib/api/v1/queries";
import { normaliseCountries, normaliseRegions } from "../../lib/domain/normalise";
import type {
  CountryCapability,
  GenerationSourceCapability,
  Region,
  RegionTypeCapability,
  Scope
} from "../../lib/domain/types";
import { manifestSwrOptions, useApiQuery, type DataResult } from "./query";
import { isFetchableScope } from "./scope";

/**
 * Region and capability lookups.
 *
 * `useRegions` is a real request. `useRegionTypes` and `useGenerationSources` are slices of
 * the hourly `/countries` manifest rather than calls to `/region-types` and
 * `/generation-sources`: the manifest carries the same data, is already fetched by the
 * header, and `normalise.ts` exports a normaliser for it (see the gap note in
 * docs/phase4-contract.md — the standalone endpoints have no exported normaliser, and adding one
 * belongs in `lib/domain`, not here). Sharing the descriptor means sharing the cache entry:
 * a view asking for region types costs no request at all.
 */

/** The manifest, normalised. Same descriptor and options as `useCountries`, so same entry. */
const useManifest = (): DataResult<CountryCapability[]> =>
  useApiQuery(queries.countries(), normaliseCountries, manifestSwrOptions);

/**
 * `/{country}/{source}/regions?region_type=…` — the regions of `scope.regionType`.
 *
 * `Region.label` is `metadata.full_name` ("City Road"), falling back to the raw `name`
 * (`citr_1`) only when the API sends none. Display the label; key on the name — the name is
 * what every other response and every path segment uses, and what the GeoJSON join matches
 * on after the registry's `joinTransform`.
 *
 * `filter.parent` / `filter.name` narrow the list further; `region_type` always comes from
 * the scope.
 */
export const useRegions = (
  scope: Scope | null | undefined,
  filter: Omit<RegionsFilter, "regionType"> = {}
): DataResult<Region[]> =>
  useApiQuery(
    isFetchableScope(scope)
      ? queries.regions(scope, { ...filter, regionType: scope.regionType })
      : null,
    normaliseRegions
  );

/**
 * Every region type a country offers, with its hierarchy level and its forecast models.
 *
 * **Models are per region type, not per country.** GB `national` offers 12 models defaulting
 * to `blend_adjust`; GB `gsp` offers 3 defaulting to `blend`. A model picker that reads the
 * country's models rather than the region type's will offer models the endpoint rejects.
 *
 * `level` is sparse (0 national, 10 gsp/province) by design, leaving room for GB's
 * client-side DNO and NG-zone levels from the registry.
 */
export const useRegionTypes = (
  scope: Pick<Scope, "country"> | null | undefined
): DataResult<RegionTypeCapability[]> => {
  const manifest = useManifest();
  const country = scope?.country;
  const data = useMemo(
    () => manifest.data?.find((entry) => entry.code === country)?.regionTypes,
    [manifest.data, country]
  );
  return { ...manifest, data };
};

/**
 * The one region type a scope names, or `undefined` while the manifest is loading or if the
 * country does not offer it. This is what a model picker binds to: `.forecastModels` for the
 * options, `.defaultModel` for the initial selection and for what the API will use when no
 * `model` is sent.
 */
export const useRegionTypeCapability = (
  scope: Scope | null | undefined
): DataResult<RegionTypeCapability | undefined> => {
  const regionTypes = useRegionTypes(scope);
  const regionType = scope?.regionType;
  const data = useMemo(
    () => regionTypes.data?.find((entry) => entry.type === regionType),
    [regionTypes.data, regionType]
  );
  return { ...regionTypes, data };
};

/**
 * The country's generation observers, in manifest order.
 *
 * GB has two (`pvlive_in_day` "PV Live Estimated", `pvlive_day_after` "PV Live Updated");
 * NL has one (`ned_nl`). Chart series must be built from this list — the two-line
 * GENERATION vs GENERATION_UPDATED chart is a GB fact, not a shape every country has.
 */
export const useGenerationSources = (
  scope: Pick<Scope, "country" | "source"> | null | undefined
): DataResult<GenerationSourceCapability[]> => {
  const manifest = useManifest();
  const country = scope?.country;
  const source = scope?.source;
  const data = useMemo(() => {
    const sources = manifest.data?.find((entry) => entry.code === country)?.generationSources;
    if (sources === undefined) return undefined;
    return source === undefined ? sources : sources.filter((entry) => entry.source === source);
  }, [manifest.data, country, source]);
  return { ...manifest, data };
};
