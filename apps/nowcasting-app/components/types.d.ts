import { DELTA_BUCKET } from "../constant";
import type { NationalEndpointKeysType, SitesEndpointKeysType } from "./endpoint-labels";

// `NationalEndpointLabel` and `SitesEndpointLabel` used to be declared here as `export enum`.
// They are values, and a value exported from a `.d.ts` is `undefined` at runtime — see
// `./endpoint-labels.ts`, which now owns them.
export type { NationalEndpointKeysType, SitesEndpointKeysType } from "./endpoint-labels";

export type LoadingState<T> = {
  initialLoadComplete: boolean;
  showMessage: boolean;
  message: string;
  endpointStates?: T;
};
export type NationalEndpointStates = {
  type: "national";
} & {
  [key in NationalEndpointKeysType]: EndpointState;
};
export type SitesEndpointStates = {
  type: "sites";
} & {
  [key in SitesEndpointKeysType]: EndpointState;
};
export type EndpointState = {
  loading: boolean;
  validating: boolean;
  error: any;
  hasData: boolean;
};
export type FcAllResData = {
  type?: "FeatureCollection";
  forecasts: {
    location: {
      label: string;
      gspId: number;
      gspName: string;
      gspGroup: string;
      regionName: string;
      installedCapacityMw: number;
      rmMode: true;
    };
    model: {
      name: string;
      version: string;
    };
    forecastCreationTime: string;
    forecastValues: ForecastValue[];
    inputDataLastUpdated: {
      gsp: string;
      nwp: string;
      pv: string;
      satellite: string;
    };
  }[];
};
export type ForecastValue = {
  targetTime: string;
  expectedPowerGenerationMegawatts: number;
  expectedPowerGenerationNormalized?: number | null;
  plevels?: {
    plevel_2?: number;
    plevel_10?: number;
    plevel_25?: number;
    plevel_75?: number;
    plevel_90?: number;
    plevel_98?: number;
  };
};
export type ForecastData = ForecastValue[];

export type PvRealData = {
  datetimeUtc: string;
  solarGenerationKw: number;
}[];
// `CombinedData`, `CombinedLoading`, `CombinedValidating` and `CombinedErrors` used to sit
// here: four parallel god-objects assembled in `pages/index.tsx` and threaded through every
// view. They dissolved key by key as each view moved onto `hooks/data/*` and are gone as of
// Phase 4 wave 4, along with `AllGspRealData`/`GspAllForecastData`/`NationalNHourData` and this
// file's dependency on `types/quartz-api`. The sites equivalents below survive: sites are
// Phase 5 and still on v0.
export type SitesCombinedLoading = {
  allSitesLoading: boolean;
  sitePvForecastLoading: boolean;
  sitePvActualLoading: boolean;
};
export type SitesCombinedValidating = {
  allSitesValidating: boolean;
  sitePvForecastValidating: boolean;
  sitePvActualValidating: boolean;
};
export type SitesCombinedErrors = {
  allSitesError: any;
  sitesPvForecastError: any;
  sitesPvActualError: any;
};
export type GspDeltaValue = {
  /**
   * The id the *map* knows this region by, and what a selection is made of — a GB GSP's
   * numeric `gsp_id` as a string, an NL province's region name.
   *
   * This exists because `gspId` below is GB-only. The delta table used to key and select on
   * `gspId`, so every region without one — every NL province — was dropped before it reached
   * the table, and the delta view listed nothing for NL while colouring it correctly on the
   * map.
   */
  regionId: string;
  /**
   * GB's numeric GSP id, absent for a country whose regions have none. Kept because the CSV
   * export and the GB-only region bridge still speak it; nothing new should depend on it.
   */
  gspId?: number;
  gspRegion: string;
  gspInstalledCapacity: number;
  currentYield: number;
  forecast: number;
  delta: number;
  deltaBucket: DELTA_BUCKET;
  deltaBucketKey: string;
  deltaColor: string;
  dataKey: string;
  deltaPercentage: string;
  deltaNormalized: string;
};

/**
 * One product's status from the Status API (`GET /products`), spec v0.2.0.
 *
 * `ProductStatusValue` is `ok | info | warning | error | unknown`. `info` means a
 * deliberate, non-degraded notice — planned maintenance, a heads-up — and is distinct from
 * `unknown`, which means no signal at all. See `normaliseLevel` in
 * components/hooks/useStatus.ts for how an unrecognised level is handled.
 */
