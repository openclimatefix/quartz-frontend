import axios from "axios";
import { DELTA_BUCKET, getDeltaBucketKeys } from "../../constant";
import {
  Bucket,
  CombinedData,
  CombinedErrors,
  CombinedLoading,
  CombinedSitesData,
  CombinedValidating,
  NationalEndpointLabel,
  NationalEndpointStates,
  GspDeltaValue,
  LoadingState,
  SitesCombinedErrors,
  SitesCombinedLoading,
  SitesCombinedValidating,
  SitesEndpointStates
} from "../types.d";
import Router from "next/router";
import * as Sentry from "@sentry/nextjs";
import createClient from "openapi-fetch";
import { paths } from "../../types/quartz-api";
import { PathsWithMethod } from "openapi-typescript-helpers";

export const isProduction = process.env.NEXT_PUBLIC_IS_PRODUCTION === "true";

export const enable4hView = process.env.NEXT_PUBLIC_4H_VIEW === "true";

export const allForecastsAccessor = (d: any) => d.forecastValues;
const forecastAccessor0 = (d: any) => d.forecastValues[0].expectedPowerGenerationMegawatts;
const forecastAccessor1 = (d: any) => d.forecastValues[1].expectedPowerGenerationMegawatts;
const forecastAccessor2 = (d: any) => d.forecastValues[2].expectedPowerGenerationMegawatts;
export const getForecastAccessorForTimeHorizon = (selectedTimeHorizon: number) => {
  switch (selectedTimeHorizon) {
    case 0:
      return forecastAccessor0;
    case 1:
      return forecastAccessor1;
    case 2:
      return forecastAccessor2;
  }
};

export const classNames = (...classes: string[]) => {
  return classes.filter(Boolean).join(" ");
};

export const getLoadingState = (
  combinedLoading: CombinedLoading,
  combinedValidating: CombinedValidating,
  combinedErrors: CombinedErrors,
  combinedData: CombinedData
): LoadingState<NationalEndpointStates> => {
  let initialLoadComplete = Object.values(combinedLoading).every((loading) => !loading);
  let showMessage = !initialLoadComplete;
  let message = "Loading initial data";
  if (initialLoadComplete) {
    if (combinedValidating.nationalForecastValidating) {
      message = `Loading latest ${NationalEndpointLabel.nationalForecast}`;
      showMessage = true;
    }
    if (combinedValidating.pvRealDayInValidating) {
      message = showMessage
        ? "Loading latest data"
        : `Loading latest ${NationalEndpointLabel.pvRealDayIn}`;
      showMessage = true;
    }
    if (combinedValidating.pvRealDayAfterValidating) {
      message = showMessage
        ? "Loading latest data"
        : `Loading latest ${NationalEndpointLabel.pvRealDayAfter}`;
      showMessage = true;
    }
    if (combinedValidating.national4HourValidating) {
      message = showMessage
        ? "Loading latest data"
        : `Loading latest ${NationalEndpointLabel.national4Hour}`;
      showMessage = true;
    }
    if (combinedValidating.allGspForecastValidating) {
      message = showMessage
        ? "Loading latest data"
        : `Loading latest ${NationalEndpointLabel.allGspForecast}`;
      showMessage = true;
    }
    if (combinedValidating.allGspRealValidating) {
      message = showMessage
        ? "Loading latest data"
        : `Loading latest ${NationalEndpointLabel.allGspReal}`;
      showMessage = true;
    }
  }
  const endpointStates: NationalEndpointStates = {
    type: "national",
    nationalForecast: {
      loading: combinedLoading.nationalForecastLoading,
      validating: combinedValidating.nationalForecastValidating,
      error: combinedErrors.nationalForecastError,
      hasData: !!combinedData.nationalForecastData
    },
    pvRealDayIn: {
      loading: combinedLoading.pvRealDayInLoading,
      validating: combinedValidating.pvRealDayInValidating,
      error: combinedErrors.pvRealDayInError,
      hasData: !!combinedData.pvRealDayInData
    },
    pvRealDayAfter: {
      loading: combinedLoading.pvRealDayAfterLoading,
      validating: combinedValidating.pvRealDayAfterValidating,
      error: combinedErrors.pvRealDayAfterError,
      hasData: !!combinedData.pvRealDayAfterData
    },
    national4Hour: {
      loading: combinedLoading.national4HourLoading,
      validating: combinedValidating.national4HourValidating,
      error: combinedErrors.national4HourError,
      hasData: !!combinedData.national4HourData
    },
    allGspForecast: {
      loading: combinedLoading.allGspForecastLoading,
      validating: combinedValidating.allGspForecastValidating,
      error: combinedErrors.allGspForecastError,
      hasData: !!combinedData.allGspForecastData
    },
    allGspReal: {
      loading: combinedLoading.allGspRealLoading,
      validating: combinedValidating.allGspRealValidating,
      error: combinedErrors.allGspRealError,
      hasData: !!combinedData.allGspRealData
    }
  };
  return {
    initialLoadComplete,
    showMessage,
    message,
    endpointStates
  };
};

