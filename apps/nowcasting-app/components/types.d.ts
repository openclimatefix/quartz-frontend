import { DELTA_BUCKET } from "../constant";
import { components } from "../types/quartz-api";

export type LoadingState<T> = {
  initialLoadComplete: boolean;
  showMessage: boolean;
  message: string;
  endpointStates?: T;
};
export enum NationalEndpointLabel {
  nationalForecast = "National Forecast",
  pvRealDayIn = "PV Live Estimate",
  pvRealDayAfter = "PV Live Updated",
  nationalNHour = "N-hour forecast",
  allGspForecast = "All GSP Forecast",
  allGspReal = "All GSP PV Live"
}
export type NationalEndpointKeysType = keyof typeof NationalEndpointLabel;

export enum SitesEndpointLabel {
  allSites = "All Sites",
  sitePvForecast = "Site PV Forecast",
  sitePvActual = "Site PV Actual"
}
export type SitesEndpointKeysType = keyof typeof SitesEndpointLabel;
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
type ForecastValue = {
  targetTime: string;
  expectedPowerGenerationMegawatts: number;
  expectedPowerGenerationNormalized?: number | null;
  plevels?: {
    plevel_10: number;
    plevel_90: number;
  };
};

type ForecastData = ForecastValue[];

type PvRealData = {
  datetimeUtc: string;
  solarGenerationKw: number;
}[];
type NationalNHourData = ForecastValue[];
type AllGspRealData = GspRealData[];
type CombinedData = {
  nationalForecastData: ForecastData | undefined;
  pvRealDayInData: PvRealData | undefined;
  pvRealDayAfterData: PvRealData | undefined;
  nationalNHourData: NationalNHourData | undefined;
  allGspSystemData: components["schemas"]["Location"][] | undefined;
  // TODO: slight mashup of custom and generated types atm,
  //  ideally should be able to use just the generated for API typings
  allGspForecastData:
    | GspAllForecastData
    | components["schemas"]["OneDatetimeManyForecastValues"][]
    | undefined;
  allGspRealData: AllGspRealData | components["schemas"]["GSPYieldGroupByDatetime"][] | undefined;
  gspDeltas: Map<string, GspDeltaValue> | undefined;
  nlForecastData?: SitePvForecast;
};
type CombinedLoading = {
  nationalForecastLoading: boolean;
  pvRealDayInLoading: boolean;
  pvRealDayAfterLoading: boolean;
  nationalNHourLoading: boolean;
  allGspSystemLoading: boolean;
  allGspForecastLoading: boolean;
  allGspRealLoading: boolean;
};
type CombinedValidating = {
  nationalForecastValidating: boolean;
  pvRealDayInValidating: boolean;
  pvRealDayAfterValidating: boolean;
  nationalNHourValidating: boolean;
  allGspSystemValidating: boolean;
  allGspForecastValidating: boolean;
  allGspRealValidating: boolean;
};
type CombinedErrors = {
  nationalForecastError: any;
  pvRealDayInError: any;
  pvRealDayAfterError: any;
  nationalNHourError: any;
  allGspSystemError: any;
  allGspForecastError: any;
  allGspRealError: any;
};
type SitesCombinedLoading = {
  allSitesLoading: boolean;
  sitePvForecastLoading: boolean;
  sitePvActualLoading: boolean;
};
type SitesCombinedValidating = {
  allSitesValidating: boolean;
  sitePvForecastValidating: boolean;
  sitePvActualValidating: boolean;
};
type SitesCombinedErrors = {
  allSitesError: any;
  sitesPvForecastError: any;
  sitesPvActualError: any;
};
type GspEntity = {
  label: string;
  gspId: number;
  gspName: string;
  gspGroup: string;
  regionName: string;
  installedCapacityMw: number;
  rmMode: boolean;
};
type GspEntities = GspEntity[];

type GspRealData = GspEntity & {
  gspYields: [
    {
      datetimeUtc: string;
      solarGenerationKw: number;
      regime: string;
      gsp: GspEntity;
    }
  ];
};
type GspAllForecastData = {
  forecasts: {
    location: GspEntity;
    model: {
      name: string;
      version: string;
    };
    forecastCreationTime: string;
    historic: boolean;
    forecastValues: ForecastValue[];
    inputDataLastUpdated: {
      gsp: string;
      nwp: string;
      pv: string;
      satellite: string;
    };
  }[];
};
type GspDeltaValue = {
  gspId: number;
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

export type SolarStatus = {
  status: string;
  message: string;
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
