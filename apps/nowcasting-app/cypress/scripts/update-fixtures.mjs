// `yarn fixtures:update`: fetches every URL below with the test account's token and writes each
// response to cypress/fixtures/, where the Cypress tests serve them as the API.

import fs from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";

const appRoot = path.resolve(import.meta.dirname, "../..");
const fixturesDir = path.join(appRoot, "cypress/fixtures");

for (const file of [".env.local", ".env"]) {
  const envPath = path.join(appRoot, file);
  if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
}

const apis = {
  v1: process.env.NEXT_PUBLIC_API_V1_PREFIX,
  v0: process.env.NEXT_PUBLIC_API_PREFIX,
  sites: process.env.NEXT_PUBLIC_SITES_API_PREFIX
};

if (!apis.v1 || !apis.v0 || !apis.sites)
  throw new Error(
    "Missing NEXT_PUBLIC_API_V1_PREFIX, NEXT_PUBLIC_API_PREFIX, or NEXT_PUBLIC_SITES_API_PREFIX"
  );

// Set the clock to 12UTC for consistency
const noonToday = DateTime.utc().startOf("day").set({ hour: 12 });
const now = noonToday > DateTime.utc() ? noonToday.minus({ days: 1 }) : noonToday;
const nowUtc = now.toISO({ suppressMilliseconds: true });
const start = now.minus({ days: 2 }).toISO({ suppressMilliseconds: true });

// When adding a new country add a new entry here for a subregion of that country
const gsp = "abha1"; //UK
const province = "utrecht"; //NL
const tso = "50hertz"; //DE

//List of URL's, Update if query parameters change, or if new endpoints are added to the API.
const urls = [
  ["v1", "/countries"],
  ["v1", "/sources"],

  ["v1", "/GB/solar/region-types"],
  ["v1", "/GB/solar/generation-sources"],
  ["v1", "/GB/solar/regions?region_type=national"],
  ["v1", "/GB/solar/regions?region_type=gsp"],
  ["v1", `/GB/solar/regions/national/forecast?start_utc=${start}`],
  ["v1", `/GB/solar/regions/national/forecast?start_utc=${start}&model=blend`],
  ["v1", `/GB/solar/regions/national/forecast?start_utc=${start}&model=pvnet_ecmwf`],
  ["v1", `/GB/solar/regions/national/forecast?start_utc=${start}&model=pvnet_ukv`],
  ["v1", `/GB/solar/regions/national/forecast?start_utc=${start}&model=pvnet_sat`],
  ["v1", `/GB/solar/regions/national/forecast?start_utc=${start}&horizon_minutes=240`],
  ["v1", "/GB/solar/regions/national/forecast/last-updated"],
  // Generation ends at "now": the header shows the latest reading, which must match the clock.
  [
    "v1",
    `/GB/solar/regions/national/generation?observer=pvlive_in_day&start_utc=${start}&end_utc=${nowUtc}`
  ],
  [
    "v1",
    `/GB/solar/regions/national/generation?observer=pvlive_day_after&start_utc=${start}&end_utc=${nowUtc}`
  ],
  ["v1", `/GB/solar/forecasts/snapshot?region_type=gsp&time_utc=${nowUtc}`],
  ["v1", "/GB/solar/forecasts/period?region_type=gsp"],
  ["v1", `/GB/solar/generation/snapshot?region_type=gsp&observer=pvlive_in_day&time_utc=${nowUtc}`],
  [
    "v1",
    `/GB/solar/generation/snapshot?region_type=gsp&observer=pvlive_day_after&time_utc=${nowUtc}`
  ],
  ["v1", "/GB/solar/generation/period?region_type=gsp&observer=pvlive_in_day"],
  ["v1", "/GB/solar/generation/period?region_type=gsp&observer=pvlive_day_after"],

  ["v1", `/GB/solar/regions/${gsp}/forecast?start_utc=${start}`],
  ["v1", `/GB/solar/regions/${gsp}/forecast?start_utc=${start}&horizon_minutes=240`],
  [
    "v1",
    `/GB/solar/regions/${gsp}/generation?observer=pvlive_in_day&start_utc=${start}&end_utc=${nowUtc}`
  ],
  [
    "v1",
    `/GB/solar/regions/${gsp}/generation?observer=pvlive_day_after&start_utc=${start}&end_utc=${nowUtc}`
  ],

  ["v1", "/NL/solar/region-types"],
  ["v1", "/NL/solar/generation-sources"],
  ["v1", "/NL/solar/regions?region_type=national"],
  ["v1", "/NL/solar/regions?region_type=province"],
  ["v1", `/NL/solar/regions/national/forecast?start_utc=${start}`],
  ["v1", `/NL/solar/regions/national/forecast?start_utc=${start}&model=blend`],
  ["v1", `/NL/solar/regions/national/forecast?start_utc=${start}&horizon_minutes=240`],
  ["v1", "/NL/solar/regions/national/forecast/last-updated"],
  [
    "v1",
    `/NL/solar/regions/national/generation?observer=ned_nl&start_utc=${start}&end_utc=${nowUtc}`
  ],
  ["v1", `/NL/solar/forecasts/snapshot?region_type=province&time_utc=${nowUtc}`],
  ["v1", "/NL/solar/forecasts/period?region_type=province"],
  ["v1", `/NL/solar/generation/snapshot?region_type=province&observer=ned_nl&time_utc=${nowUtc}`],
  ["v1", "/NL/solar/generation/period?region_type=province&observer=ned_nl"],

  ["v1", `/NL/solar/regions/${province}/forecast?start_utc=${start}`],
  ["v1", `/NL/solar/regions/${province}/forecast?start_utc=${start}&horizon_minutes=240`],
  [
    "v1",
    `/NL/solar/regions/${province}/generation?observer=ned_nl&start_utc=${start}&end_utc=${nowUtc}`
  ],

  ["v1", "/DE/solar/region-types"],
  ["v1", "/DE/solar/generation-sources"],
  ["v1", "/DE/solar/regions?region_type=national"],
  ["v1", "/DE/solar/regions?region_type=tso"],
  ["v1", `/DE/solar/regions/national/forecast?start_utc=${start}`],
  ["v1", `/DE/solar/regions/national/forecast?start_utc=${start}&model=blend`],
  ["v1", `/DE/solar/regions/national/forecast?start_utc=${start}&model=ecmwf`],
  ["v1", `/DE/solar/regions/national/forecast?start_utc=${start}&model=mo`],
  ["v1", `/DE/solar/regions/national/forecast?start_utc=${start}&model=sat_8h`],
  ["v1", `/DE/solar/regions/national/forecast?start_utc=${start}&horizon_minutes=240`],
  ["v1", "/DE/solar/regions/national/forecast/last-updated"],
  [
    "v1",
    `/DE/solar/regions/national/generation?observer=entsoe_de&start_utc=${start}&end_utc=${nowUtc}`
  ],
  ["v1", `/DE/solar/forecasts/snapshot?region_type=tso&time_utc=${nowUtc}`],
  ["v1", "/DE/solar/forecasts/period?region_type=tso"],
  ["v1", `/DE/solar/generation/snapshot?region_type=tso&observer=entsoe_de&time_utc=${nowUtc}`],
  ["v1", "/DE/solar/generation/period?region_type=tso&observer=entsoe_de"],

  ["v1", `/DE/solar/regions/${tso}/forecast?start_utc=${start}`],
  ["v1", `/DE/solar/regions/${tso}/forecast?start_utc=${start}&horizon_minutes=240`],
  [
    "v1",
    `/DE/solar/regions/${tso}/generation?observer=entsoe_de&start_utc=${start}&end_utc=${nowUtc}`
  ],

  ["v0", "/solar/GB/status?UI=true"],

  // The header's status check, on every page. The Sites tab itself is not tested yet.
  ["sites", "/api_status?UI=true"]
];

