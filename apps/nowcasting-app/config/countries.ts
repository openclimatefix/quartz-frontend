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
  /**
   * Display label, overriding the manifest's for this country's region type.
   *
   * The manifest is normally authoritative for labels, and countries that want its wording
   * simply omit this. It exists because a label is a *product* decision the API cannot make:
   * GB says "GSP" throughout, where the manifest spells the type "Grid Supply Point".
   *
   * Being registry-side also makes it available synchronously. A label taken from the
   * manifest cannot render until the manifest loads, so a control that shows one flashes the
   * `fallbackLabel` derivation first ("Gsp") and then swaps — which is what this avoids.
   */
  label?: string;
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
  /**
   * Boundary geometry for the derived level's own polygons.
   *
   * Required, not optional: a derived level with a grouping file and no polygons to draw it
   * on cannot be rendered, so the type refuses to express one. GB's DNO and NG-zone shapes
   * had nowhere to be declared before Phase 5 — they were `require`d straight into the
   * bundle from `data/` — which is why this field arrives with the assets rather than with
   * the registry.
   */
  geometry: GeoLayerConfig;
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

/**
 * One forecast line on the national chart.
 *
 * `key` is the `ChartData` key the series is written under, which is also the `dataKey` the
 * `<Line>`s in `remix-line.tsx` and the legend items in `ChartLegend.tsx` bind to. `model` is
 * the v1 model name, or `null` to send no `model` parameter at all and let the API apply the
 * region type's default (see "No hook defaults model from the manifest" in the contract).
 *
 * This is a **curated** list, deliberately not derived from the manifest: GB's national region
 * type offers 12 models and the chart shows six chosen ones, in a chosen order, with chosen
 * colours. Deriving it would put every model on the chart.
 */
export type ForecastSeriesConfig = {
  /** `ChartData` key, e.g. `"FORECAST"`, `"SAT_ONLY"`. */
  key: string;
  /** v1 model name without the `_adjust` suffix, or `null` for the region type's default. */
  model: string | null;
  /** Human label — the legend and tooltip text for this line. */
  label: string;
  /**
   * Legend presentation. Omitted for a series that is fetched and charted but has no legend
   * entry of its own — which is the case today for the two PVNet comparison series, exactly
   * as it was before this migration.
   *
   * The primary series (the first entry) also omits it: its legend entry is fixed, because it
   * is rendered twice at different breakpoints with different copy.
   */
  legend?: {
    /** Tailwind text colour, matching this line's stroke in `remix-line.tsx`. */
    iconClasses: string;
    /** Weather inputs ticked in the legend tooltip. */
    tooltipInputs: ForecastInput[];
  };
};

/** The weather inputs a forecast model can consume. Mirrors `DataInput` in the legend tooltip. */
export type ForecastInput = "ECMWF" | "MET_OFFICE" | "SAT";

/**
 * Appended to every `ForecastSeriesConfig.model` below. **This is the one-line swap.**
 *
 * v0 asked for trend adjustment with `trend_adjuster_on=true` alongside a plain model name.
 * v1 has no such parameter: it currently exposes the adjusted variants as separate models
 * (`blend_adjust`, `pvnet_ukv_adjust`, …). Brad's instruction is to run on the NON-adjusted
 * models for now, because the API is about to change again — an `adjust` boolean like v0's,
 * plus simplified model names — and amend once that settles.
 *
 * **Consequence, expected and agreed:** production is trend-adjusted and this is not, so the
 * national chart's values will not match production. That is not a regression to chase.
 *
 * To move the whole chart onto the adjusted models today, set this to `"_adjust"`. When the
 * `adjust` boolean lands, delete this and add the flag to the forecast window instead.
 */
export const NATIONAL_FORECAST_MODEL_SUFFIX = "";

