// tools for the chart
import { ChartData } from "../charts/remix-line";
// get the zoomYMax for either sites or national view
export const getZoomYMax = (filteredPreppedData: ChartData[]) => {
  // if no probabilistic max value, get the max between the generation and the forecast as the zoomYMax
  if (!filteredPreppedData.some((d) => d.PROBABILISTIC_UPPER_BOUND)) {
    console.log(filteredPreppedData);
    let genMax =
      filteredPreppedData
        .map((d) => d.GENERATION_UPDATED || d.GENERATION)
        .filter((n) => typeof n === "number")
        .sort((a, b) => Number(b) - Number(a))[0] || 0;
    console.log("genMax", genMax);
    let forecastMax =
      filteredPreppedData
        .map((d) => d.PAST_FORECAST || d.FORECAST)
        .sort((a, b) => Number(b) - Number(a))[0] || 0;
    console.log("forecastMax", forecastMax);
    let calculatedYMax = Math.max(genMax, forecastMax);
    console.log("calculatedYMax no probabilistic", calculatedYMax);
    return calculatedYMax;
  } else {
    let calculatedYMax = filteredPreppedData
      .map((d) => d.PROBABILISTIC_UPPER_BOUND || d.GENERATION)
      .filter((n) => typeof n === "number")
      .sort((a, b) => Number(b) - Number(a))[0];
    console.log("calculatedYMax with probabilistic", calculatedYMax);
    return calculatedYMax;
  }
};
