#!/usr/bin/env node

import { DateTime } from "luxon";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "../../..");
const fixturesDir = path.join(appRoot, "cypress", "fixtures");

// Load .env file
dotenv.config({ path: path.join(appRoot, ".env") });

const requireEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

const getNext30MinSlot = (isoTime) => {
  if (isoTime.getMinutes() === 30) {
    isoTime.setHours(isoTime.getHours() + 1);
    isoTime.setMinutes(0, 0, 0);
  } else if (isoTime.getMinutes() < 30) {
    isoTime.setHours(isoTime.getHours());
    isoTime.setMinutes(30, 0, 0);
  } else {
    isoTime.setHours(isoTime.getHours() + 1);
    isoTime.setMinutes(0, 0, 0);
  }
  return isoTime;
};

const get30MinNow = (baseTime, offsetMinutes = 0) => {
  let date = baseTime.toUTC();
  if (offsetMinutes !== 0) {
    date = date.plus({ minutes: offsetMinutes });
  }
  const jsDate = getNext30MinSlot(date.toJSDate());
  return DateTime.fromJSDate(jsDate).toUTC().toISO();
};

const getEarliestForecastTimestamp = (baseTime) => {
  const nowLocal = baseTime.toLocal();
  const twoDaysAgoLocal = nowLocal.minus({ days: 2 });
  const roundedDownLocal = twoDaysAgoLocal.startOf("hour").minus({
    hours: twoDaysAgoLocal.hour % 6
  });
  return roundedDownLocal.toUTC().toISO();
};

const withUiFlag = (url) => (url.includes("?") ? `${url}&UI=true` : `${url}?UI=true`);

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Request failed ${response.status}: ${url}\n${text}`);
  }
  return response.json();
};

const getAccessToken = async () => {
  const auth0Domain = (process.env.NEXT_PUBLIC_AUTH0_DOMAIN).replace(/^https?:\/\//, "");
  const clientId = process.env.NEXT_PUBLIC_AUTH0_CLIENTID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;
  const username = process.env.NEXT_PUBLIC_AUTH0_USERNAME;
  const password = process.env.NEXT_PUBLIC_AUTH0_PASSWORD;

  const audience = process.env.NEXT_PUBLIC_AUTH0_AUDIENCE;
  const scope = process.env.NEXT_PUBLIC_AUTH0_SCOPE;

  const tokenUrl = `https://${auth0Domain}/oauth/token`;

  const body = {
    grant_type: "password",
    username,
    password,
    audience,
    scope,
    client_id: clientId,
    client_secret: clientSecret
  };

  const tokenResponse = await fetchJson(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!tokenResponse.access_token) {
    throw new Error("Auth0 token response missing access_token");
  }

  return tokenResponse.access_token;
};
const writeFixture = async (name, data) => {
  const filePath = path.join(fixturesDir, name);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
};