async function getToken() {
  const response = await fetch(`https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "password",
      username: process.env.NEXT_PUBLIC_AUTH0_USERNAME,
      password: process.env.NEXT_PUBLIC_AUTH0_PASSWORD,
      audience: process.env.NEXT_PUBLIC_AUTH0_API_AUDIENCE,
      scope: "openid profile email",
      client_id: process.env.AUTH0_CLIENT_ID,
      client_secret: process.env.AUTH0_CLIENT_SECRET
    })
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(`Auth0 login failed (${response.status}): ${JSON.stringify(body)}`);
  return body.access_token;
}

// Writes one fixture, named the same way as cypress/support/fixture-file.ts (the mock uses that
// to find it): change both together.
function updateFile(api, url, body) {
  const ignored = [
    "UI",
    "start_utc",
    "end_utc",
    "time_utc",
    "timestamp",
    "creation_limit_utc",
    "site_uuids",
    "region_names"
  ];
  const { pathname, searchParams } = new URL(apis[api] + url);
  const basePath = new URL(apis[api]).pathname.replace(/\/$/, "");
  const values = [...searchParams.entries()]
    .filter(([key]) => !ignored.includes(key))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value);
  const name = [api, ...pathname.slice(basePath.length).split("/").filter(Boolean), ...values]
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "_");

  fs.writeFileSync(path.join(fixturesDir, `${name}.json`), JSON.stringify(body, null, 2) + "\n");
  console.log(`  ${name}.json`);
}

const token = await getToken();
console.log(`Frozen now ${nowUtc}\n`);

// Fetch everything before writing anything, so a failed request leaves the old fixtures intact.
const responses = [];
for (const [api, url] of urls) {
  const response = await fetch(apis[api] + url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${apis[api] + url}`);
  responses.push([api, url, await response.json()]);
}

fs.mkdirSync(fixturesDir, { recursive: true });
fs.writeFileSync(
  path.join(fixturesDir, "frozen-now.json"),
  JSON.stringify({ frozenNow: nowUtc }, null, 2) + "\n"
);
for (const [api, url, body] of responses) updateFile(api, url, body);
console.log(`\nWrote ${responses.length + 1} files to cypress/fixtures/`);
