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
  expectedPowerGenerationNormalized: null;
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
