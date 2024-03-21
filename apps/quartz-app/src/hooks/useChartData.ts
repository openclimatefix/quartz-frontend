import { ChartDatum, CombinedData } from "@/src/types/data";
import {
  convertDatestampToEpoch,
  getEpochNowInTimezone,
} from "@/src/helpers/datetime";

export const useChartData = (combinedData: CombinedData) => {
  let formattedChartData: ChartDatum[] = [];

  // Loop through wind forecast and add to formattedSolarData
  if (combinedData.windForecastData?.values) {
    for (const value of combinedData.windForecastData?.values) {
      const timestamp = convertDatestampToEpoch(value.Time);
      const existingData = formattedChartData?.find(
        (data) => data.timestamp === timestamp
      );
      const key =
        timestamp <= getEpochNowInTimezone()
          ? "wind_forecast_past"
          : "wind_forecast_future";
      // if the timestamp is now, add to both wind_forecast_past and wind_forecast_future
      // so that the area chart doesn't have a gap
      const isNow = timestamp === getEpochNowInTimezone();
      if (existingData) {
        existingData[key] = value.PowerKW ? value.PowerKW / 1000 : null;
        if (isNow) {
          existingData["wind_forecast_future"] = value.PowerKW
            ? value.PowerKW / 1000
            : null;
        }
      } else {
        formattedChartData?.push({
          timestamp,
          [key]: value.PowerKW / 1000,
          solar_generation: null,
          wind_generation: null,
        });
        if (isNow) {
          formattedChartData?.push({
            timestamp,
            wind_forecast_future: value.PowerKW / 1000,
            solar_generation: null,
            wind_generation: null,
          });
        }
      }
    }
  }
  // Loop through solar forecast and add to formattedSolarData
  if (combinedData.solarForecastData?.values) {
    for (const value of combinedData.solarForecastData?.values) {
      const timestamp = convertDatestampToEpoch(value.Time);
      const existingData = formattedChartData?.find(
        (data) => data.timestamp === timestamp
      );
      const key =
        timestamp <= getEpochNowInTimezone()
          ? "solar_forecast_past"
          : "solar_forecast_future";
      // if the timestamp is now, add to both solar_forecast_past and solar_forecast_future
      // so that the area chart doesn't have a gap
      const isNow = timestamp === getEpochNowInTimezone();
      if (existingData) {
        existingData[key] = value.PowerKW ? value.PowerKW / 1000 : null;
        if (isNow) {
          existingData["solar_forecast_future"] = value.PowerKW
            ? value.PowerKW / 1000
            : null;
        }
      } else {
        formattedChartData?.push({
          timestamp,
          [key]: value.PowerKW / 1000,
        });
        if (isNow) {
          formattedChartData?.push({
            timestamp,
            solar_forecast_future: value.PowerKW / 1000,
          });
        }
      }
    }
  }

  // Loop through solar generation and add to formattedSolarData
  if (combinedData.solarGenerationData?.values) {
    for (const value of combinedData.solarGenerationData?.values) {
      const timestamp = convertDatestampToEpoch(value.Time);
      const existingData = formattedChartData?.find(
        (data) => data.timestamp === timestamp
      );
      if (
        existingData &&
        (existingData.solar_forecast_past ||
          existingData.solar_forecast_future ||
          existingData.wind_forecast_future ||
          existingData.wind_forecast_past)
      ) {
        existingData.solar_generation = value.PowerKW / 1000;
      }
    }
  }

  // Loop through wind generation and add to formattedSolarData
  if (combinedData.windGenerationData?.values) {
    for (const value of combinedData.windGenerationData?.values) {
      const timestamp = convertDatestampToEpoch(value.Time);
      const existingData = formattedChartData?.find(
        (data) => data.timestamp === timestamp
      );
      if (
        existingData &&
        (existingData.solar_forecast_past ||
          existingData.solar_forecast_future ||
          existingData.wind_forecast_future ||
          existingData.wind_forecast_past)
      ) {
        existingData.wind_generation = value.PowerKW / 1000;
      }
    }
  }

  formattedChartData = formattedChartData.sort(
    (a, b) => a.timestamp - b.timestamp
  );
  return formattedChartData;
};
