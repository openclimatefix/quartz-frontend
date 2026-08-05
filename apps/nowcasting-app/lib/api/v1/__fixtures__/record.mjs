#!/usr/bin/env node
// Re-runnable recorder for lib/api/v1/__fixtures__/*.json
//
// Records VERBATIM responses from the live v1 API (production only — the
// QUARTZ_API_V1_TOKEN in .env.local is signed by a different Auth0 tenant
// than the dev hosts, so this only works against https://api.quartz.solar/v1).
//
// Usage:
//   node lib/api/v1/__fixtures__/record.mjs
//
// Plain node, no dependencies. Reads .env.local itself. Read-only GETs only.
//
// Trim policy: trim the REGION axis, keep the TIME axis complete. Where an
// endpoint supports `region_names`, we ask the server to trim (an honest
// subset response) rather than slicing a full response after the fact.
//
// Some endpoints serve from a cache that is warmed lazily and can return
// `503 {"detail": "... cache is being populated, please retry in 60
// seconds."}` on a cold hit. This recorder retries those with backoff.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "../../../.."); // lib/api/v1/__fixtures__ -> app root
const envPath = path.join(appRoot, ".env.local");

function loadEnvLocal() {
  const raw = readFileSync(envPath, "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    // Only keep the FIRST definition of a key (later commented-out /
    // duplicate lines in .env.local should not win).
    if (!(key in env)) env[key] = value;
  }
  return env;
}

const env = loadEnvLocal();
const TOKEN = env.QUARTZ_API_V1_TOKEN;
if (!TOKEN) {
  console.error("QUARTZ_API_V1_TOKEN not found in .env.local");
  process.exit(1);
}

const BASE = "https://api.quartz.solar/v1";
const OUT_DIR = __dirname;

// Last full UTC day — recent enough that caches are warm, old enough to be
// stable and reproducible on re-run.
function lastFullUtcDayWindow() {
  const now = new Date();
  const endOfYesterday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const startOfYesterday = new Date(endOfYesterday.getTime() - 24 * 60 * 60 * 1000);
  return {
    start_utc: startOfYesterday.toISOString().replace(/\.\d{3}Z$/, "Z"),
    end_utc: endOfYesterday.toISOString().replace(/\.\d{3}Z$/, "Z")
  };
}

const { start_utc, end_utc } = lastFullUtcDayWindow();

// Five GB gsp region_names chosen to include one pipe-joined composite name
// (fact 1) and confirmed to carry metadata.gsp_id (fact 2).
const GB_GSP_SAMPLE_NAMES = ["citr_1", "brfo_1|clt03", "sjow_1", "hack_1", "hack_6"];

// Five NL province names for the same purpose (no composite/pipe names in NL).
const NL_PROVINCE_SAMPLE_NAMES = ["zeeland", "noord-brabant", "limburg", "friesland", "drenthe"];

async function getJson(url, { allow5xxRetries = true } = {}) {
  const maxAttempts = allow5xxRetries ? 15 : 1;
  let lastBody = null;
  let lastStatus = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    const status = res.status;
    const text = await res.text();
    lastBody = text;
    lastStatus = status;
    // 503 with "cache is being populated" is transient — retry with backoff.
    if (status === 503 && /cache is being populated/i.test(text) && attempt < maxAttempts) {
      console.log(`  [retry ${attempt}/${maxAttempts}] ${status} cache warming, waiting 20s...`);
      await new Promise((r) => setTimeout(r, 20_000));
      continue;
    }
    return { status, text };
  }
  return { status: lastStatus, text: lastBody };
}

function writeFixture(filename, status, text) {
  const filePath = path.join(OUT_DIR, filename);
  // Re-serialise to normalise whitespace only — payload content is untouched
  // (verbatim), this just avoids storing single-line minified JSON blobs.
  let body;
  try {
    body = JSON.stringify(JSON.parse(text), null, 2) + "\n";
  } catch {
    body = text;
  }
  writeFileSync(filePath, body);
  const bytes = Buffer.byteLength(body);
  console.log(`  -> ${filename} (${status}, ${(bytes / 1024).toFixed(1)} KB)`);
  return bytes;
}

function qs(params) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      for (const item of v) usp.append(k, item);
    } else {
      usp.append(k, v);
    }
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

// Observed generation lands region by region over a few minutes, so the newest slot can
// be read while it is still filling. Anything that wants representative full coverage
// must ask for a slot old enough to have settled — three hours back, snapped to the
// half-hour grid the data is bucketed on.
function settledSlotUtc() {
  const t = new Date(Date.now() - 3 * 60 * 60 * 1000);
  t.setUTCMinutes(t.getUTCMinutes() < 30 ? 0 : 30, 0, 0);
  return t.toISOString().replace(/\.\d{3}Z$/, "Z");
}

