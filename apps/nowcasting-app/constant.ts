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
    msg: "Error fetching initial data. Retrying now…",
  },
  {
    key: /\/GB\/solar\/gsp\/forecast\/all\?historic=true&normalize=true$/,
    msg: "Error fetching map data. Retrying now…",
  },

  {
    key: /\/GB\/solar\/gsp\/forecast\/latest\/0$/,
    msg: "Error fetching national forcasts data. Retrying now…",
  },
  {
    key: /\/GB\/solar\/gsp\/truth\/one_gsp\/0\/\?regime=in-day$/,
    msg: 'Error fetching "NA-INDAY" data. Retrying now…',
  },
  {
    key: /\/GB\/solar\/gsp\/truth\/one_gsp\/0\/\?regime=day-after$/,
    msg: 'Error fetching "NA-DAYAFTER" data. Retrying now…',
  },

  {
    key: /\/GB\/solar\/gsp\/truth\/one_gsp\/\d+\/\?regime=in-day$/,
    msg: 'Error fetching "GSP-INDAY" data. Retrying now…',
  },
  {
    key: /\/GB\/solar\/gsp\/truth\/one_gsp\/\d+\/\?regime=day-after$/,
    msg: 'Error fetching "GSP-DAYAFTER" data. Retrying now…',
  },
];
