import { components } from "@/src/types/schema";

export type CombinedData = {
  solarGenerationData:
    | components["schemas"]["GetHistoricGenerationResponse"]
    | undefined;
  windGenerationData:
    | components["schemas"]["GetHistoricGenerationResponse"]
    | undefined;
  solarForecastData:
    | components["schemas"]["GetForecastGenerationResponse"]
    | undefined;
  windForecastData:
    | components["schemas"]["GetForecastGenerationResponse"]
    | undefined;
};
export type ChartDatum = {
  timestamp: number;
  solar_generation?: number | null;
  wind_generation?: number | null;
  solar_forecast_past?: number;
  solar_forecast_future?: number;
  wind_forecast_past?: number;
  wind_forecast_future?: number;
};