export const getSitesLoadingState = (
  combinedLoading: SitesCombinedLoading,
  combinedValidating: SitesCombinedValidating,
  combinedErrors: SitesCombinedErrors,
  combinedData: CombinedSitesData
): LoadingState<SitesEndpointStates> => {
  let initialLoadComplete = Object.values(combinedLoading).every((loading) => !loading);
  let showMessage = false;
  let message = "Loading initial data";
  if (initialLoadComplete) {
    if (combinedValidating.allSitesValidating) {
      message = "Loading sites";
      showMessage = true;
    }
    if (combinedValidating.sitePvActualValidating) {
      message = showMessage ? "Loading latest data" : "Loading sites PV Actual";
      showMessage = true;
    }
    if (combinedValidating.sitePvForecastValidating) {
      message = showMessage ? "Loading latest data" : "Loading sites PV Forecast";
      showMessage = true;
    }
  }
  const endpointStates: SitesEndpointStates = {
    type: "sites",
    allSites: {
      loading: combinedLoading.allSitesLoading,
      validating: combinedValidating.allSitesValidating,
      error: combinedErrors.allSitesError,
      hasData: !!combinedData.allSitesData
    },
    sitePvActual: {
      loading: combinedLoading.sitePvActualLoading,
      validating: combinedValidating.sitePvActualValidating,
      error: combinedErrors.sitesPvActualError,
      hasData: !!combinedData.sitesPvActualData
    },
    sitePvForecast: {
      loading: combinedLoading.sitePvForecastLoading,
      validating: combinedValidating.sitePvForecastValidating,
      error: combinedErrors.sitesPvForecastError,
      hasData: !!combinedData.sitesPvForecastData
    }
  };
  return {
    initialLoadComplete,
    showMessage,
    message,
    endpointStates
  };
};

/**
 * @param date Date object
 * @returns HH:MM representation of the date, as string
 */
export const getTimeFromDate = (date: Date) => {
  return date.toTimeString().split(" ")[0].slice(0, -3);
};
export const formatISODateString = (date: string) => {
  // remove timezone and seconds

  const dateid = date?.slice(0, 16);
  return dateid;
};

