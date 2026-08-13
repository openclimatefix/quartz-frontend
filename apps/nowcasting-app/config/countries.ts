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
//
// **We do not discriminate between countries in code.** A country is added by configuration
// and displayed from configuration plus the manifest — no `if (country === "DE")`, no
// per-country component, no per-country branch in a hook, no country name in a `switch`.
//
// Country-specific *config* is the sanctioned lever and belongs here: `geo.gsp.label` is
// GB-only and entirely correct, because it is declared data — visible in review, inert for
// every other country. The line is declared data versus executed branching. If something
// cannot be expressed as a field in this file, that is the signal the abstraction is too
// narrow: widen the config rather than special-casing the country at the call site.

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

/**
 * The five MW thresholds the map's six opacity bands step at.
 *
 * A tuple, not `number[]`, because the band count is fixed by `BAND_OPACITIES` in
 * `components/map/feature-state.ts` (six opacities, five boundaries between them) and the
 * legend draws one pill per band. A country that supplied four or six would produce a map and
 * a legend that quietly disagreed about which band a value is in, which is exactly the class
 * of failure this whole field exists to remove. The type refuses it instead.
 */
export type MapBandThresholds = readonly [number, number, number, number, number];

/**
 * How much power makes a region dark, per country.
 *
 * These used to be two constants in `feature-state.ts` (`MW_THRESHOLDS_GSP`,
 * `MW_THRESHOLDS_GROUPED`) applied to every country, and they were calibrated to GB: a single
 * GSP tops out around 450 MW, a DNO/zone grouping around 4.5 GW. Since Phase 6 Track F the map
 * draws every enabled country at once, so NL's provinces were banded on GB's GSP scale — a
 * province producing 1.3 GW normally landed in the same top band as everything else and the
 * whole country rendered flat, reading as "producing almost nothing". Percentage mode was
 * unaffected, because a fraction of capacity is genuinely country-agnostic.
 *
 * Two tiers, because a country can be shown at two magnitudes:
 *
 *  - `region` — one region as the API serves it (a GB GSP, an NL province).
 *  - `grouped` — a client-side rollup of many of them (GB's DNO and NG-zone levels), or
 *    `null` for a country with no `derivedRegionTypes`.
 *
 * `null` rather than an omitted field, and rather than falling back to `region`: a country
 * without a grouped tier can never have a grouped feature on the map (the flag comes from
 * `AggregationLevel.derived`, and the levels come from this same registry), so the honest
 * value is "there is no such thing here". Writing it explicitly is what stops the next country
 * silently inheriting GB's 4.5 GW ceiling the way NL inherited its 450 MW one.
 *
 * MW mode and capacity mode share one scale, as they always have — installed capacity and
 * instantaneous output are both megawatts of the same region, and a scale that reads well for
 * one reads well for the other.
 */
export type MapBandsConfig = {
  /** Thresholds for one API-served region. */
  region: MapBandThresholds;
  /** Thresholds for a client-side grouping, or `null` where the country has none. */
  grouped: MapBandThresholds | null;
};

