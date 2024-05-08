// Test useChartData hook

import { describe } from "node:test";
import { useChartData } from "@/src/hooks/useChartData";
import { DateTime } from "luxon";
import { getEpochNowInTimezone } from "@/src/helpers/datetime";

describe("useChartData", () => {
  it("should return formattedChartData with all data", () => {
    const combinedData = {
      windForecastData: {
        values: [
          {
            Time: "2024-04-03T07:00:00+05:30",
            PowerKW: 1000,
          },
          {
            Time: "2024-04-03T07:15:00+05:30",
            PowerKW: 2000,
          },
        ],
      },
      solarForecastData: {
        values: [
          {
            Time: "2024-04-03T07:00:00+05:30",
            PowerKW: 500,
          },
          {
            Time: "2024-04-03T07:15:00+05:30",
            PowerKW: 1000,
          },
        ],
      },
      windGenerationData: {
        values: [
          {
            Time: "2024-04-03T07:00:00+05:30",
            PowerKW: 500,
          },
          {
            Time: "2024-04-03T07:15:00+05:30",
            PowerKW: 1000,
          },
        ],
      },
      solarGenerationData: {
        values: [
          {
            Time: "2024-04-03T07:00:00+05:30",
            PowerKW: 500,
          },
          {
            Time: "2024-04-03T07:15:00+05:30",
            PowerKW: 1000,
          },
        ],
      },
    };
    const formattedChartData = useChartData(combinedData);
    expect(formattedChartData).toEqual([
      {
        timestamp: 1712124000000,
        solar_forecast_past: 0.5,
        solar_generation: 0.5,
        wind_forecast_past: 1,
        wind_generation: 0.5,
      },
      {
        timestamp: 1712124900000,
        solar_forecast_past: 1,
        solar_generation: 1,
        wind_forecast_past: 2,
        wind_generation: 1,
      },
    ]);
  });
  it("should return formattedChartData with missing data", () => {
    const combinedData = {
      windForecastData: {
        values: [
          {
            Time: "2024-04-03T07:00:00+05:30",
            PowerKW: 1000,
          },
          {
            Time: "2024-04-03T07:15:00+05:30",
            PowerKW: 2000,
          },
          {
            Time: "2024-04-03T07:30:00+05:30",
            PowerKW: 1500,
          },
        ],
      },
      solarForecastData: {
        values: [
          {
            Time: "2024-04-03T07:00:00+05:30",
            PowerKW: 500,
          },
          {
            Time: "2024-04-03T07:15:00+05:30",
            PowerKW: 1000,
          },
          {
            Time: "2024-04-03T07:30:00+05:30",
            PowerKW: 3000,
          },
        ],
      },
      windGenerationData: {
        values: [
          {
            Time: "2024-04-03T07:15:00+05:30",
            PowerKW: 1000,
          },
        ],
      },
      solarGenerationData: {
        values: [
          {
            Time: "2024-04-03T07:00:00+05:30",
            PowerKW: 500,
          },
        ],
      },
    };
    const formattedChartData = useChartData(combinedData);
    expect(formattedChartData).toEqual([
      {
        timestamp: 1712124000000,
        solar_forecast_past: 0.5,
        solar_generation: 0.5,
        wind_forecast_past: 1,
        wind_generation: null,
      },
      {
        timestamp: 1712124900000,
        solar_forecast_past: 1,
        solar_generation: null,
        wind_forecast_past: 2,
        wind_generation: 1,
      },
      {
        timestamp: 1712125800000,
        solar_forecast_past: 3,
        solar_generation: null,
        wind_forecast_past: 1.5,
        wind_generation: null,
      },
    ]);
  });
  it("should return formattedChartData with no data", () => {
    const combinedData = {
      windForecastData: {
        values: [],
      },
      solarForecastData: {
        values: [],
      },
      windGenerationData: {
        values: [],
      },
      solarGenerationData: {
        values: [],
      },
    };
    const formattedChartData = useChartData(combinedData);
    expect(formattedChartData).toEqual([]);
  });
  it("should return formattedChartData with correct now entry with past/future", () => {
    const now = DateTime.fromMillis(getEpochNowInTimezone()) || DateTime.now();
    // Defaults for now and timestamps to keep types happy – should always be returned by Luxon methods
    const previousTime =
      now.minus({ minute: 15 }).toISO() || "1970-01-01T00:00:00+05:30";
    const nowTime = now.toISO() || "1970-01-01T00:00:00+05:30";
    const nextTime =
      now.plus({ minute: 15 }).toISO() || "1970-01-01T00:00:00+05:30";
    const combinedData = {
      windForecastData: {
        values: [
          {
            Time: previousTime,
            PowerKW: 1000,
          },
          {
            Time: nowTime,
            PowerKW: 1000,
          },
          {
            Time: nextTime,
            PowerKW: 1000,
          },
        ],
      },
      solarForecastData: {
        values: [
          {
            Time: previousTime,
            PowerKW: 500,
          },
          {
            Time: nowTime,
            PowerKW: 500,
          },
          {
            Time: nextTime,
            PowerKW: 500,
          },
        ],
      },
      windGenerationData: {
        values: [
          {
            Time: previousTime,
            PowerKW: 500,
          },
          {
            Time: nowTime,
            PowerKW: 500,
          },
          {
            Time: nextTime,
            PowerKW: 500,
          },
        ],
      },
      solarGenerationData: {
        values: [
          {
            Time: previousTime,
            PowerKW: 500,
          },
          {
            Time: nowTime,
            PowerKW: 500,
          },
          {
            Time: nextTime,
            PowerKW: 500,
          },
        ],
      },
    };
    const formattedChartData = useChartData(combinedData);
    expect(formattedChartData).toEqual([
      {
        timestamp: now.minus({ minute: 15 }).toMillis(),
        solar_generation: 0.5,
        wind_generation: 0.5,
        solar_forecast_past: 0.5,
        wind_forecast_past: 1,
      },
      {
        timestamp: now.toMillis(),
        solar_generation: 0.5,
        wind_generation: 0.5,
        solar_forecast_future: 0.5,
        solar_forecast_past: 0.5,
        wind_forecast_future: 1,
        wind_forecast_past: 1,
      },
      {
        timestamp: now.plus({ minute: 15 }).toMillis(),
        solar_generation: 0.5,
        wind_generation: 0.5,
        solar_forecast_future: 0.5,
        wind_forecast_future: 1,
      },
    ]);
  });
});
