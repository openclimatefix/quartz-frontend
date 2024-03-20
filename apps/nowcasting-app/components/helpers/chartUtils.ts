// tools for the chart
import { ChartData } from "../charts/remix-line";

// get the zoomYMax for either sites or national view
export const getZoomYMax = (filteredPreppedData: ChartData[]) => {
  // if no probabilistic max value, get the max between the generation and the forecast as the zoomYMax
  if (!filteredPreppedData.some((d) => d.PROBABILISTIC_UPPER_BOUND)) {
    let genMax =
      filteredPreppedData
        .map((d) => d.GENERATION_UPDATED || d.GENERATION)
        .filter((n) => typeof n === "number")
        .sort((a, b) => Number(b) - Number(a))[0] || 0;
    let forecastMax =
      filteredPreppedData
        .map((d) => d.PAST_FORECAST || d.FORECAST)
        .sort((a, b) => Number(b) - Number(a))[0] || 0;
    return Math.max(genMax, forecastMax);
  } else {
    return filteredPreppedData
      .map((d) => d.PROBABILISTIC_UPPER_BOUND || d.GENERATION)
      .filter((n) => typeof n === "number")
      .sort((a, b) => Number(b) - Number(a))[0];
  }
};
