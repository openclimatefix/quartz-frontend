import type { CountryConfig } from "../../config/countries";
import type { RegionTypeCapability } from "../../lib/domain/types";

// The country-derived region hierarchy. This is the source of truth.
//
// It replaced `NationalAggregation` (GSP / Zone / DNO / National), which hardcoded one
// country's grid as an enum. NL has provinces and no GSPs; DE will have something else
// again. So the hierarchy is *derived* per country, from the two places that actually know
// it: the static registry (which region types have boundaries, at what zoom, and any label
// override) and the manifest (hierarchy depth and display label).
//
// `NationalAggregation` was deleted in Phase 5. `AGGREGATION_LEVELS` and the zoom enums in
// `constant.ts` survive, but only as the solar-sites view's bands — sites aggregated by
// zoom, which is not this. Nothing region-shaped should reach for them.
//
// The rule for consumers: never branch on the *identity* of a region type. Ask the level —
// `label` to display, `minZoom`/`maxZoom` for the band, `level` to order, and `derived` for
// "is this a client-side grouping", which is the only legitimate branch and is on kind, not
// name.

export type AggregationLevel = {
  /** Region type as the manifest spells it, or the synthetic name of a derived level. */
  regionType: string;
  /** Hierarchy depth, ascending from 0 (national). Sparse — see `RegionTypeCapability`. */
  level: number;
  label: string;
  /** Map zoom band this level occupies: shown from `minZoom` up to (not including) `maxZoom`. */
  minZoom: number;
  maxZoom: number;
  /** `true` for a client-side grouping (GB's DNO/zone) the API does not model. */
  derived: boolean;
};

/**
 * Hierarchy depth for a region type the manifest did not describe.
 *
 * The manifest's scale is sparse by design — 0 national, 10 gsp/province — so a
 * sub-national type sorts below national wherever it lands. Only used when the manifest
 * has not loaded yet or omits a type the registry configures.
 */
const fallbackLevel = (regionType: string): number => (regionType === "national" ? 0 : 10);

/** "province" -> "Province". Only used when the manifest supplies no label. */
const fallbackLabel = (regionType: string): string =>
  regionType.charAt(0).toUpperCase() + regionType.slice(1);

/**
 * The aggregation levels a country actually supports, ordered outermost first.
 *
 * The registry's `geo` block gates the list rather than the manifest: a region type the
 * API serves but this build has no boundaries for cannot be drawn or clicked, so offering
 * it would be a broken level. The manifest, when supplied, contributes hierarchy depth and
 * the display label — though a registry `geo.label` overrides the latter, because wording is
 * a product decision the API cannot make (see `GeoLayerConfig.label`). Derived region types
 * (GB's DNO and zone groupings) come from the registry alone; the API does not model them.
 *
 * Returns `[]` for a country with no registry entry, matching `getCountryConfig`: the
 * manifest can legally name a country this build has no configuration for.
 */
export const deriveAggregationLevels = (
  config: CountryConfig | undefined,
  regionTypes: RegionTypeCapability[] = []
): AggregationLevel[] => {
  if (!config) return [];

  const fromManifest = new Map(regionTypes.map((type) => [type.type, type]));

  const geoLevels: AggregationLevel[] = Object.entries(config.geo).map(([regionType, geo]) => {
    const manifest = fromManifest.get(regionType);
    return {
      regionType,
      level: manifest?.level ?? fallbackLevel(regionType),
      // Registry first, and deliberately so: `geo.label` is a per-country product decision
      // (GB's "GSP" over the manifest's "Grid Supply Point") and, unlike the manifest, it is
      // available on the first render rather than after a fetch.
      label: geo.label ?? manifest?.label ?? fallbackLabel(regionType),
      // The registry's per-region-type zoom band; the country's overall map bounds are the
      // only sensible fallback for a layer that declares none.
      minZoom: geo.minZoom ?? config.map.minZoom,
      maxZoom: geo.maxZoom ?? config.map.maxZoom,
      derived: false
    };
  });

  const derivedLevels: AggregationLevel[] = Object.entries(config.derivedRegionTypes).map(
    ([regionType, derived]) => ({
      regionType,
      level: derived.level,
      label: derived.label,
      minZoom: derived.minZoom ?? config.map.minZoom,
      maxZoom: derived.maxZoom ?? config.map.maxZoom,
      derived: true
    })
  );

  // Ties broken by region type so the order is stable whatever the object key order was.
  return [...geoLevels, ...derivedLevels].sort(
    (a, b) => a.level - b.level || a.regionType.localeCompare(b.regionType)
  );
};

/**
 * Region type a country falls back to when nothing has been selected. Matches
 * `NATIONAL_REGION_TYPE` in `hooks/data/scope.ts`, duplicated rather than imported so this
 * module stays free of the data layer (`countryState.ts` imports it during global state
 * initialisation, before any hook can run).
 */
const NATIONAL = "national";

/**
 * The level a country starts on: its **finest non-derived** level.
 *
 * Finest because that is the level the map is useful at — GB's `gsp`, NL's `province` — and
 * it is what the GB-shaped `NationalAggregation.GSP` default meant before the enum went.
 * Non-derived because a derived level is a client-side rollup whose values depend on a
 * grouping file that may not have loaded, and because "the API serves this directly" is the
 * safer starting state; GB's `dno`/`zone` sit between national and gsp on the manifest's
 * sparse scale and must never win the default even though `zone` sorts finer than `dno`.
 *
 * Takes an already-derived list so the gating rules (registry `geo` block, manifest labels,
 * fallbacks) live in `deriveAggregationLevels` alone.
 */
export const defaultLevelOf = (levels: AggregationLevel[]): AggregationLevel | undefined => {
  const candidates = levels.filter((level) => !level.derived);
  return candidates[candidates.length - 1];
};

/**
 * The region type name `nationalAggregationLevel` defaults to for a country.
 *
 * `"national"` for a country whose registry entry has no sub-national `geo` entry, and for a
 * country with no registry entry at all: there is no level to name, and every consumer can
 * cope with the whole-country view. Deliberately a name and not an `AggregationLevel` —
 * the stored state is a name, and this is resolvable synchronously without the manifest.
 */
export const defaultAggregationLevel = (
  config: CountryConfig | undefined,
  regionTypes: RegionTypeCapability[] = []
): string => defaultLevelOf(deriveAggregationLevels(config, regionTypes))?.regionType ?? NATIONAL;

/**
 * The region type whose *data* backs a level — which is not always the level's own name.
 *
 * A derived level (GB's DNO and NG-zone rollups) has no regions of its own on the API: it is
 * groups of some finer type's regions, and the registry's `derivedRegionTypes` names which.
 * A non-derived level is its own source. `null` for `national` and for an unresolved level,
 * both of which mean "no sub-national request to make".
 *
 * Shared because getting it wrong is a 400, not a wrong number: the selected-region chart
 * hardcoded `"gsp"` here, so clicking an NL province asked the API for a GSP region type that
 * does not exist in NL. Country-specific facts come from the registry, never from a constant.
 */
export const valueRegionTypeFor = (
  level: AggregationLevel | undefined,
  config: CountryConfig | undefined
): string | null => {
  if (!level) return null;
  const regionType = level.derived
    ? config?.derivedRegionTypes[level.regionType]?.source
    : level.regionType;
  if (!regionType || regionType === NATIONAL) return null;
  return regionType;
};