export type StatusLevel = "ok" | "info" | "warning" | "error" | "unknown";

export type ProductStatus = {
  /** Product key, e.g. `"gb-solar"`. Permanent identifier. See config/statusProducts.ts. */
  key: string;
  /** The API's own display name, used as the label fallback for an unregistered product. */
  name: string;
  status: StatusLevel;
  /** Nullable per the spec — a product can carry a status with nothing to say about it. */
  message: string | null;
  /** How the status was set, e.g. `"manual"`. */
  source: string;
  /**
   * ISO-8601, nullable. Doubles as the incident identity for dismissal, which is why
   * useDismissedStatuses needs a fallback for the null case rather than keying on it raw.
   *
   * Not to be confused with history's `setAt`: a status row is updated in place, whereas a
   * history row records a status being set. The two names differ deliberately.
   */
  updatedAt: string | null;
};

export type ProductsResponse = {
  /** Worst-of rollup across products. Unused today — each row is rendered on its own level. */
  status: StatusLevel;
  products: ProductStatus[];
  /** Most recent `updatedAt` across products, or null when none has ever been stamped. */
  lastUpdated: string | null;
};

export type Bucket = {
  dataKey: string;
  quantity: number;
  text: string;
  bucketColor: string;
  borderColor: string;
  lowerBound: number;
  upperBound: number;
  increment: number;
  textColor: string;
  altTextColor: string;
  gspDeltas?: Map<string, GspDeltaValue>;
};

// Sites
export type Site = {
  site_uuid: string;
  client_name: string;
  client_site_id: string;
  client_site_name: string;
  region: string;
  dno: string;
  gsp: string;
  orientation: string;
  tilt: string;
  latitude: number;
  longitude: number;
  inverter_capacity_kw: number;
  module_capacity_kw: number;
};

export type AllSites = {
  site_list: Site[];
};

export type SiteForecastValue = {
  target_datetime_utc: string;
  expected_generation_kw: number;
};

export type SitePvActualValue = {
  datetime_utc: string;
  actual_generation_kw: number;
};

export type SitePvForecast = {
  forecast_uuid: string;
  site_uuid: string;
  forecast_creation_datetime: string;
  forecast_version: string;
  forecast_values: SiteForecastValue[];
};

export type SitesPvForecast = SitePvForecast[];

export type SitePvActual = {
  site_uuid: string;
  pv_actual_values: SitePvActualValue[];
};
export type SitesPvActual = SitePvActual[];

export type CombinedSitesData = {
  allSitesData: Site[] | undefined;
  sitesPvForecastData: SitePvForecast[];
  sitesPvActualData: SitePvActual[];
};
export type SiteData = {
  label: string;
  capacity: number;
  actualPV: number;
  expectedPV: number;
  aggregatedYield: number;
};

// Common object type across Sites, GSPs, Regions and National
export type AggregatedSitesDatum = {
  id: string;
  label: string;
  capacity: number;
  actualPV: number;
  expectedPV: number;
  aggregatedYield: number;
  lat: number;
  lng: number;
};

export type AggregatedSitesDataGroupMap = Map<string, AggregatedSitesDatum>;

export type AggregatedSitesCombinedData = {
  sites: AggregatedSitesDataGroupMap;
  regions: AggregatedSitesDataGroupMap;
  gsps: AggregatedSitesDataGroupMap;
  national: AggregatedSitesDataGroupMap;
};

export type MapFeatureObject = {
  properties: {
    expectedPowerGenerationMegawatts: number | undefined;
    expectedPowerGenerationMegawattsRounded: number | undefined;
    expectedPowerGenerationNormalized: number | undefined;
    expectedPowerGenerationNormalizedRounded: number | undefined;
    actualPowerGenerationMegawatts: number | undefined;
    delta?: number;
    deltaBucket?: number;
    installedCapacityMw: number;
    gspDisplayName: string;
  };
  type: "Feature";
  geometry: Geometry;
  id?: string | number | undefined;
  bbox?: BBox | undefined;
};

export type GspZoneGroupings = {
  [key]: number[];
};
