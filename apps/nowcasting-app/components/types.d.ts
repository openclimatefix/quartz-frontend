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
    forecastValues: {
      targetTime: string;
      expectedPowerGenerationMegawatts: number;
      expectedPowerGenerationNormalized: null;
    }[];
    inputDataLastUpdated: {
      gsp: string;
      nwp: string;
      pv: string;
      satellite: string;
    };
  }[];
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
