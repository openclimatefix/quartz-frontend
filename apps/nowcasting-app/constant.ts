export const API_PREFIX = "https://api-dev.nowcasting.io/v0";
export const MAX_POWER_GENERATED = 400;

export const getAllForecastUrl = (isNormalized: boolean, isHistoric: boolean) =>
  `${API_PREFIX}/GB/solar/gsp/forecast/all?${isHistoric ? "historic=true" : ""}${
    isNormalized ? "&normalize=true" : ""
  }`;
