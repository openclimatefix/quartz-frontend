import { DELTA_BUCKET } from "../constant";

export type FcAllResData = {
  type: "FeatureCollection";
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
  expectedPowerGenerationNormalized: number | null;
};
type ForecastData = {
  targetTime: string;
  expectedPowerGenerationMegawatts: number;
  expectedPowerGenerationNormalized?: number | null;
}[];
type PvRealData = {
  datetimeUtc: string;
  solarGenerationKw: number;
}[];
type National4HourData = ForecastValue[];
type AllGspRealData = GspRealData[];
type CombinedData = {
  nationalForecastData: ForecastData | undefined;
  pvRealDayInData: PvRealData | undefined;
  pvRealDayAfterData: PvRealData | undefined;
  national4HourData: National4HourData | undefined;
  allGspForecastData: GspAllForecastData | undefined;
  allGspRealData: AllGspRealData | undefined;
  gspDeltas: GspDeltas | undefined;
};
type CombinedErrors = {
  nationalForecastError: any;
  pvRealDayInError: any;
  pvRealDayAfterError: any;
  national4HourError: any;
  allGspForecastError: any;
  allGspRealError: any;
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
  gspDeltas?: Map<number, GspDeltaValue>;
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
  installed_capacity_kw: number;
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
