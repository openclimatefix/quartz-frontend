import type { CountryConfig } from "../../config/countries";
import type { RegionTypeCapability } from "../../lib/domain/types";

// The country-derived replacement for the GB-shaped aggregation enums.
//
// `AGGREGATION_LEVELS` / `AGGREGATION_LEVEL_MIN_ZOOM` (constant.ts) and
// `NationalAggregation` (components/map/types.ts) hardcode one country's grid hierarchy —
// NATIONAL / REGION / GSP / SITE, and GSP / Zone / DNO / National — as enums. NL has
// provinces and no GSPs; DE will have something else again. The hierarchy therefore has to
// be *derived* per country, from the two places that actually know it: the static registry
// (which region types have boundaries, and at what zoom) and the manifest (hierarchy depth
// and display label).
//
// Those enums survive for now as a GB-derived shim — see the comments on them — because
// they have ~100 call sites. This list is the source of truth; Phase 4 deletes the enums as
// it rewrites their consumers.

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
 * the display label — the two things it is authoritative for. Derived region types
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
      label: manifest?.label ?? fallbackLabel(regionType),
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