/** The model name to send for a series, i.e. `series.model` plus the suffix above. */
export const forecastSeriesModel = (series: ForecastSeriesConfig): string | undefined =>
  series.model === null ? undefined : `${series.model}${NATIONAL_FORECAST_MODEL_SUFFIX}`;

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
  /**
   * The forecast lines the national chart draws, in the order they are fetched and merged.
   *
   * The first entry is the primary series: it writes `FORECAST`/`PAST_FORECAST` and is the
   * one the p-level bands, the header numbers and the staleness indicator are taken from.
   * Everything after it is a comparison model.
   *
   * The observed-generation lines are NOT here — they come from `useGenerationSources(scope)`
   * at runtime, because observers are a manifest fact (GB has two, NL has one).
   */
  nationalChartSeries: ForecastSeriesConfig[];
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
        // Brad's call: GB reads "GSP" throughout, not the manifest's "Grid Supply Point".
        label: "GSP",
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
        // The 14 licence-area polygons carry `LongName` ("UKPN (East)"), which is spelled
        // exactly as `dno-groupings.json` keys its groups — hence no transform. The
        // adjacent `Name` field is the single-letter GSP-group code (`_A`) and joins
        // nothing.
        geometry: { url: "/geo/gb/dno.json", joinProperty: "LongName" },
        minZoom: 5,
        maxZoom: 7
      },
      zone: {
        source: "gsp",
        groupings: "/geo/gb/zone-groupings.json",
        label: "Zone",
        level: 6,
        // 19 NG zones keyed on `id` ("NE Scotland"), again matching the grouping keys
        // verbatim. Both grouping files key on the human-readable name because they predate
        // v1 entirely; only their *values* were numeric gsp_ids, and Phase 5 re-keyed those.
        geometry: { url: "/geo/gb/zone.json", joinProperty: "id" },
        minZoom: 5,
        maxZoom: 7
      }
    },
    // The six lines the GB chart drew under v0, in the same order, with the v1 model names.
    //
    //   v0 (+ trend_adjuster_on=true)        v1
    //   blend                             -> blend
    //   pvnet_intraday_ecmwf_only         -> pvnet_ecmwf
    //   pvnet_day_ahead                   -> pvnet_day_ahead
    //   pvnet_intraday                    -> pvnet_intraday
    //   pvnet_intraday_met_office_only    -> pvnet_ukv     (UNCONFIRMED inference: the
    //       manifest labels `pvnet_ukv` "PVNet Intraday (Met Office)" and UKV is the Met
    //       Office's model, but no one has confirmed it is the same series v0 served.)
    //   pvnet_intraday_sat_only           -> pvnet_sat
    //
    // See NATIONAL_FORECAST_MODEL_SUFFIX above for the `_adjust` situation.
    nationalChartSeries: [
      { key: "FORECAST", model: "blend", label: "Current" },
      {
        key: "INTRADAY_ECMWF_ONLY",
        model: "pvnet_ecmwf",
        label: "ECMWF-only",
        legend: { iconClasses: "text-ocf-teal-500", tooltipInputs: ["ECMWF"] }
      },
      { key: "PVNET_DAY_AHEAD", model: "pvnet_day_ahead", label: "PVNet Day Ahead" },
      { key: "PVNET_INTRADAY", model: "pvnet_intraday", label: "PVNet Intraday" },
      {
        key: "MET_OFFICE_ONLY",
        model: "pvnet_ukv",
        label: "Met Office-only",
        legend: { iconClasses: "text-metOffice", tooltipInputs: ["MET_OFFICE"] }
      },
      {
        key: "SAT_ONLY",
        model: "pvnet_sat",
        label: "Satellite-only",
        legend: { iconClasses: "text-ocf-yellow-200", tooltipInputs: ["SAT"] }
      }
    ],
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
    // NL national offers `blend` and `ecmwf_mo_sat_uncurtailed` (each with an `_adjust`
    // twin). Only the blend is charted: the second is the blend's single input, so drawing
    // both would be a comparison of a series against itself. Nobody has asked for the NL
    // comparison lines GB has; add them here when they do.
    nationalChartSeries: [{ key: "FORECAST", model: "blend", label: "Current" }],
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
