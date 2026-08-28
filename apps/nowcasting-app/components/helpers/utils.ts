import axios from "axios";
import { DateTime, Settings } from "luxon";
import { DISPLAY_LOCALE } from "../../lib/time/display";
import {
  DELTA_BUCKET,
  DELTA_PERCENTAGE_EDGES,
  getDeltaBucketKeys,
  MAX_NATIONAL_GENERATION_MW
} from "../../constant";
import {
  Bucket,
  CombinedSitesData,
  GspDeltaValue,
  LoadingState,
  SitesCombinedErrors,
  SitesCombinedLoading,
  SitesCombinedValidating,
  SitesEndpointStates
} from "../types.d";
import Router from "next/router";
import * as Sentry from "@sentry/nextjs";
import { ChartData } from "../charts/remix-line";
import { getAccessToken } from "../../lib/api/auth/token";

export const enableNHourView = process.env.NEXT_PUBLIC_4H_VIEW === "true";

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

/**
 * Rendering a UTC instant for a human needs a zone, and a country's zone is not GB's, so every
 * helper below takes one — plus a locale wherever it formats day/month names or date order.
 *
 * The defaults keep today's GB output for call sites not yet wired to the country registry; a
 * later Phase 3 agent passes `country.timezone` / `country.locale` explicitly, after which the
 * defaults can go. Luxon (F5) replaces the `new Date()` + `toLocaleString` arithmetic these used
 * to do, so the zone is an argument rather than whatever zone the viewer's browser happens to
 * be in.
 */
export const DEFAULT_TIMEZONE = "Europe/London";

/**
 * Re-exported from `lib/time/display.ts`, which is the single seam a future user preference
 * changes. Importing it here also applies Luxon's global default wherever formatting happens,
 * including server rendering and non-React consumers, without depending on `_app.tsx`.
 *
 * Note this is a *display* default and says nothing about zones: a country's `timezone` is
 * still its own, so an NL slot is shown at NL's wall-clock time — written the GB way.
 */
export const DEFAULT_LOCALE = DISPLAY_LOCALE;

const TIME_ONLY: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
const LONG_DATE: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
};
const NUMERIC_DATE: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "numeric",
  year: "numeric"
};

// The `new Date()` implementations these replace rendered an unparseable input as "Invalid Date"
// through `toLocaleString` and then sliced the result, and callers put that straight on screen.
// Reproduced verbatim so the Luxon migration changes no output. Phase 7 owns what a user should
// actually see here.
const INVALID_TIME = "Inval";
const INVALID_HUMAN = "Invalid Date, Inval";
const INVALID_HUMAN_NUMERIC = "Invalid Date Inval";
const INVALID_DATE_ONLY = "Invalid Date ";

/**
 * `new Date(string)` semantics, which these helpers had before Luxon: a string carrying an offset
 * is that instant, a date-only string is UTC midnight, and a zone-less date*time* is the viewer's
 * local time. That last case is a latent viewer-dependency rather than something to preserve
 * forever — Phase 4 removes it by passing canonical UTC instants from `lib/domain/time.ts` — but
 * changing it here would be a behaviour change invisible to a UTC-pinned test process.
 */
// The zone is left unspecified rather than named as "system" so that it resolves through
// Luxon's `Settings.defaultZone`, which *is* the system zone unless a test overrides it.
// Behaviour is identical in the browser; the difference is that the viewer's zone becomes
// injectable, and jest pins TZ=UTC — the one zone in which every viewer-zone bug in this
// file is invisible. See utils.viewerZone.test.ts.
const parseISOInViewerZone = (date: string): DateTime =>
  DateTime.fromISO(date, date.includes("T") ? undefined : { zone: "utc" });

const formatTime = (dt: DateTime) => dt.toLocaleString(TIME_ONLY);

export const formatDateAsZonedTime = (
  date: Date,
  timezone: string = DEFAULT_TIMEZONE,
  locale: string = DEFAULT_LOCALE
) => {
  const dt = DateTime.fromJSDate(date, { zone: timezone }).setLocale(locale);
  if (!dt.isValid) return INVALID_TIME;
  return formatTime(dt);
};

export const formatISODateStringAsZonedTime = (
  date: string,
  timezone: string = DEFAULT_TIMEZONE,
  locale: string = DEFAULT_LOCALE
) => {
  if (!date || date === ":00.000Z") return "00:00";
  const dt = parseISOInViewerZone(date).setZone(timezone).setLocale(locale);
  if (!dt.isValid) {
    throw new Error(`Invalid date: ${date}`);
  }
  return formatTime(dt);
};

