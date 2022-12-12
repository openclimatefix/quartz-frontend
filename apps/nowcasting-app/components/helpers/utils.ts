import axios from "axios";
import { API_PREFIX } from "../../constant";
import { NextApiRequest, NextApiResponse } from "next";
import Router from "next/router";
import * as Sentry from "@sentry/nextjs";

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
  const router = Router;

  return axios(url, { headers: { Authorization: `Bearer ${accessToken}` } })
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
        router.push("/api/auth/logout");
      }
    });
};

// this is the previous fetcher
export const axiosFetcher = (url: string) => {
  return axios(url).then(async (res) => {
    return res.data;
  });
};
