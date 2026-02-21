"use client";
import { QueryFunction, useQuery } from "@tanstack/react-query";
import { components, operations, paths } from "../types/schema";
import client from "./apiClient";
import { getHistoryStartISO } from "../helpers/historyWindow";

// paths
export const GET_REGIONS = "/{source}/regions";
export const GET_GENERATION = "/{source}/{region}/generation";
export const GET_FORECAST = "/{source}/{region}/forecast";

const sharedQueryParams = {
  ui: "",
};

export const getRegionsQuery = (
  source: operations["get_regions_route__source__regions_get"]["parameters"]["path"]["source"]
): QueryFunction<components["schemas"]["GetRegionsResponse"]> => {
  return async ({ meta, signal }) => {
    const { accessToken } = await fetch("/api/token").then((res) => res.json());
    const { data, error } = await client.GET(GET_REGIONS, {
      params: {
        path: {
          source,
        },
        // @ts-ignore
        query: {
          ...sharedQueryParams,
        },
      },
      // Add bearer token to headers
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      // body - isn’t used for GET, but needed for other request types
      signal, // allows React Query to cancel request
    });
    console.log("regionsData", data);
    if (data) return data;
    throw new Error(error.detail?.[0]?.msg); // React Query expects errors to be thrown to show a message
  };
};

// Get generation values for source and region
export const getGenerationQuery = (
  source: operations["get_historic_timeseries_route__source___region__generation_get"]["parameters"]["path"]["source"],
  region: operations["get_historic_timeseries_route__source___region__generation_get"]["parameters"]["path"]["region"]
): QueryFunction<components["schemas"]["GetHistoricGenerationResponse"]> => {
  return async ({ meta, signal }) => {
    const startISO = getHistoryStartISO();
    const { accessToken } = await fetch("/api/token").then((res) => res.json());
    const { data, error } = await client.GET(GET_GENERATION, {
      params: {
        path: {
          source,
          region,
        },
        query: {
          ...sharedQueryParams,
          resample_minutes: 15,
          // start of history window for UI
          // @ts-ignore – schema typing may not include this yet
          start_datetime_utc: startISO,
        },
      },
      // Add bearer token to headers
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal,
    });
    console.log("data2", data);
    if (data) return data;
    throw new Error(error.detail?.[0]?.msg);
  };
};

// Get forecast values for source and region
export const getForecastQuery = (
  source: operations["get_forecast_timeseries_route__source___region__forecast_get"]["parameters"]["path"]["source"],
  region: operations["get_forecast_timeseries_route__source___region__forecast_get"]["parameters"]["path"]["region"],
  forecast_horizon?: components["schemas"]["ForecastHorizon"],
  forecast_horizon_minutes?: number
): QueryFunction<components["schemas"]["GetForecastGenerationResponse"]> => {
  return async ({ meta, signal }) => {
    const startISO = getHistoryStartISO();
    const { accessToken } = await fetch("/api/token").then((res) => res.json());
    const { data, error } = await client.GET(GET_FORECAST, {
      params: {
        path: {
          source,
          region,
        },
        query: {
          ...sharedQueryParams,
          forecast_horizon,
          forecast_horizon_minutes:
            forecast_horizon === "horizon" ? forecast_horizon_minutes : null,
          // start of history window for UI
          // @ts-ignore – schema typing may not include this yet
          start_datetime_utc: startISO,
        },
      },
      // Add bearer token to headers
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal,
    });
    console.log("data3", data);
    if (data) return data;
    throw new Error(error.detail?.[0]?.msg);
  };
};