export const formatISODateAsLondonTime = (date: Date) => {
  const date_london_time_str = date
    .toLocaleTimeString("en-GB", { timeZone: "Europe/London" })
    .slice(0, 5);

  return date_london_time_str;
};
export const convertISODateStringToLondonTime = (date: string) => {
  if (!date || date === ":00.000Z") return "00:00";
  // Changes the ISO date string to Europe London time, and return time only
  const d = new Date(date);
  if (typeof d !== "object" || isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${date}`);
  }
  return formatISODateAsLondonTime(d);
};

export const convertToLocaleDateString = (date: string) => {
  const localeDatetime = new Date(date);
  if (isNaN(localeDatetime.getTime())) {
    throw new Error(`Invalid date: ${date}`);
  }
  localeDatetime.setMinutes(localeDatetime.getMinutes() - localeDatetime.getTimezoneOffset());
  return localeDatetime.toISOString();
};

export const formatISODateStringHuman = (date: string) => {
  // Change date to nice human readable format.
  // Note that this converts the string to Europe London Time
  // timezone and seconds are removed

  const d = new Date(date);

  return dateToLondonDateTimeString(d);
};

export const dateToLondonDateTimeString = (date: Date) => {
  const date_london = date.toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London"
  });
  const date_london_time = date
    .toLocaleTimeString("en-GB", { timeZone: "Europe/London" })
    .slice(0, 5);

  return `${date_london}, ${date_london_time}`;
};

export const formatISODateStringHumanNumbersOnly = (date: string) => {
  // Change date to nice human readable format.
  // Note that this converts the string to Europe London Time
  // timezone and seconds are removed

  const d = new Date(date);

  const date_london = d.toLocaleDateString("en-GB", { timeZone: "Europe/London" });
  const date_london_time = d.toLocaleTimeString("en-GB", { timeZone: "Europe/London" }).slice(0, 5);

  // further formatting could be done to make it yyyy/mm/dd HH:MM
  return `${date_london} ${date_london_time}`;
};

export function prettyPrintChartAxisLabelDate(x: string | number) {
  // Check if x is a number, if so then it might be a UNIX timestamp
  if (typeof x === "number") {
    if (!Number.isNaN(x)) {
      if (!x) return "Invalid date 1";
      const parsedDate = new Date(x);
      if (Number.isNaN(parsedDate.getTime()) || parsedDate.getTime() === 0) return "Invalid date 2";
      return convertISODateStringToLondonTime(parsedDate.toISOString());
    }
  } else {
    // x is a string, check if it is a valid ISO date string
    if (x.includes("T")) {
      // check if it is a valid ISO date string
      const parsedDate = new Date(x);
      if (Number.isNaN(parsedDate.getTime()) || parsedDate.getTime() === 0) return "Invalid date 3";

      if (x.includes("+")) {
        return convertISODateStringToLondonTime(x);
      } else if (x.length > 16) {
        return convertISODateStringToLondonTime(x + "+00:00");
      } else {
        return convertISODateStringToLondonTime(x + ":00+00:00");
      }
    }
  }
  return `Invalid datetime input: ${typeof x} – ${x}`;
}

export const MWtoGW = (MW: number) => {
  return (MW / 1000).toFixed(1);
};
export const KWtoGW = (MW: number) => {
  return (MW / 1000 / 1000).toFixed(1);
};
export const KWtoMW = (MW: number) => {
  return (MW / 1000).toFixed(1);
};

export const addMinutesToISODate = (date: string, munites: number) => {
  var d = new Date(date);
  d.setMinutes(d.getMinutes() + munites);
  return d.toISOString();
};

export const getRounded4HoursAgoString = () => {
  const fourHoursAgo = new Date();
  fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);
  if (fourHoursAgo.getMinutes() < 30) {
    fourHoursAgo.setMinutes(0);
  } else {
    fourHoursAgo.setMinutes(30);
  }
  return convertISODateStringToLondonTime(fourHoursAgo.toISOString());
};

export const getRoundedPv = (pv: number, round: boolean = true) => {
  if (!round) return Math.round(pv);
  // round To: 0, 100, 200, 300, 400, 500
  return Math.round(pv / 100) * 100;
};
export const getRoundedPvNormalized = (val: number, round: boolean = true) => {
  if (!round) return val;
  const negative = val < 0;
  // round to : 0, 0.2, 0.4, 0.6 0.8, 1
  const absVal = Math.abs(val);
  let rounded = Math.round(absVal * 10);
  let finalVal = 0;
  // check if already even first decimal
  if (!(rounded % 2)) {
    finalVal = rounded / 10;
  } else {
    if (absVal * 10 >= rounded) {
      finalVal = (rounded + 1) / 10;
    } else {
      finalVal = (rounded - 1) / 10;
    }
  }
  return negative ? -finalVal : finalVal;
};

//this is the function I set up that would pass the accessToken from get_token.ts into the Authorization
//header or the request to the API.

export const axiosFetcherAuth = async (url: RequestInfo | URL) => {
  const response = await fetch("/api/get_token");
  const { accessToken } = await response.json();
  const router = Router;

  return axios(url as string, { headers: { Authorization: `Bearer ${accessToken}` } })
    .then(async (res) => {
      return res.data;
    })
    .catch((err) => {
      if ([401, 403].includes(err.response.status)) {
        Sentry.captureException(err, {
          tags: {
            error: "401/403 auth error"
          }
        });
        router.push("/api/auth/logout?redirectToLogin=true");
      }
    });
};

// @ts-ignore
export const openapiFetcherAuth = async (url: PathsWithMethod<paths, "get">) => {
  // const response = await fetch("/api/get_token");
  // const { accessToken } = await response.json();
  // const router = Router;
  const { GET, PUT } = createClient<paths>({
    baseUrl: process.env.NEXT_PUBLIC_API_PREFIX?.replace("/v0", ""),
    fetch: axiosFetcherAuth
  });

  return GET(url, {});
};

// this is the previous fetcher
export const axiosFetcher = (url: string) => {
  return axios(url).then(async (res) => {
    return res.data;
  });
};

// round it up to the 'yMax_levels' so that the y major ticks look right.
export const getRoundedTickBoundary = (
  yMax: number,
  yMax_levels: number[],
  positive: boolean = true
) => {
  for (let i = 0; i < yMax_levels.length; i++) {
    let level = yMax_levels[i];
    if (positive) {
      yMax = yMax < level ? level : yMax;
      if (yMax === level) {
        break;
      }
    } else {
      yMax = yMax > level ? level : yMax;
      if (yMax === level) {
        break;
      }
    }
  }
  return yMax;
};

export const getDeltaBucket: (delta: number) => DELTA_BUCKET = (delta) => {
  const deltaBucketKeys = getDeltaBucketKeys();
  let currentBucket = DELTA_BUCKET[deltaBucketKeys[0] as keyof typeof DELTA_BUCKET];
  for (const bucketKey of deltaBucketKeys) {
    let bucket = Number(DELTA_BUCKET[bucketKey as keyof typeof DELTA_BUCKET]);

    if (delta < 0) {
      if (delta <= bucket) {
        return bucket as DELTA_BUCKET;
      }
    } else if (delta > 0) {
      if (bucket < 0) continue;

      if (delta >= bucket) {
        currentBucket = bucket;
        if (bucket === DELTA_BUCKET.POS4) {
          return bucket as DELTA_BUCKET;
        }
      } else return currentBucket as DELTA_BUCKET;
    }
  }
  return DELTA_BUCKET.ZERO;
};

export const createBucketObject: (
  deltaBucket: DELTA_BUCKET,
  deltaGroup: GspDeltaValue[]
) => Bucket = (deltaBucket: DELTA_BUCKET, deltaGroup: GspDeltaValue[]) => {
  let bucketColor = "bg-ocf-delta-500";
  let borderColor = "border-ocf-delta-500";
  let textColor = "text-white";
  let altTextColor = "text-ocf-gray-800";
  let text = deltaBucket.toString();
  let quantity = deltaGroup.length;
  let dataKey = DELTA_BUCKET[deltaBucket];
  let lowerBound = 0;
  let upperBound = 0;
  let increment = 1;
  switch (deltaBucket) {
    case DELTA_BUCKET.NEG4:
      bucketColor = "bg-ocf-delta-100";
      borderColor = "border-ocf-delta-100";
      textColor = "text-black";
      altTextColor = "text-ocf-delta-100";
      lowerBound = -3000;
      upperBound = deltaBucket;
      break;
    case DELTA_BUCKET.NEG3:
      bucketColor = "bg-ocf-delta-200";
      borderColor = "border-ocf-delta-200";
      textColor = "text-black";
      altTextColor = "text-ocf-delta-200";
      lowerBound = DELTA_BUCKET.NEG4;
      upperBound = deltaBucket;
      break;
    case DELTA_BUCKET.NEG2:
      bucketColor = "bg-ocf-delta-300";
      borderColor = "border-ocf-delta-300";
      textColor = "text-black";
      altTextColor = "text-ocf-delta-300";
      lowerBound = DELTA_BUCKET.NEG3;
      upperBound = deltaBucket;
      break;
    case DELTA_BUCKET.NEG1:
      bucketColor = "bg-ocf-delta-400";
      borderColor = "border-ocf-delta-400";
      textColor = "text-white";
      altTextColor = "text-ocf-delta-400";
      lowerBound = DELTA_BUCKET.NEG2;
      upperBound = deltaBucket;
      break;
    case DELTA_BUCKET.ZERO:
      bucketColor = "bg-ocf-delta-500";
      borderColor = "border-white";
      textColor = "text-white";
      altTextColor = "text-ocf-gray-800";
      lowerBound = DELTA_BUCKET.NEG1;
      upperBound = DELTA_BUCKET.POS1;
      break;
    case DELTA_BUCKET.POS1:
      bucketColor = "bg-ocf-delta-600";
      borderColor = "border-ocf-delta-600";
      textColor = "text-white";
      altTextColor = "text-ocf-delta-600";
      lowerBound = deltaBucket;
      upperBound = DELTA_BUCKET.POS2;
      break;
    case DELTA_BUCKET.POS2:
      bucketColor = "bg-ocf-delta-700";
      borderColor = "border-ocf-delta-700";
      textColor = "text-black";
      altTextColor = "text-ocf-delta-700";
      lowerBound = deltaBucket;
      upperBound = DELTA_BUCKET.POS3;
      break;
    case DELTA_BUCKET.POS3:
      bucketColor = "bg-ocf-delta-800";
      borderColor = "border-ocf-delta-800";
      textColor = "text-black";
      altTextColor = "text-ocf-delta-800";
      lowerBound = deltaBucket;
      upperBound = DELTA_BUCKET.POS4;
      break;
    case DELTA_BUCKET.POS4:
      bucketColor = "bg-ocf-delta-900";
      borderColor = "border-ocf-delta-900";
      textColor = "text-black";
      altTextColor = "text-ocf-delta-900";
      lowerBound = deltaBucket;
      upperBound = 3000;
      break;
  }
  return {
    bucketColor,
    borderColor,
    textColor,
    altTextColor,
    text,
    quantity,
    dataKey,
    lowerBound,
    upperBound,
    increment
  };
};