/**
 * The calendar date of an instant, in a given zone — `Thu 28 Aug`.
 *
 * The zone argument is not a nicety: near midnight the same instant is two different dates in
 * GB and NL, so a date shown without one is a claim nobody can check. Every caller says which
 * zone it means, and says so in the UI too.
 *
 * Returns the marker string rather than throwing, matching the tick formatters: this feeds a
 * caption, and a caption is never worth a blank screen.
 */
export const formatISODateStringAsZonedDate = (
  date: string,
  timezone: string = DEFAULT_TIMEZONE,
  locale: string = DEFAULT_LOCALE
) => {
  if (!date) return INVALID_TIME;
  const dt = parseISOInViewerZone(date).setZone(timezone).setLocale(locale);
  if (!dt.isValid) return INVALID_TIME;
  return dt.toFormat("ccc d LLL");
};

/**
 * Shifts the instant by the target zone's offset and then serialises it with a "Z" that is a lie
 * everywhere except UTC, so downstream `new Date()` parsing reads the *wall clock* back. Kept as
 * is because several chart call sites depend on exactly that; the timezone defaults to the
 * viewer's zone, which is what it used before, and must not default to Europe/London or every
 * existing call site would shift.
 */
export const convertToLocaleDateString = (date: string, timezone?: string) => {
  // Defaulting through `Settings.defaultZone` rather than the literal "system" keeps the
  // viewer's zone injectable for tests; it *is* the system zone in the browser. See
  // parseISOInViewerZone above and utils.viewerZone.test.ts.
  const dt = parseISOInViewerZone(date).setZone(timezone ?? Settings.defaultZone);
  if (!dt.isValid) {
    throw new Error(`Invalid date: ${date}`);
  }
  return `${dt.toISO({ includeOffset: false })}Z`;
};

export const formatISODateStringHuman = (
  date: string,
  timezone: string = DEFAULT_TIMEZONE,
  locale: string = DEFAULT_LOCALE
) => dateToZonedDateTimeString(parseISOInViewerZone(date).toJSDate(), timezone, locale);

export const dateToZonedDateTimeString = (
  date: Date,
  timezone: string = DEFAULT_TIMEZONE,
  locale: string = DEFAULT_LOCALE
) => {
  const dt = DateTime.fromJSDate(date, { zone: timezone }).setLocale(locale);
  if (!dt.isValid) return INVALID_HUMAN;
  return `${dt.toLocaleString(LONG_DATE)}, ${formatTime(dt)}`;
};

// Note the trailing space, which callers concatenate onto.
export const dateToZonedDateOnlyString = (
  date: Date,
  timezone: string = DEFAULT_TIMEZONE,
  locale: string = DEFAULT_LOCALE
) => {
  const dt = DateTime.fromJSDate(date, { zone: timezone }).setLocale(locale);
  if (!dt.isValid) return INVALID_DATE_ONLY;
  return `${dt.toLocaleString(NUMERIC_DATE)} `;
};

export const formatISODateStringHumanNumbersOnly = (
  date: string,
  timezone: string = DEFAULT_TIMEZONE,
  locale: string = DEFAULT_LOCALE
) => {
  const dt = parseISOInViewerZone(date).setZone(timezone).setLocale(locale);
  if (!dt.isValid) return INVALID_HUMAN_NUMERIC;
  return `${dt.toLocaleString(NUMERIC_DATE)} ${formatTime(dt)}`;
};

/**
 * Phase 3 fix: this used to format in the *viewer's* zone with no `timeZone` option, unlike every
 * neighbouring helper, and to test "is it today?" via `toDateString()` in that same zone. A
 * late-evening UTC instant therefore labelled the previous day for a UK viewer. Both now use the
 * passed zone, which is also the zone any per-day grouping buckets in — see the note on
 * `getUtcHalfHourIndex` in chartUtils.ts for why the seasonal norms deliberately do not.
 */
export const prettyPrintDayLabelWithDate = (
  d: string | number,
  timezone: string = DEFAULT_TIMEZONE,
  locale: string = DEFAULT_LOCALE
) => {
  const dt = (typeof d === "number" ? DateTime.fromMillis(d) : parseISOInViewerZone(d))
    .setZone(timezone)
    .setLocale(locale);
  // The epoch is treated as "no value", not as 1 January 1970.
  if (!dt.isValid || dt.toMillis() === 0) return "Invalid date";
  if (dt.hasSame(DateTime.now().setZone(timezone), "day")) return "Today";
  return `${dt.toLocaleString({ weekday: "short" })} ${dt.toLocaleString({ day: "numeric" })}`;
};

/**
 * Chart tick formatter, so it must never throw: anything it cannot read comes back as a marker
 * string. It previously appended "+00:00" to any string longer than 16 characters, which threw on
 * every `Z`-suffixed timestamp — the exact spelling v1 emits. It now parses whatever zone the
 * string carries and falls back to UTC for the zone-less 16-character ticks the chart feeds it.
 */