const main = async () => {
  const apiPrefix = process.env.NEXT_PUBLIC_API_PREFIX || "https://api-dev.quartz.solar/v0";
  const sitesApiPrefix =
    process.env.NEXT_PUBLIC_SITES_API_PREFIX || "https://api-site-dev.quartz.solar";

  const referenceTime = process.env.FIXTURE_REFERENCE_TIME
    ? DateTime.fromISO(process.env.FIXTURE_REFERENCE_TIME).toUTC()
    : DateTime.utc();
  const nHourForecast = Number(process.env.FIXTURE_N_HOUR_FORECAST || 4);
  if (!Number.isFinite(nHourForecast) || nHourForecast <= 0) {
    throw new Error("FIXTURE_N_HOUR_FORECAST must be a positive number");
  }

  const selectedISOTime = get30MinNow(referenceTime);
  const selectedTime = DateTime.fromISO(selectedISOTime).toUTC().toISO().slice(0, 16);
  const targetTime = `${DateTime.fromISO(selectedTime).toUTC().toISO().slice(0, 19)}+00:00`;
  const actualsLastFetch30MinISO = get30MinNow(referenceTime, -30);
  const actualsStart = `${actualsLastFetch30MinISO.slice(0, 19)}+00:00`;
  const historicForecastStart = getEarliestForecastTimestamp(referenceTime);
  const nMinuteForecast = nHourForecast * 60;

  await fs.mkdir(fixturesDir, { recursive: true });

  const accessToken = await getAccessToken();
  const authedFetch = (url) =>
    fetchJson(url, { headers: { Authorization: `Bearer ${accessToken}` } });

  const solarStatus = await authedFetch(withUiFlag(`${apiPrefix}/solar/GB/status`));
  await writeFixture("solar_status.json", solarStatus);

  const gspList = await authedFetch(withUiFlag(`${apiPrefix}/system/GB/gsp/`));
  await writeFixture("gsp_system_list.json", gspList);

  const sampleGsp = Array.isArray(gspList)
    ? gspList.find((entry) => Number(entry.gspId) > 0)
    : null;
  if (!sampleGsp) {
    throw new Error("Unable to pick a sample GSP id from /system/GB/gsp/");
  }
  const sampleGspId = Number(sampleGsp.gspId);

  const gspZones = await authedFetch(withUiFlag(`${apiPrefix}/system/GB/gsp/?zones=true`));
  await writeFixture("gsp_system_zones.json", gspZones);

  const gspSingle = await authedFetch(withUiFlag(`${apiPrefix}/system/GB/gsp/?gsp_id=${sampleGspId}`));
  await writeFixture("gsp_system_single.json", gspSingle);

  const nationalForecastBlend = await authedFetch(
    withUiFlag(
      `${apiPrefix}/solar/GB/national/forecast?historic=false&only_forecast_values=true&model_name=blend&trend_adjuster_on=true`
    )
  );
  await writeFixture("national_forecast_blend.json", nationalForecastBlend);

  const nationalForecastPvnetEcmwf = await authedFetch(
    withUiFlag(
      `${apiPrefix}/solar/GB/national/forecast?include_metadata=false&model_name=pvnet_intraday_ecmwf_only&trend_adjuster_on=true`
    )
  );
  await writeFixture("national_forecast_pvnet_intraday_ecmwf_only.json", nationalForecastPvnetEcmwf);

  const nationalForecastPvnetDayAhead = await authedFetch(
    withUiFlag(
      `${apiPrefix}/solar/GB/national/forecast?include_metadata=false&model_name=pvnet_day_ahead&trend_adjuster_on=true`
    )
  );
  await writeFixture("national_forecast_pvnet_day_ahead.json", nationalForecastPvnetDayAhead);

  const nationalForecastPvnetIntraday = await authedFetch(
    withUiFlag(
      `${apiPrefix}/solar/GB/national/forecast?include_metadata=false&model_name=pvnet_intraday&trend_adjuster_on=true`
    )
  );
  await writeFixture("national_forecast_pvnet_intraday.json", nationalForecastPvnetIntraday);

  const nationalForecastMetOffice = await authedFetch(
    withUiFlag(
      `${apiPrefix}/solar/GB/national/forecast?include_metadata=false&model_name=pvnet_intraday_met_office_only&trend_adjuster_on=true`
    )
  );
  await writeFixture("national_forecast_pvnet_intraday_met_office_only.json", nationalForecastMetOffice);

  const nationalForecastSatOnly = await authedFetch(
    withUiFlag(
      `${apiPrefix}/solar/GB/national/forecast?include_metadata=false&model_name=pvnet_intraday_sat_only&trend_adjuster_on=true`
    )
  );
  await writeFixture("national_forecast_pvnet_intraday_sat_only.json", nationalForecastSatOnly);

  const nationalPvLiveInDay = await authedFetch(
    withUiFlag(`${apiPrefix}/solar/GB/national/pvlive?regime=in-day`)
  );
  await writeFixture("national_pvlive_in_day.json", nationalPvLiveInDay);

  const nationalPvLiveDayAfter = await authedFetch(
    withUiFlag(`${apiPrefix}/solar/GB/national/pvlive?regime=day-after`)
  );
  await writeFixture("national_pvlive_day_after.json", nationalPvLiveDayAfter);

  const nationalNHourForecast = await authedFetch(
    withUiFlag(
      `${apiPrefix}/solar/GB/national/forecast?forecast_horizon_minutes=${nMinuteForecast}&historic=true&only_forecast_values=true`
    )
  );
  await writeFixture("national_forecast_n_hour.json", nationalNHourForecast);

  const gspForecastTarget = await authedFetch(
    withUiFlag(
      `${apiPrefix}/solar/GB/gsp/forecast/all/?compact=true&start_datetime_utc=${encodeURIComponent(
        targetTime
      )}&end_datetime_utc=${encodeURIComponent(targetTime)}`
    )
  );
  await writeFixture("gsp_forecast_all_target.json", gspForecastTarget);

    const gspForecastHistoric = await authedFetch(
    withUiFlag(
        `${apiPrefix}/solar/GB/gsp/forecast/all/?compact=true&historic=true&start_datetime_utc=${encodeURIComponent(
        historicForecastStart
        )}&end_datetime_utc=${encodeURIComponent(historicForecastStart)}`
    )
    );
  await writeFixture("gsp_forecast_all_historic.json", gspForecastHistoric);

  const gspPvLiveFuture = await authedFetch(
    withUiFlag(
      `${apiPrefix}/solar/GB/gsp/pvlive/all?regime=in-day&compact=true&compact=true&start_datetime_utc=${encodeURIComponent(
        actualsStart
      )}`
    )
  );
  await writeFixture("gsp_pvlive_all_in_day.json", gspPvLiveFuture);

  const gspPvLiveHistoric = await authedFetch(
    withUiFlag(
      `${apiPrefix}/solar/GB/gsp/pvlive/all?compact=true&end_datetime_utc=${encodeURIComponent(
        actualsStart
      )}`
    )
  );
  await writeFixture("gsp_pvlive_all_historic.json", gspPvLiveHistoric);

  const gspPvLiveDayAfter = await authedFetch(
    withUiFlag(`${apiPrefix}/solar/GB/gsp/pvlive/all?regime=day-after&compact=true`)
  );
  await writeFixture("gsp_pvlive_all_day_after.json", gspPvLiveDayAfter);

  const gspNHourForecast = await authedFetch(
    withUiFlag(
      `${apiPrefix}/solar/GB/gsp/${sampleGspId}/forecast?forecast_horizon_minutes=${nMinuteForecast}&historic=true&only_forecast_values=true`
    )
  );
  await writeFixture("gsp_forecast_n_hour.json", gspNHourForecast);

  const sitesStatus = await authedFetch(withUiFlag(`${sitesApiPrefix}/api_status`));
  await writeFixture("sites_status.json", sitesStatus);

  const sitesList = await authedFetch(withUiFlag(`${sitesApiPrefix}/sites`));
  await writeFixture("sites_list.json", sitesList);

  const siteUuids = Array.isArray(sitesList?.site_list)
    ? sitesList.site_list
        .filter((site) => !String(site.client_site_name || "").startsWith("nl_"))
        .slice(0, 100)
        .map((site) => site.site_uuid)
        .filter(Boolean)
    : [];
  const siteUuidsString = siteUuids.join(",");
  if (!siteUuidsString) {
    throw new Error("No site UUIDs found in /sites response for fixtures");
  }

  const sitesPvForecast = await authedFetch(
    withUiFlag(`${sitesApiPrefix}/sites/pv_forecast?site_uuids=${siteUuidsString}`)
  );
  await writeFixture("sites_pv_forecast.json", sitesPvForecast);

  const sitesPvActual = await authedFetch(
    withUiFlag(`${sitesApiPrefix}/sites/pv_actual?site_uuids=${siteUuidsString}`)
  );
  await writeFixture("sites_pv_actual.json", sitesPvActual);

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    referenceTime: referenceTime.toUTC().toISO(),
    nHourForecast,
    routes: [
      {
        id: "solar-status",
        method: "GET",
        pattern: "/\\/v0\\/solar\\/GB\\/status\\??.*UI=true/",
        fixture: "solar_status.json"
      },
      {
        id: "gsp-system-zones",
        method: "GET",
        pattern: "/\\/v0\\/system\\/GB\\/gsp\\/\\?[^#]*zones=true.*UI=true/",
        fixture: "gsp_system_zones.json"
      },
      {
        id: "gsp-system-by-id",
        method: "GET",
        pattern: "/\\/v0\\/system\\/GB\\/gsp\\/\\?[^#]*gsp_id=\\d+.*UI=true/",
        fixture: "gsp_system_single.json"
      },
      {
        id: "gsp-system-list",
        method: "GET",
        pattern: "/\\/v0\\/system\\/GB\\/gsp\\/\\?[^#]*UI=true/",
        fixture: "gsp_system_list.json"
      },
      {
        id: "national-forecast-blend",
        method: "GET",
        pattern:
          "/\\/v0\\/solar\\/GB\\/national\\/forecast\\?.*model_name=blend.*trend_adjuster_on=true.*UI=true/",
        fixture: "national_forecast_blend.json"
      },
      {
        id: "national-forecast-pvnet-intraday-ecmwf-only",
        method: "GET",
        pattern:
          "/\\/v0\\/solar\\/GB\\/national\\/forecast\\?.*model_name=pvnet_intraday_ecmwf_only.*trend_adjuster_on=true.*UI=true/",
        fixture: "national_forecast_pvnet_intraday_ecmwf_only.json"
      },
      {
        id: "national-forecast-pvnet-day-ahead",
        method: "GET",
        pattern:
          "/\\/v0\\/solar\\/GB\\/national\\/forecast\\?.*model_name=pvnet_day_ahead.*trend_adjuster_on=true.*UI=true/",
        fixture: "national_forecast_pvnet_day_ahead.json"
      },
      {
        id: "national-forecast-pvnet-intraday",
        method: "GET",
        pattern:
          "/\\/v0\\/solar\\/GB\\/national\\/forecast\\?.*model_name=pvnet_intraday.*trend_adjuster_on=true.*UI=true/",
        fixture: "national_forecast_pvnet_intraday.json"
      },
      {
        id: "national-forecast-pvnet-met-office-only",
        method: "GET",
        pattern:
          "/\\/v0\\/solar\\/GB\\/national\\/forecast\\?.*model_name=pvnet_intraday_met_office_only.*trend_adjuster_on=true.*UI=true/",
        fixture: "national_forecast_pvnet_intraday_met_office_only.json"
      },
      {
        id: "national-forecast-pvnet-sat-only",
        method: "GET",
        pattern:
          "/\\/v0\\/solar\\/GB\\/national\\/forecast\\?.*model_name=pvnet_intraday_sat_only.*trend_adjuster_on=true.*UI=true/",
        fixture: "national_forecast_pvnet_intraday_sat_only.json"
      },
      {
        id: "national-pvlive-in-day",
        method: "GET",
        pattern: "/\\/v0\\/solar\\/GB\\/national\\/pvlive\\?.*regime=in-day.*UI=true/",
        fixture: "national_pvlive_in_day.json"
      },
      {
        id: "national-pvlive-day-after",
        method: "GET",
        pattern: "/\\/v0\\/solar\\/GB\\/national\\/pvlive\\?.*regime=day-after.*UI=true/",
        fixture: "national_pvlive_day_after.json"
      },
      {
        id: "national-forecast-n-hour",
        method: "GET",
        pattern:
          "/\\/v0\\/solar\\/GB\\/national\\/forecast\\?.*forecast_horizon_minutes=\\d+.*historic=true.*only_forecast_values=true.*UI=true/",
        fixture: "national_forecast_n_hour.json"
      },
      {
        id: "gsp-forecast-all-target",
        method: "GET",
        pattern:
          "/\\/v0\\/solar\\/GB\\/gsp\\/forecast\\/all\\/\\?.*compact=true.*start_datetime_utc=.*end_datetime_utc=.*UI=true/",
        fixture: "gsp_forecast_all_target.json"
      },
      {
        id: "gsp-forecast-all-historic",
        method: "GET",
        pattern:
          "/\\/v0\\/solar\\/GB\\/gsp\\/forecast\\/all\\/\\?.*historic=true.*start_datetime_utc=.*UI=true/",
        fixture: "gsp_forecast_all_historic.json"
      },
      {
        id: "gsp-forecast-all-by-ids",
        method: "GET",
        pattern:
          "/\\/v0\\/solar\\/GB\\/gsp\\/forecast\\/all\\/\\?.*gsp_ids=.*historic=true.*start_datetime_utc=.*UI=true/",
        fixture: "gsp_forecast_all_historic.json"
      },
      {
        id: "gsp-pvlive-all-future",
        method: "GET",
        pattern:
          "/\\/v0\\/solar\\/GB\\/gsp\\/pvlive\\/all\\?.*regime=in-day.*start_datetime_utc=.*UI=true/",
        fixture: "gsp_pvlive_all_in_day.json"
      },
      {
        id: "gsp-pvlive-all-historic",
        method: "GET",
        pattern:
          "/\\/v0\\/solar\\/GB\\/gsp\\/pvlive\\/all\\?.*end_datetime_utc=.*UI=true/",
        fixture: "gsp_pvlive_all_historic.json"
      },
      {
        id: "gsp-pvlive-by-ids-in-day",
        method: "GET",
        pattern:
          "/\\/v0\\/solar\\/GB\\/gsp\\/pvlive\\/all\\?.*gsp_ids=.*regime=in-day.*UI=true/",
        fixture: "gsp_pvlive_all_in_day.json"
      },
      {
        id: "gsp-pvlive-by-ids-day-after",
        method: "GET",
        pattern:
          "/\\/v0\\/solar\\/GB\\/gsp\\/pvlive\\/all\\?.*gsp_ids=.*regime=day-after.*UI=true/",
        fixture: "gsp_pvlive_all_day_after.json"
      },
      {
        id: "gsp-pvlive-all-day-after",
        method: "GET",
        pattern:
          "/\\/v0\\/solar\\/GB\\/gsp\\/pvlive\\/all\\?.*regime=day-after.*UI=true/",
        fixture: "gsp_pvlive_all_day_after.json"
      },
      {
        id: "gsp-forecast-n-hour",
        method: "GET",
        pattern:
          "/\\/v0\\/solar\\/GB\\/gsp\\/\\d+\\/forecast\\?.*forecast_horizon_minutes=\\d+.*historic=true.*only_forecast_values=true.*UI=true/",
        fixture: "gsp_forecast_n_hour.json"
      },
      {
        id: "sites-status",
        method: "GET",
        pattern: "/\\/api_status\\??.*UI=true/",
        fixture: "sites_status.json"
      },
      {
        id: "sites-list",
        method: "GET",
        pattern: "/\\/sites\\??.*UI=true/",
        fixture: "sites_list.json"
      },
      {
        id: "sites-pv-forecast",
        method: "GET",
        pattern: "/\\/sites\\/pv_forecast\\?.*site_uuids=.*UI=true/",
        fixture: "sites_pv_forecast.json"
      },
      {
        id: "sites-pv-actual",
        method: "GET",
        pattern: "/\\/sites\\/pv_actual\\?.*site_uuids=.*UI=true/",
        fixture: "sites_pv_actual.json"
      }
    ]
  };

  await fs.writeFile(path.join(fixturesDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log("Fixtures updated");
  console.log(`Reference time: ${manifest.referenceTime}`);
  console.log(`GSP sample id: ${sampleGspId}`);
  console.log(`Site UUID count: ${siteUuids.length}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
