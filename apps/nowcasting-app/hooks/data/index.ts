/**
 * The Phase 4 data layer's public surface. See `docs/phase4-contract.md` for signatures,
 * endpoint mapping and error semantics.
 *
 * Every hook here takes an explicit `Scope` and returns one SWR record. There is no
 * composing hook and no shared bundle: a view container calls the two or three hooks it
 * needs, and SWR's cache key does the deduplication that `CombinedData` used to do by hand.
 */

export type { DataResult, ApiErrorInfo } from "./query";
export { describeApiError, apiV1SwrOptions, manifestSwrOptions } from "./query";

export { NATIONAL_REGION_TYPE, resolveRegionName, toRegionScope, isFetchableScope } from "./scope";
export type { RegionScope } from "./scope";

export {
  DEFAULT_COUNTRY_CODE,
  useCountries,
  useCurrentCountry,
  useEntitledCountries
} from "./use-countries";
export type { UseCountriesResult } from "./use-countries";

export { useCountryFormatting } from "./use-country-format";
export type { CountryFormatting } from "./use-country-format";

export {
  useGenerationSources,
  useRegionTypeCapability,
  useRegionTypes,
  useRegions
} from "./use-regions";

export {
  useForecastLastUpdated,
  useForecastPeriod,
  useForecastSnapshot,
  useNationalForecast,
  useRegionForecast
} from "./use-forecast";

export {
  useGenerationPeriod,
  useGenerationSnapshot,
  useNationalGeneration,
  useRegionGeneration
} from "./use-generation";

export {
  publishedRegions,
  regionSnapshotPowerMw,
  regionSnapshotState,
  snapshotCoverage
} from "./snapshot-state";
export type { RegionSnapshotState } from "./snapshot-state";

export { useLoadingState } from "./use-loading-state";
export type { NationalLoadingQueries } from "./use-loading-state";
