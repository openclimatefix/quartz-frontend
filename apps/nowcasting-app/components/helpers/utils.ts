import axios from "axios";
import { API_PREFIX, DELTA_BUCKET, getDeltaBucketKeys } from "../../constant";
import { NextApiRequest, NextApiResponse } from "next";
import { GspDeltaValue } from "../types";

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
export const convertISODateStringToLondonTime = (date: string) => {
  // Changes the ISO date string to Europe London time, and return time only
  const d = new Date(date);
  const date_london_time_str = d
    .toLocaleTimeString("en-GB", { timeZone: "Europe/London" })
    .slice(0, 5);

  return date_london_time_str;
};

export const formatISODateStringHuman = (date: string) => {
  // Change date to nice human readable format.
  // Note that this converts the string to Europe London Time
  // timezone and seconds are removed

  const d = new Date(date);

  const date_london = d.toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London"
  });
  const date_london_time = d.toLocaleTimeString("en-GB", { timeZone: "Europe/London" }).slice(0, 5);

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

export const MWtoGW = (MW: number) => {
  return (MW / 1000).toFixed(1);
};
export const KWtoGW = (MW: number) => {
  return (MW / 1000 / 1000).toFixed(1);
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

//this is the function I set up that would pass the accessToken from get_token.ts into the Authorization
//header or the request to the API.

export const axiosFetcherAuth = async (url: string) => {
  const response = await fetch("/api/get_token");
  const { accessToken } = await response.json();

  return axios(url, { headers: { Authorization: `Bearer ${accessToken}` } }).then(async (res) => {
    return res.data;
  });
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
    // let nextBucket = DELTA_BUCKET[0];

    let bucket = Number(DELTA_BUCKET[bucketKey as keyof typeof DELTA_BUCKET]);

    // let currentBucketIndex = deltaBucketKeys.indexOf(bucketKey);
    // let nextBucketIndex = currentBucketIndex + 1;
    // let nextBucket = Number(
    //   DELTA_BUCKET[deltaBucketKeys[nextBucketIndex] as keyof typeof DELTA_BUCKET]
    // );
    // console.log("currentBucketIndex", currentBucketIndex);
    // console.log("bucket", bucketKey, bucket);
    // console.log("bucket", bucket, "nextBucket", nextBucket);
    // if (isNaN(Number(bucket))) continue;

    if (delta < 0) {
      if (delta <= bucket) {
        return bucket as DELTA_BUCKET;
      }
    } else if (delta > 0) {
      if (bucket < 0) continue;

      if (delta >= bucket) {
        // return bucket as DELTA_BUCKET;
        currentBucket = bucket;
        if (bucket === DELTA_BUCKET.POS4) {
          return bucket as DELTA_BUCKET;
        }
      } else return currentBucket as DELTA_BUCKET;
    }
  }
  return DELTA_BUCKET.ZERO;
};

export const createBucketObject = (deltaBucket: DELTA_BUCKET, deltaGroup: GspDeltaValue[]) => {
  let bucketColor = "bg-ocf-delta-500";
  let borderColor = "border-ocf-delta-500";
  let textColour = "text-white";
  let altTextColour = "text-ocf-gray-800";
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
      textColour = "text-black";
      altTextColour = "text-ocf-delta-100";
      lowerBound = -3000;
      upperBound = deltaBucket;
      break;
    case DELTA_BUCKET.NEG3:
      bucketColor = "bg-ocf-delta-200";
      borderColor = "border-ocf-delta-200";
      textColour = "text-black";
      altTextColour = "text-ocf-delta-200";
      lowerBound = DELTA_BUCKET.NEG4;
      upperBound = deltaBucket;
      break;
    case DELTA_BUCKET.NEG2:
      bucketColor = "bg-ocf-delta-300";
      borderColor = "border-ocf-delta-300";
      textColour = "text-black";
      altTextColour = "text-ocf-delta-300";
      lowerBound = DELTA_BUCKET.NEG3;
      upperBound = deltaBucket;
      break;
    case DELTA_BUCKET.NEG1:
      bucketColor = "bg-ocf-delta-400";
      borderColor = "border-ocf-delta-400";
      textColour = "text-white";
      altTextColour = "text-ocf-delta-400";
      lowerBound = DELTA_BUCKET.NEG2;
      upperBound = deltaBucket;
      break;
    case DELTA_BUCKET.ZERO:
      bucketColor = "bg-ocf-delta-500";
      borderColor = "border-ocf-gray-800";
      textColour = "text-white border-white border-2";
      altTextColour = "text-ocf-gray-800";
      lowerBound = DELTA_BUCKET.NEG1;
      upperBound = DELTA_BUCKET.POS1;
      break;
    case DELTA_BUCKET.POS1:
      bucketColor = "bg-ocf-delta-600";
      borderColor = "border-ocf-delta-600";
      textColour = "text-white";
      altTextColour = "text-ocf-delta-600";
      lowerBound = deltaBucket;
      upperBound = DELTA_BUCKET.POS2;
      break;
    case DELTA_BUCKET.POS2:
      bucketColor = "bg-ocf-delta-700";
      borderColor = "border-ocf-delta-700";
      textColour = "text-black";
      altTextColour = "text-ocf-delta-700";
      lowerBound = deltaBucket;
      upperBound = DELTA_BUCKET.POS3;
      break;
    case DELTA_BUCKET.POS3:
      bucketColor = "bg-ocf-delta-800";
      borderColor = "border-ocf-delta-800";
      textColour = "text-black";
      altTextColour = "text-ocf-delta-800";
      lowerBound = deltaBucket;
      upperBound = DELTA_BUCKET.POS4;
      break;
    case DELTA_BUCKET.POS4:
      bucketColor = "bg-ocf-delta-900";
      borderColor = "border-ocf-delta-900";
      textColour = "text-black";
      altTextColour = "text-ocf-delta-900";
      lowerBound = deltaBucket;
      upperBound = 3000;
      break;
  }
  return {
    bucketColor,
    borderColor,
    textColour,
    altTextColour,
    text,
    quantity,
    dataKey,
    lowerBound,
    upperBound,
    increment
  };
};
