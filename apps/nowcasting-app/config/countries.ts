// The static half of a country's configuration.
//
// The split is deliberate and the rule is one-way: anything `GET /countries` can tell us
// (display name, capacity, centroid, region types, hierarchy levels, forecast models,
// generation observers) is read from the manifest at runtime and must never appear here.
// What lands here is only what the API cannot know — the viewer's timezone and locale, the
// map's default view, where the boundary assets live, which client-side groupings exist,
// and which Auth0 role grants access.
//
// Adding a country should be one entry in `COUNTRY_CONFIG` plus its geo assets. That is the
// property Phase 6 (Germany) is a test of, so resist putting anything country-conditional
// anywhere else.

/**
 * How a region name from the API is transformed before it is matched against the GeoJSON
 * feature property. GB v1 region names are lowercase codes (`citr_1`, and pipe-joined
 * composites like `actl_2|cbnk_h`) while `properties.GSPs` spells the same scheme in
 * uppercase, so a plain case fold matches 345/349 features whole-string — no pipe-splitting
 * and no fuzzy matching (verified against the live API, 2026-08-04).
 */
export type GeoJoinTransform = "lowercase" | "uppercase" | "none";

/**
 * Boundary geometry for one region type. `url` is a declaration, not a promise that the
 * file exists yet — Phase 5 moves the boundaries under `public/geo/{country}/`; until then
 * these paths 404 and nothing fetches them.
 */
export type GeoLayerConfig = {
  url: string;
  /** GeoJSON feature property carrying the region key. */
  joinProperty: string;
  joinTransform?: GeoJoinTransform;
  /** Map zoom band this region type occupies. See `minZoom`/`maxZoom` note below. */
  minZoom?: number;
  maxZoom?: number;
};

/**
 * A region type the API does not model, synthesised client-side by grouping members of a
 * real one. GB's DNO and NG-zone levels are the only instances; v1 offers `national`,
 * `gsp` and `province` and nothing else. Keeping them here rather than in the generic
 * layer is what stops the GB grid hierarchy leaking back into the shared model.
 */
export type DerivedRegionTypeConfig = {
  /** Region type whose regions are grouped, e.g. `"gsp"`. */
  source: string;
  /** Name-keyed grouping file (regenerated from gsp_id in Phase 5). */
  groupings: string;
  label: string;
  /**
   * Hierarchy depth on the manifest's scale. `level` is sparse there by design — 0 for
   * national, 10 for gsp/province — precisely to leave room for these in between.
   */
  level: number;
  minZoom?: number;
  maxZoom?: number;
};

export type MapDefaults = {
  center: { lng: number; lat: number };
  zoom: number;
  minZoom: number;
  maxZoom: number;
};

/** A non-data map layer, e.g. GB's network constraints. */
export type OverlayConfig = {
  id: string;
  url: string;
  label?: string;
};

export type CountryConfig = {
  /** ISO code as the API spells it, uppercase. Matches `CountryCapability.code`. */
  code: string;
  /** IANA zone. Replaces the `Europe/London` hardcoded through every date helper. */
  timezone: string;
  /** BCP-47 tag for number and date formatting at the render boundary. */
  locale: string;
  map: MapDefaults;
  /** Keyed by region type as the manifest spells it. */
  geo: Record<string, GeoLayerConfig>;
  /** Keyed by the synthetic region type name. Empty for countries with no groupings. */
  derivedRegionTypes: Record<string, DerivedRegionTypeConfig>;
  overlays: OverlayConfig[];
  /** Seasonal norm dataset, or `null` where one has not been produced. */
  seasonalNorms: string | null;
  /** Auth0 role id granting this country; the country claim is derived from these. */
  auth0Role: string;
};

// The zoom bands below mirror `AGGREGATION_LEVEL_MIN_ZOOM`/`MAX_ZOOM` in `constant.ts`,
// which are GB-shaped enums. They are duplicated rather than imported because the enums
// are keyed by GB aggregation level (NATIONAL/REGION/GSP/SITE) and are due to be replaced
// by a country-derived `{ regionType, level, label, minZoom, maxZoom }` list built from
// this registry plus the manifest. Deriving that list is a later agent's job; expressing
// the bands per region type here is what makes it possible.
export const COUNTRY_CONFIG: Record<string, CountryConfig> = {
  GB: {
    code: "GB",
    timezone: "Europe/London",
    locale: "en-GB",
    // The centre and zoom currently hardcoded in `globalState.tsx`'s initial state.
    map: {
      center: { lng: -2.3175601, lat: 54.70534432 },
      zoom: 5,
      minZoom: 0,
      maxZoom: 14
    },
    geo: {
      national: {
        url: "/geo/gb/national.json",
        joinProperty: "name",
        minZoom: 0,
        maxZoom: 5
      },
      gsp: {
        url: "/geo/gb/gsp.json",
        joinProperty: "GSPs",
        joinTransform: "lowercase",
        minZoom: 7,
        maxZoom: 8.5
      }
    },
    derivedRegionTypes: {
      dno: {
        source: "gsp",
        groupings: "/geo/gb/dno-groupings.json",
        label: "DNO",
        level: 5,
        minZoom: 5,
        maxZoom: 7
      },
      zone: {
        source: "gsp",
        groupings: "/geo/gb/zone-groupings.json",
        label: "Zone",
        level: 6,
        minZoom: 5,
        maxZoom: 7
      }
    },
    overlays: [{ id: "constraints", url: "/geo/gb/ng-constraints.json", label: "Constraints" }],
    seasonalNorms: "/data/gb/national-metrics.json",
    auth0Role: "GB_ROLE_ID"
  },
  NL: {
    code: "NL",
    timezone: "Europe/Amsterdam",
    locale: "nl-NL",
    // Centred on the manifest's NL centroid (52.13, 5.29) at a zoom that fits the whole
    // country — NL is roughly a quarter of GB's span, hence the tighter default.
    map: {
      center: { lng: 5.29, lat: 52.13 },
      zoom: 6.5,
      minZoom: 0,
      maxZoom: 14
    },
    geo: {
      national: {
        url: "/geo/nl/national.json",
        joinProperty: "name",
        minZoom: 0,
        maxZoom: 6
      },
      province: {
        url: "/geo/nl/province.json",
        joinProperty: "name",
        joinTransform: "lowercase",
        minZoom: 6,
        maxZoom: 14
      }
    },
    // No client-side groupings: the API's province level is the only sub-national one NL
    // has, and `ned_nl` is its single generation observer.
    derivedRegionTypes: {},
    overlays: [],
    seasonalNorms: null,
    auth0Role: "NL_ROLE_ID"
  }
};

/**
 * Registry lookup, case-insensitive on the code.
 *
 * Returns `undefined` rather than throwing or falling back to GB: `/countries` returns
 * *all* countries by design (so prospects can see what exists), so the manifest can legally
 * name a country this build has no entry for. That country must stay discoverable — listed,
 * flagged as unconfigured — not crash the app.
 */
export const getCountryConfig = (code: string | null | undefined): CountryConfig | undefined => {
  if (typeof code !== "string") return undefined;
  return COUNTRY_CONFIG[code.toUpperCase()];
};

/** Codes this build carries configuration for. Not the same as the entitled set. */
export const configuredCountryCodes = (): string[] => Object.keys(COUNTRY_CONFIG);
