// tools for the chart
import { ChartData } from "../charts/remix-line";

// get the zoomYMax for either sites or national view
export const getZoomYMax = (globalFilteredPreppedData: ChartData[]) => {
  // if no probabilistic max value, get the max between the generation and the forecast as the zoomYMax
  if (!globalFilteredPreppedData.some((d) => d.PROBABILISTIC_UPPER_BOUND)) {
    let genMax =
      globalFilteredPreppedData
        .map((d) => d.GENERATION_UPDATED || d.GENERATION)
        .filter((n) => typeof n === "number")
        .sort((a, b) => Number(b) - Number(a))[0] || 0;
    let forecastMax =
      globalFilteredPreppedData
        .map((d) => d.PAST_FORECAST || d.FORECAST)
        .sort((a, b) => Number(b) - Number(a))[0] || 0;
    let calculatedYMax = Math.max(genMax, forecastMax);
    console.log("calculatedYMax no probabilistic", calculatedYMax);
    return calculatedYMax;
  } else {
    let calculatedYMax = globalFilteredPreppedData
      .map((d) => d.PROBABILISTIC_UPPER_BOUND || d.GENERATION)
      .filter((n) => typeof n === "number")
      .sort((a, b) => Number(b) - Number(a))[0];
    return calculatedYMax;
  }
};
