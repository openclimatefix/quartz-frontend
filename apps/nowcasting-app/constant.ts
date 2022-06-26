export const API_PREFIX = "https://api-dev.nowcasting.io/v0";
export const MAX_POWER_GENERATED = 500;
export const MAX_NATIONAL_GENERATION_MW = 12000;

export const getAllForecastUrl = (isNormalized: boolean, isHistoric: boolean) =>
  `${API_PREFIX}/GB/solar/gsp/forecast/all?${isHistoric ? "historic=true" : ""}${
    isNormalized ? "&normalize=true" : ""
  }`;

export const apiErrorMSGS = [
  {
    key: /\/GB\/solar\/gsp\/forecast\/all\??$/,
    getMsg: (key: string) => "Error fetching initial data. Retrying now…",
  },
  {
    key: /\/GB\/solar\/gsp\/forecast\/all\?historic=true&normalize=true$/,
    getMsg: (key: string) => "Error fetching map data. Retrying now…",
  },

  {
    key: /\/GB\/solar\/gsp\/forecast\/latest\/0$/,
    getMsg: (key: string) => "Error fetching national forecasts data. Retrying now…",
  },
  {
    key: /\/GB\/solar\/gsp\/truth\/one_gsp\/0\/\?regime=in-day$/,
    getMsg: (key: string) => "Error fetching National PV Live initial estimate. Retrying now ...",
  },
  {
    key: /\/GB\/solar\/gsp\/truth\/one_gsp\/0\/\?regime=day-after$/,
    getMsg: (key: string) => "Error fetching National PV Live updated. Retrying now ...",
  },

  {
    key: /\/GB\/solar\/gsp\/truth\/one_gsp\/\d+\/\?regime=in-day$/,
    getMsg: (key: string) => {
      const gspId = (key.match(/one_gsp\/(\d+)/) || [])[1];
      return `Error fetching GSP ${gspId} PV Live initial estimate. Retrying now ...`;
    },
  },
  {
    key: /\/GB\/solar\/gsp\/truth\/one_gsp\/\d+\/\?regime=day-after$/,
    getMsg: (key: string) => {
      const gspId = (key.match(/one_gsp\/(\d+)/) || [])[1];
      return `Error fetching GSP ${gspId} PV Live updated. Retrying now ...`;
    },
  },
];