// Manifest: filename -> { describe, request() }. Each entry documents the
// exact request that produced its fixture file. Run in sequence (not
// parallel) so cache-warming retries on one endpoint don't pile up.
const manifest = [
  {
    file: "countries.json",
    request: () => `GET /countries`,
    url: () => `${BASE}/countries`
  },
  {
    file: "sources.json",
    request: () => `GET /sources`,
    url: () => `${BASE}/sources`
  },
  {
    file: "gb-region-types.json",
    request: () => `GET /GB/solar/region-types`,
    url: () => `${BASE}/GB/solar/region-types`
  },
  {
    file: "nl-region-types.json",
    request: () => `GET /NL/solar/region-types`,
    url: () => `${BASE}/NL/solar/region-types`
  },
  {
    file: "gb-generation-sources.json",
    request: () => `GET /GB/solar/generation-sources`,
    url: () => `${BASE}/GB/solar/generation-sources`
  },
  {
    file: "nl-generation-sources.json",
    request: () => `GET /NL/solar/generation-sources`,
    url: () => `${BASE}/NL/solar/generation-sources`
  },
  {
    file: "gb-regions-national.json",
    request: () => `GET /GB/solar/regions?region_type=national`,
    url: () => `${BASE}/GB/solar/regions${qs({ region_type: "national" })}`
  },
  {
    file: "gb-regions-gsp.json",
    request: () =>
      `GET /GB/solar/regions?region_type=gsp (full response — server does not support ` +
      `a result-count limit here; ~338 GB gsp regions, ~49KB, within the 1.5MB budget)`,
    url: () => `${BASE}/GB/solar/regions${qs({ region_type: "gsp" })}`
  },
  {
    file: "nl-regions-province.json",
    request: () => `GET /NL/solar/regions?region_type=province`,
    url: () => `${BASE}/NL/solar/regions${qs({ region_type: "province" })}`
  },
  {
    file: "gb-region-citr_1.json",
    request: () => `GET /GB/solar/regions/citr_1 (single region, has metadata.gsp_id)`,
    url: () => `${BASE}/GB/solar/regions/citr_1`
  },
  {
    file: "gb-national-forecast.json",
    request: () =>
      `GET /GB/solar/regions/national/forecast?start_utc=${start_utc}&end_utc=${end_utc} ` +
      `(default model, full time series for one day)`,
    url: () => `${BASE}/GB/solar/regions/national/forecast${qs({ start_utc, end_utc })}`
  },
  {
    file: "gb-national-forecast-last-updated.json",
    request: () => `GET /GB/solar/regions/national/forecast/last-updated`,
    url: () => `${BASE}/GB/solar/regions/national/forecast/last-updated`
  },
  {
    file: "gb-national-generation-pvlive_in_day.json",
    request: () =>
      `GET /GB/solar/regions/national/generation?observer=pvlive_in_day&start_utc=${start_utc}&end_utc=${end_utc}`,
    url: () =>
      `${BASE}/GB/solar/regions/national/generation${qs({
        observer: "pvlive_in_day",
        start_utc,
        end_utc
      })}`
  },
  {
    file: "gb-national-generation-pvlive_day_after.json",
    request: () =>
      `GET /GB/solar/regions/national/generation?observer=pvlive_day_after&start_utc=${start_utc}&end_utc=${end_utc}`,
    url: () =>
      `${BASE}/GB/solar/regions/national/generation${qs({
        observer: "pvlive_day_after",
        start_utc,
        end_utc
      })}`
  },
  {
    file: "nl-national-generation-ned_nl.json",
    request: () =>
      `GET /NL/solar/regions/national/generation?observer=ned_nl&start_utc=${start_utc}&end_utc=${end_utc}`,
    url: () =>
      `${BASE}/NL/solar/regions/national/generation${qs({
        observer: "ned_nl",
        start_utc,
        end_utc
      })}`
  },
  {
    file: "gb-gsp-forecasts-period.json",
    request: () =>
      `GET /GB/solar/forecasts/period?region_type=gsp&start_utc=${start_utc}&end_utc=${end_utc}` +
      GB_GSP_SAMPLE_NAMES.map((n) => `&region_names=${encodeURIComponent(n)}`).join("") +
      ` (server-side trim to 5 region_names, full time axis; cache may need warming)`,
    url: () =>
      `${BASE}/GB/solar/forecasts/period${qs({
        region_type: "gsp",
        start_utc,
        end_utc,
        region_names: GB_GSP_SAMPLE_NAMES
      })}`
  },
  {
    file: "gb-gsp-generation-period.json",
    request: () =>
      `GET /GB/solar/generation/period?region_type=gsp&observer=pvlive_in_day&start_utc=${start_utc}&end_utc=${end_utc}` +
      GB_GSP_SAMPLE_NAMES.map((n) => `&region_names=${encodeURIComponent(n)}`).join("") +
      ` (server-side trim to 5 region_names, full time axis). NOTE: the forecast and ` +
      `generation period caches are independent and warm separately — one can be hot ` +
      `while the other is still 503'ing "cache is being populated"; this recorder retries ` +
      `each endpoint on its own schedule for exactly that reason.`,
    url: () =>
      `${BASE}/GB/solar/generation/period${qs({
        region_type: "gsp",
        observer: "pvlive_in_day",
        start_utc,
        end_utc,
        region_names: GB_GSP_SAMPLE_NAMES
      })}`
  },
  {
    file: "nl-province-forecasts-period.json",
    request: () =>
      `GET /NL/solar/forecasts/period?region_type=province&start_utc=${start_utc}&end_utc=${end_utc}` +
      NL_PROVINCE_SAMPLE_NAMES.map((n) => `&region_names=${encodeURIComponent(n)}`).join(""),
    url: () =>
      `${BASE}/NL/solar/forecasts/period${qs({
        region_type: "province",
        start_utc,
        end_utc,
        region_names: NL_PROVINCE_SAMPLE_NAMES
      })}`
  },
  {
    file: "gb-gsp-forecasts-snapshot.json",
    request: () =>
      `GET /GB/solar/forecasts/snapshot?region_type=gsp (one instant, all ~336 regions, ~22KB)`,
    url: () => `${BASE}/GB/solar/forecasts/snapshot${qs({ region_type: "gsp" })}`
  },
  {
    // Pinned to a settled slot on purpose. Left to default to the latest instant, this
    // records whatever coverage that slot happens to have reached — observed generation
    // publishes region by region over a few minutes, so the most recent slot can come
    // back with a fraction of the regions. See finding 6 in README.md.
    file: "gb-gsp-generation-snapshot.json",
    request: () =>
      `GET /GB/solar/generation/snapshot?region_type=gsp&observer=pvlive_in_day&time_utc=... (a settled slot: all 336 regions, ~33KB)`,
    url: () =>
      `${BASE}/GB/solar/generation/snapshot${qs({
        region_type: "gsp",
        observer: "pvlive_in_day",
        // Several hours back, so the slot has certainly finished publishing.
        time_utc: settledSlotUtc()
      })}`
  },
  // `gb-gsp-generation-snapshot-partial.json` has no entry here on purpose: it is the
  // mid-publish transient (127 of 336 regions), caught by chance and not reproducible on
  // demand. Re-recording it would need a request timed to land inside the window while
  // the newest slot is still filling. Leave the committed copy alone.
  {
    file: "error-400-unknown-region-type.json",
    request: () =>
      `GET /GB/solar/regions?region_type=bogus — undocumented 400 (spec only declares ` +
      `200/422 for this path); response body is a plain {"detail": string}, NOT the ` +
      `HTTPValidationError shape.`,
    url: () => `${BASE}/GB/solar/regions${qs({ region_type: "bogus" })}`,
    allow5xxRetries: false
  },
  {
    file: "error-422-missing-required-query-param.json",
    request: () =>
      `GET /GB/solar/forecasts/period (region_type omitted) — the real 422, matches ` +
      `HTTPValidationError / ValidationError schema.`,
    url: () => `${BASE}/GB/solar/forecasts/period`,
    allow5xxRetries: false
  },
  {
    file: "error-400-national-on-period-endpoint.json",
    request: () =>
      `GET /GB/solar/forecasts/period?region_type=national — undocumented 400: the ` +
      `period matrix endpoints only pre-warm sub-national region types (gsp/province). ` +
      `Neither the restriction nor the 400 status is in the spec. Body is again a plain ` +
      `{"detail": string}, distinct from the HTTPValidationError array shape used for 422s.`,
    url: () => `${BASE}/GB/solar/forecasts/period${qs({ region_type: "national" })}`,
    allow5xxRetries: false
  }
];

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Recording fixtures from ${BASE} (window ${start_utc} .. ${end_utc})\n`);

  const results = [];
  for (const entry of manifest) {
    console.log(`${entry.file}: ${entry.request()}`);
    const url = entry.url();
    const { status, text } = await getJson(url, {
      allow5xxRetries: entry.allow5xxRetries !== false
    });
    const bytes = writeFixture(entry.file, status, text);
    results.push({ file: entry.file, status, bytes, request: entry.request() });
  }

  const total = results.reduce((sum, r) => sum + r.bytes, 0);
  console.log(`\nTotal: ${(total / 1024).toFixed(1)} KB across ${results.length} files`);
  console.log(
    "\nUpdate lib/api/v1/__fixtures__/README.md's manifest table if file names/sizes changed."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