export type MapDefaults = {
  center: { lng: number; lat: number };
  zoom: number;
  minZoom: number;
  maxZoom: number;
  /**
   * The country's extent, `[west, south, east, north]`, for framing the *enabled set*.
   *
   * `center`/`zoom` frame one country and cannot be combined: two countries' centres average
   * to a point in the sea at a zoom that fits neither. A bounding box unions, so the camera
   * can fit whatever the user has enabled.
   *
   * Config rather than computed from the geometry, because the geometry is fetched on demand
   * (Phase 5) and the camera should not wait on ~9 MB of boundaries to know where a country
   * is. Approximate on purpose: it frames a view, it never decides what is drawn or joined.
   */
  bounds: [number, number, number, number];
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

/**
 * Whether a timestamp names the end or the start of the period it covers.
 *
 * GB labels period-end, following PV_Live — a slot labelled 16:00 covers 15:30–16:00, which
 * is what `ChartInfo.tsx`'s legend tooltip tells users. It is a per-country convention rather
 * than a universal one, and it decides which way `lib/time/cursor.ts` rounds the shared
 * cursor onto a country's grid: period-end rounds up, period-start rounds down. Getting it
 * wrong is off by a whole period and looks entirely plausible on screen, so it is declared
 * here rather than assumed at the call site.
 */
export type SlotLabelling = "period-end" | "period-start";

export type CountryConfig = {
  /** ISO code as the API spells it, uppercase. Matches `CountryCapability.code`. */
  code: string;
  /** IANA zone. Replaces the `Europe/London` hardcoded through every date helper. */
  timezone: string;
  /**
   * Minutes between the country's published values — its step on the time axis.
   *
   * A per-country fact, not an app-wide constant: GB publishes every 30 minutes, NL every 15
   * (`lib/api/v1/__fixtures__/gb-gsp-forecasts-period.json`,
   * `nl-province-forecasts-period.json`). The shared cursor runs on the *finest* enabled
   * country's cadence and each country resolves it to its own slot; see `lib/time/cursor.ts`.
   *
   * **Must divide 60.** The grid is anchored to the UTC hour, so a cadence that does not
   * divide an hour would drift across the day. Pinned in `cursor.test.ts`.
   */
  cadenceMinutes: number;
  /** See `SlotLabelling`. Decides which way the cursor rounds onto this country's grid. */
  slotLabelling: SlotLabelling;
  /** BCP-47 tag for number and date formatting at the render boundary. */
  locale: string;
  map: MapDefaults;
  /** The map's opacity bands, in MW. See `MapBandsConfig`. */
  mapBands: MapBandsConfig;
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
    cadenceMinutes: 30,
    // The settlement period, and PV_Live's convention: 16:00 covers 15:30-16:00. Stated to
    // users in `ChartInfo.tsx`'s legend tooltip.
    slotLabelling: "period-end",
    // The centre and zoom currently hardcoded in `globalState.tsx`'s initial state.
    map: {
      center: { lng: -2.3175601, lat: 54.70534432 },
      zoom: 5,
      minZoom: 0,
      maxZoom: 14,
      // Mainland GB plus the Northern Isles; excludes NI, which the GSP set does not cover.
      bounds: [-8.65, 49.86, 1.77, 60.86]
    },
    // Unchanged from the constants these replaced, so the GB map looks exactly as it did.
    // For the record of how they were arrived at (`lib/api/v1/__fixtures__/gb-regions-gsp.json`,
    // 338 GSPs, 22.6 GW installed): the largest GSP carries 654 MW and the 99th percentile
    // 507 MW, so a 450 MW top band saturates the handful of biggest GSPs at midday and the
    // steps below it spread the rest. The grouped set is exactly ten times the region set.
    mapBands: {
      region: [50, 150, 250, 350, 450],
      grouped: [500, 1500, 2500, 3500, 4500]
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
    cadenceMinutes: 15,
    // **UNCONFIRMED** — assumed to match GB because that is what the old single-cadence code
    // did everywhere, so this is the no-change answer rather than a finding. Nobody has
    // confirmed that NED publishes period-end, and if it publishes period-start every NL
    // lookup is one 15-minute slot out: plausible on screen, wrong. Flip this one field when
    // it is confirmed either way — that is the whole change.
    slotLabelling: "period-end",
    // Centred on the manifest's NL centroid (52.13, 5.29) at a zoom that fits the whole
    // country — NL is roughly a quarter of GB's span, hence the tighter default.
    map: {
      center: { lng: 5.29, lat: 52.13 },
      zoom: 6.5,
      minZoom: 0,
      maxZoom: 14,
      // Mainland NL; excludes the Caribbean municipalities, which carry no solar regions.
      bounds: [3.31, 50.75, 7.23, 53.56]
    },
    // GB's region bands times eight, which is the ratio between the two countries' largest
    // single regions. NL has 12 provinces holding 25.1 GW (more than GB's 22.6 GW over 338
    // GSPs), so a province is a DNO-sized object, not a GSP-sized one.
    //
    // Derivation, from `lib/api/v1/__fixtures__/nl-regions-province.json` and
    // `nl-province-forecasts-period.json`:
    //   - Installed capacity per province runs 943 MW (Zeeland) to 4,437 MW (Noord-Brabant).
    //   - Peak output in the recorded day is ~0.8 x capacity (Noord-Brabant 3,654 MW,
    //     Drenthe 1,313 MW, Zeeland 753 MW), so the biggest province peaks near 3.6 GW.
    //   - 3,600 / 450 = 8, so the whole GB shape scales by 8 and keeps its proportions:
    //     the top band saturates the largest province at midday, and the twelve provinces'
    //     midday values spread across bands two to five rather than piling into one.
    // Capacity mode uses the same numbers: 943-4,437 MW also spans these bands sensibly.
    //
    // The ratio is the claim here, not five hand-picked numbers — if NL's installed base
    // grows, rescale from the largest province's peak the same way.
    mapBands: {
      region: [400, 1200, 2000, 2800, 3600],
      // No `derivedRegionTypes`, so no grouped tier can ever be asked for. Explicitly absent
      // rather than inherited: see `MapBandsConfig`.
      grouped: null
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

/**
 * The order countries are listed in, everywhere they are listed.
 *
 * One rule for the header toggle, the chart's country picker and the footer's zone stack.
 * Before this they had three: the header took the manifest's order, the picker took the order
 * the user happened to enable them in — so it *reordered as you used it* — and the footer
 * sorted by UTC offset. Three surfaces, three answers, on the same screen.
 *
 * The registry's declaration order is the source, so the answer is stable, reviewable in one
 * file, and does not move when a user toggles something or when the API changes what it
 * returns. It reads west to east today (GB, then NL), and it should stay that way as countries
 * are added — but the *order in this file* is what decides, not the offsets: a rule derived
 * from offsets silently reorders itself twice a year at DST, which is not something a
 * navigation control should do.
 *
 * Codes with no registry entry sort last, alphabetically. The header lists every country the
 * API serves — including ones this build cannot draw — so that case is real, not defensive.
 */
const REGISTRY_ORDER = Object.keys(COUNTRY_CONFIG);

export const countryOrderIndex = (code: string | null | undefined): number => {
  const index = REGISTRY_ORDER.indexOf((code ?? "").toUpperCase());
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
};

/** `codes` in registry order, unconfigured ones last. Does not mutate the input. */
export const sortCountryCodes = <T>(items: readonly T[], codeOf: (item: T) => string): T[] =>
  [...items].sort((a, b) => {
    const byRegistry = countryOrderIndex(codeOf(a)) - countryOrderIndex(codeOf(b));
    return byRegistry !== 0 ? byRegistry : codeOf(a).localeCompare(codeOf(b));
  });
