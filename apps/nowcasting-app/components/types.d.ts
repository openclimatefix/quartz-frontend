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
  deltaColor: string;
  dataKey: string;
  deltaPercentage: string;
  deltaNormalized: string
};
