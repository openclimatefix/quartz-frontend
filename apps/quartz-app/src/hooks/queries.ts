import { operations, paths } from "@/src/types/schema";
import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import {
  GET_FORECAST,
  GET_GENERATION,
  GET_REGIONS,
  getForecastQuery,
  getGenerationQuery,
  getRegionsQuery
} from "@/src/data/queries";
import { components } from "@/src/types/schema";

// type UseQueryOptions<T> = ParamsOption<T> &
//   RequestBodyOption<T> & {
//     // add your custom options here
//     reactQuery?: {
//       enabled: boolean; // Note: React Query type’s inference is difficult to apply automatically, hence manual option passing here
//       // add other React Query options as needed
//     };
//   };

export const useGetRegionsQuery = (
  source: operations["get_regions_route__source__regions_get"]["parameters"]["path"]["source"]
) => {
  return useQuery({
    queryKey: [GET_REGIONS, "solar"],
    queryFn: getRegionsQuery(source)
  });
};

// Get Actual generation for a given region
export const useGetGenerationForRegionQuery = (
  source: operations["get_historic_timeseries_route__source___region__generation_get"]["parameters"]["path"]["source"],
  region: operations["get_historic_timeseries_route__source___region__generation_get"]["parameters"]["path"]["region"],
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: [GET_GENERATION, source, region],
    queryFn: getGenerationQuery(source, region),
    enabled
  });
};

// Get forecasted generation for a given region
export const useGetForecastedGenerationForRegionQuery = (
  source: operations["get_forecast_timeseries_route__source___region__forecast_get"]["parameters"]["path"]["source"],
  region: operations["get_forecast_timeseries_route__source___region__forecast_get"]["parameters"]["path"]["region"],
  enabled: boolean = true,
  forecastHorizon?: components["schemas"]["ForecastHorizon"],
  forecastHorizonMinutes?: number
) => {
  return useQuery({
    queryKey: [
      GET_FORECAST,
      source,
      region,
      forecastHorizon,
      forecastHorizon === "horizon" ? forecastHorizonMinutes : ""
    ],
    queryFn: getForecastQuery(source, region, forecastHorizon, forecastHorizonMinutes),
    enabled
  });
};

// Function from docs demo, but couldn't quite get it to work nicely with the types
// Might lose some React Query features but can't tell yet
//
// export function useGetSolarRegions({
//   params,
//   body,
//   reactQuery,
// }: UseQueryOptions<paths["/{source}/regions"]["get"]>) {
//   return useQuery({
//     ...reactQuery,
//     queryKey: [
//       GET_REGIONS,
//       // add any other hook dependencies here
//     ],
//     queryFn: async ({ meta, signal }) => {
//       const { data, error } = await client.GET(GET_REGIONS, {
//         params,
//         // body - isn’t used for GET, but needed for other request types
//         signal, // allows React Query to cancel request
//       });
//       console.log("data1", data);
//       if (data) return data;
//       throw new Error(error.detail?.[0]?.msg); // React Query expects errors to be thrown to show a message
//     },
//   });
// }