export function prettyPrintChartAxisLabelDate(
  x: string | number,
  timezone: string = DEFAULT_TIMEZONE,
  locale: string = DEFAULT_LOCALE
) {
  if (typeof x === "number") {
    if (Number.isNaN(x)) return `Invalid datetime input: ${typeof x} – ${x}`;
    if (!x) return "Invalid date 1";
    const dt = DateTime.fromMillis(x).setZone(timezone).setLocale(locale);
    if (!dt.isValid) return "Invalid date 2";
    return formatTime(dt);
  }
  if (!x.includes("T")) return `Invalid datetime input: ${typeof x} – ${x}`;
  const dt = DateTime.fromISO(x, { zone: "utc", setZone: true })
    .setZone(timezone)
    .setLocale(locale);
  if (!dt.isValid || dt.toMillis() === 0) return "Invalid date 3";
  return formatTime(dt);
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

// Rounds down to the half hour *in the display zone*, where it used to round in the viewer's zone
// and then render the result elsewhere. The two only differ for a zone whose offset is not a whole
// number of hours, and rounding in the zone the label is read in is the answer that makes sense.
export const getRounded4HoursAgoString = (
  timezone: string = DEFAULT_TIMEZONE,
  locale: string = DEFAULT_LOCALE
) => {
  const fourHoursAgo = DateTime.now().setZone(timezone).setLocale(locale).minus({ hours: 4 });
  return formatTime(fourHoursAgo.set({ minute: fourHoursAgo.minute < 30 ? 0 : 30 }));
};

export const getRoundedPv = (pv: number, round: boolean = true, roundingFactor: number = 100) => {
  if (!round) return Math.round(pv);
  // rounding factor determines step, e.g. for 100, round to: 0, 100, 200, 300, 400, 500
  return Math.round(pv / roundingFactor) * roundingFactor;
};

export const getRoundedPvPercent = (per: number, round: boolean = true) => {
  if (!round) return per;
  // round to : 0, 0.2, 0.4, 0.6 0.8, 1
  let rounded = Math.round(per * 10);
  if (rounded % 2) {
    if (per * 10 > rounded) return (rounded + 1) / 10;
    else return (rounded - 1) / 10;
  } else return rounded / 10;
};

export const getOpacityValueFromPVNormalized = (val: number, round: boolean = true) => {
  if (!round) return val;
  // This function is to rounds the value down and then select the correct opacity

  const value = [0, 0.1, 0.2, 0.35, 0.5, 0.7, 1];
  const opacity = [0.03, 0.2, 0.4, 0.6, 0.8, 1, 1];

  // loop through the array to find the lower bound value and then select the correct opacity
  let finalVal = opacity[0];
  for (let i = 0; i < value.length; i++) {
    if (val > value[i]) {
      finalVal = opacity[i];
    }
  }

  return finalVal;
};

//this is the function I set up that would pass the accessToken from get_token.ts into the Authorization
//header or the request to the API.

export const axiosFetcherAuth = async (url: RequestInfo | URL) => {
  try {
    const accessToken = await getAccessToken();

    const res = await axios(url as string, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    return res.data;
  } catch (err: any) {
    const status = err?.response?.status;
    if (process.env.NEXT_PUBLIC_DEV_MODE !== "true" && [401, 403].includes(status)) {
      Sentry.captureException(err, {
        tags: { error: "401/403 auth error" }
      });
      // Redirect but still propagate the error to SWR
      const router = Router;
      router.push("/api/auth/logout?redirectToLogin=true");
    }

    // IMPORTANT: rethrow so SWR receives the error and onError/onErrorRetry can run
    throw err;
  }
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

/**
 * The same nine buckets, stepped on **delta as a fraction of installed capacity**.
 *
 * `DELTA_BUCKET`'s members are ordinals as far as anything downstream is concerned — the paint
 * expression steps on them, the delta panel groups by them — and only `getDeltaBucket` above
 * treats their *values* as megawatt thresholds. So percentage mode needs a second bucketer, not
 * a second set of buckets: same nine outputs, same colours, same `step` expression, different
 * quantity and different edges (`DELTA_PERCENTAGE_EDGES`, and see there for why).
 *
 * Boundary behaviour matches `getDeltaBucket` exactly: a magnitude *at* an edge belongs to the
 * outer bucket (`|d| >= 2%` leaves neutral), and everything below the first edge is `ZERO`.
 *
 * `capacity <= 0` cannot produce a fraction, so callers pass `0` and land in `ZERO`. That is
 * the honest answer — a region with no registered capacity has no percentage error — and it is
 * distinct from "no delta", which `hasDelta` carries separately and which paints as nothing.
 */
export const getDeltaBucketNormalized: (fraction: number) => DELTA_BUCKET = (fraction) => {
  const steps = DELTA_PERCENTAGE_EDGES.filter((edge) => Math.abs(fraction) >= edge).length;
  if (steps === 0) return DELTA_BUCKET.ZERO;
  const ladder =
    fraction < 0
      ? [DELTA_BUCKET.NEG1, DELTA_BUCKET.NEG2, DELTA_BUCKET.NEG3, DELTA_BUCKET.NEG4]
      : [DELTA_BUCKET.POS1, DELTA_BUCKET.POS2, DELTA_BUCKET.POS3, DELTA_BUCKET.POS4];
  return ladder[steps - 1];
};

export const createBucketObject: (
  deltaBucket: DELTA_BUCKET,
  deltaGroup: GspDeltaValue[]
) => Bucket = (deltaBucket: DELTA_BUCKET, deltaGroup: GspDeltaValue[]) => {
  let bucketColor = "bg-ocf-delta-500";
  let borderColor = "border-ocf-delta-500";
  let textColor = "text-content";
  let altTextColor = "text-surface-panel";
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
      textColor = "text-content-on-accent";
      altTextColor = "text-ocf-delta-100";
      lowerBound = -3000;
      upperBound = deltaBucket;
      break;
    case DELTA_BUCKET.NEG3:
      bucketColor = "bg-ocf-delta-200";
      borderColor = "border-ocf-delta-200";
      textColor = "text-content-on-accent";
      altTextColor = "text-ocf-delta-200";
      lowerBound = DELTA_BUCKET.NEG4;
      upperBound = deltaBucket;
      break;
    case DELTA_BUCKET.NEG2:
      bucketColor = "bg-ocf-delta-300";
      borderColor = "border-ocf-delta-300";
      textColor = "text-content-on-accent";
      altTextColor = "text-ocf-delta-300";
      lowerBound = DELTA_BUCKET.NEG3;
      upperBound = deltaBucket;
      break;
    case DELTA_BUCKET.NEG1:
      bucketColor = "bg-ocf-delta-400";
      borderColor = "border-ocf-delta-400";
      textColor = "text-content";
      altTextColor = "text-ocf-delta-400";
      lowerBound = DELTA_BUCKET.NEG2;
      upperBound = deltaBucket;
      break;
    case DELTA_BUCKET.ZERO:
      bucketColor = "bg-ocf-delta-500";
      borderColor = "border-content";
      textColor = "text-content";
      altTextColor = "text-surface-panel";
      lowerBound = DELTA_BUCKET.NEG1;
      upperBound = DELTA_BUCKET.POS1;
      break;
    case DELTA_BUCKET.POS1:
      bucketColor = "bg-ocf-delta-600";
      borderColor = "border-ocf-delta-600";
      textColor = "text-content";
      altTextColor = "text-ocf-delta-600";
      lowerBound = deltaBucket;
      upperBound = DELTA_BUCKET.POS2;
      break;
    case DELTA_BUCKET.POS2:
      bucketColor = "bg-ocf-delta-700";
      borderColor = "border-ocf-delta-700";
      textColor = "text-content-on-accent";
      altTextColor = "text-ocf-delta-700";
      lowerBound = deltaBucket;
      upperBound = DELTA_BUCKET.POS3;
      break;
    case DELTA_BUCKET.POS3:
      bucketColor = "bg-ocf-delta-800";
      borderColor = "border-ocf-delta-800";
      textColor = "text-content-on-accent";
      altTextColor = "text-ocf-delta-800";
      lowerBound = deltaBucket;
      upperBound = DELTA_BUCKET.POS4;
      break;
    case DELTA_BUCKET.POS4:
      bucketColor = "bg-ocf-delta-900";
      borderColor = "border-ocf-delta-900";
      textColor = "text-content-on-accent";
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
export function calculateChartYMax(
  chartData: ChartData[],
  maxY: number = MAX_NATIONAL_GENERATION_MW
): number {
  if (!chartData || chartData.length === 0) {
    // If there is no data, return the default maxY value
    return maxY;
  }

  const maxDataValue = Math.max(
    0,
    ...chartData.flatMap((dataPoint) =>
      Object.entries(dataPoint)
        .filter(([key, value]) => typeof value === "number" && key !== "formattedDate")
        .map(([_, value]) => value as number)
    )
  );

  const valueWithBuffer = maxDataValue + 100;
  const roundingFactor = 500;

  return Math.max(Math.ceil(valueWithBuffer / roundingFactor) * roundingFactor, maxY);
}
