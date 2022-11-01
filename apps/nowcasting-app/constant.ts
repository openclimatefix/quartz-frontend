export const API_PREFIX = "https://localhost:8000";
export const MAX_POWER_GENERATED = 500;
export const MAX_NATIONAL_GENERATION_MW = 12000;

export const getAllForecastUrl = (isNormalized: boolean, isHistoric: boolean) =>
  `${API_PREFIX}/solar/GB/gsp/forecast/all/?${isHistoric ? "historic=true" : ""}${
    isNormalized ? "&normalize=true" : ""
  }`;

export const apiErrorMSGS = [
  {
    key: /\/solar\/GB\/gsp\/forecast\/all\??$/,
    getMsg: (key: string) => "Error fetching initial data. Retrying now…"
  },
  {
    key: /\/solar\/GB\/gsp\/forecast\/all\?historic=true&normalize=true$/,
    getMsg: (key: string) => "Error fetching map data. Retrying now…"
  },

  {
    key: /\/solar\/GB\/national\/forecast\??$/,
    getMsg: (key: string) => "Error fetching national forecasts data. Retrying now…"
  },
  {
    key: /\/solar\/GB\/national\/pvlive\/?regime=in-day$/,
    getMsg: (key: string) => "Error fetching National PV Live initial estimate. Retrying now ..."
  },
  {
    key: /\/solar\/GB\/national\/pvlive\/?regime=day-after$/,
    getMsg: (key: string) => "Error fetching National PV Live updated. Retrying now ..."
  },

  {
    key: /\/solar\/GB\/gsp\/pvlive\/\d+\/?regime=in-day$/,
    getMsg: (key: string) => {
      const gspId = (key.match(/(\d+)/) || [])[1];
      return `Error fetching the GSP ${gspId} PV Live initial estimate. Retrying now ...`;
    }
  },
  {
    key: /\/solar\/GB\/gsp\/pvlive\/\d+\/?regime=day-after$/,
    getMsg: (key: string) => {
      const gspId = (key.match(/(\d+)/) || [])[1];
      return `Error fetching GSP ${gspId} PV Live updated. Retrying now ...`;
    }
  }
];

export enum VIEWS {
  FORECAST = "FORECAST",
  DELTA = "DELTA",
  SOLAR_SITES = "SOLAR SITES"
}
