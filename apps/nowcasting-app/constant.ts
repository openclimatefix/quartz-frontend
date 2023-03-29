// export const API_PREFIX = "http://localhost:8000/v0";
export const API_PREFIX = process.env.NEXT_PUBLIC_API_PREFIX || "https://api-dev.nowcasting.io/v0";
export const SITES_API_PREFIX =
  process.env.NEXT_PUBLIC_SITES_API_PREFIX ||
  "https://api-dev-site.nowcasting.io";
export const MAX_POWER_GENERATED = 500;
export const MAX_NATIONAL_GENERATION_MW = 12000;

export const getAllForecastUrl = (isNormalized: boolean, isHistoric: boolean) =>
  `${API_PREFIX}/solar/GB/gsp/forecast/all/?${isHistoric ? "historic=true" : ""}${
    isNormalized ? "&normalize=true" : ""
  }`;

export const apiErrorMSGS = [
  {
    key: /\/solar\/GB\/national\/forecast\??historic=false&only_forecast_values=true$/,
    getMsg: (key: string) => "Error fetching national forecast data. Retrying now…"
  },
  // {
  //   key: /\/solar\/GB\/gsp\/forecast\/all\?historic=true&normalize=true$/,
  //   getMsg: (key: string) => "Error fetching map data. Retrying now…"
  // },
  {
    key: /\/solar\/GB\/national\/pvlive\/?regime=in-day$/,
    getMsg: (key: string) => "Error fetching National PV Live initial estimate. Retrying now ..."
  },
  {
    key: /\/solar\/GB\/national\/pvlive\/?regime=day-after$/,
    getMsg: (key: string) => "Error fetching National PV Live updated. Retrying now ..."
  },
  {
    key: /\/solar\/GB\/national\/forecast\??forecast_horizon_minutes=240&historic=true&only_forecast_values=true$/,
    getMsg: (key: string) => "Error fetching national forecast data. Retrying now…"
  },

  {
    key: /\/solar\/GB\/gsp\/forecast\/all\??historic=true$/,
    getMsg: (key: string) => "Error fetching gsp forecasts data. Retrying now…"
  },

  {
    key: /\/solar\/GB\/gsp\/pvlive\/all\??regime=in-day$/,
    getMsg: (key: string) => "Error fetching gsp forecasts data. Retrying now…"
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

export enum AGGREGATION_LEVELS {
  NATIONAL = "NATIONAL",
  REGION = "REGION",
  GSP = "GSP",
  SITE = "SITE"
}

export enum SORT_BY {
  NAME = "NAME",
  GENERATION = "GENERATION",
  CAPACITY = "CAPACITY",
  YIELD = "YIELD"
}

export enum DELTA_BUCKET {
  NEG4 = -100,
  NEG3 = -75,
  NEG2 = -50,
  NEG1 = -25,
  ZERO = 0,
  POS1 = 25,
  POS2 = 50,
  POS3 = 75,
  POS4 = 100
}
export const getDeltaBucketKeys = () => Object.keys(DELTA_BUCKET).filter((k) => isNaN(Number(k)));
