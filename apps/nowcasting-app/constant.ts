// export const API_PREFIX = "http://localhost:8000/v0";
export const API_PREFIX = process.env.NEXT_PUBLIC_API_PREFIX || "https://api-dev.quartz.solar/v0";
export const SITES_API_PREFIX =
  process.env.NEXT_PUBLIC_SITES_API_PREFIX || "https://api-site-dev.quartz.solar";
export const MAX_POWER_GENERATED = 500;
export const MAX_NATIONAL_GENERATION_MW = 14000;

// Static constant below of this function so we don't call dynamically unnecessarily.
// import { generateYMaxTickArray } from "../../helpers/chartUtils";
// console.log("Y_MAX_TICKS", generateYMaxTickArray());
//
// We want to have the yMax of the graph to be related to the capacity of the GspPvRemixChart.
// If we use the raw values, the graph looks funny, i.e y major ticks are 0 100 232
// So, we round these up to the following numbers, which hopefully split nicely into the y-axis.
// Uncomment the above function to get updated values should we need to change these
export const Y_MAX_TICKS = [
  1, 2, 3, 4, 5, 6, 9, 10, 12, 15, 18, 20, 25, 30, 40, 45, 50, 60, 75, 80, 90, 100, 150, 200, 250,
  300, 350, 400, 450, 500, 600, 700, 800, 900, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000,
  6000, 7000, 8000, 9000, 10000, 12000, 14000, 15000, 16000, 18000, 20000
];

export const getAllForecastUrl = (isNormalized: boolean, isHistoric: boolean) =>
  `${API_PREFIX}/solar/GB/gsp/forecast/all/?UI&${isHistoric ? "historic=true" : ""}${
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
export const getViewTitle = (view: VIEWS) => {
  switch (view) {
    case VIEWS.FORECAST:
      return "PV Forecast";
    case VIEWS.DELTA:
      return "Delta";
    case VIEWS.SOLAR_SITES:
      return "Solar Sites";
  }
};

export enum AGGREGATION_LEVELS {
  NATIONAL = "NATIONAL",
  REGION = "REGION",
  GSP = "GSP",
  SITE = "SITE"
}

export enum AGGREGATION_LEVEL_MIN_ZOOM {
  NATIONAL = 0,
  REGION = 5,
  GSP = 7,
  SITE = 8.5
}
export enum AGGREGATION_LEVEL_MAX_ZOOM {
  NATIONAL = AGGREGATION_LEVEL_MIN_ZOOM.REGION,
  REGION = AGGREGATION_LEVEL_MIN_ZOOM.GSP,
  GSP = AGGREGATION_LEVEL_MIN_ZOOM.SITE,
  SITE = 14
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

export const N_HOUR_FORECAST_OPTIONS = [1, 2, 4, 8];
