#!/usr/bin/env node
/**
 * Generate per-DNO seasonal metrics from the per-GSP metrics.
 *
 * For each DNO we combine its constituent GSPs' normalised (0-1) seasonal
 * metrics into a single normalised metrics object, weighting each GSP by its
 * installed capacity:
 *
 *     dnoNorm[sp] = Σ_g( gspNorm_g[sp] · cap_g ) / Σ_g( cap_g )
 *
 * Multiplying that by the DNO's *current* total installed capacity (done at
 * runtime, from the live API) reconstructs the capacity-weighted seasonal
 * expectation for the DNO. GSPs without a metrics file or without a capacity
 * (e.g. newly added GSPs) are skipped; the resulting normalised shape is then
 * extrapolated to the full current DNO capacity at runtime.
 *
 * Output:
 *   public/metrics/dno_metrics/<slug>.json  one file per DNO (national_metrics
 *                                           shape + meta), served as a static
 *                                           asset and fetched at runtime (not
 *                                           webpacked).
 *   data/dno_metrics/manifest.json          name -> file map; bundled (imported)
 *                                           so the runtime needn't slugify.
 *
 * Usage:
 *   node scripts/generate-dno-metrics.mjs [capacitiesFile]
 *
 *   capacitiesFile  JSON array of { gspId, installedCapacityMw } (a GSP metadata
 *                   export from the prod API). Defaults to the most recent
 *                   data/gsp_metadata_*.json.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = join(APP_ROOT, "data");
// GSP/DNO metrics are large and served as static assets (fetched at runtime, not
// webpacked), so they live under public/. The manifest is small and imported, so
// it stays bundled in data/.
const PUBLIC_METRICS_DIR = join(APP_ROOT, "public", "metrics");
const GSP_METRICS_DIR = join(PUBLIC_METRICS_DIR, "gsp_metrics");
const OUT_DIR = join(PUBLIC_METRICS_DIR, "dno_metrics");
const MANIFEST_DIR = join(DATA_DIR, "dno_metrics");
const GROUPINGS_FILE = join(DATA_DIR, "dno_gsp_groupings.json");

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

// Stable, filesystem-safe slug for a DNO name, e.g.
// "NGED (East Midlands)" -> "NGED_East_Midlands".
const slugify = (name) => name.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");

// Pick the capacities file: CLI arg, else newest data/gsp_metadata_*.json.
const resolveCapacitiesFile = () => {
  const arg = process.argv[2];
  if (arg) return arg;
  const candidates = readdirSync(DATA_DIR)
    .filter((f) => /^gsp_metadata_.*\.json$/.test(f))
    .sort();
  if (!candidates.length) {
    throw new Error(
      "No data/gsp_metadata_*.json found. Pass a capacities file as the first argument."
    );
  }
  return join(DATA_DIR, candidates[candidates.length - 1]);
};

// Capacity-weighted average of one settlement period across GSPs, ignoring GSPs
// with no value (null/non-finite) there. Returns null when no GSP has data, so a
// single bad GSP can't drag the combined value toward zero.
const weightedValue = (entries, pick) => {
  let num = 0;
  let den = 0;
  for (const { cap, metrics } of entries) {
    const v = pick(metrics);
    if (typeof v === "number" && Number.isFinite(v)) {
      num += v * cap;
      den += cap;
    }
  }
  return den > 0 ? num / den : null;
};

// Combine several GSPs' normalised metrics into one, capacity-weighted per
// settlement period (over the GSPs that have data there).
const combineMetrics = (entries) => {
  if (entries.length === 1) return entries[0].metrics;

  const base = entries[0].metrics;
  const data = {};

  for (const month of Object.keys(base.data)) {
    data[month] = {};
    for (const day of Object.keys(base.data[month])) {
      const mean = base.data[month][day].mean.map((_, sp) =>
        weightedValue(entries, (m) => m.data[month]?.[day]?.mean[sp])
      );
      const pLevels = base.data[month][day].pLevels.map((arr, k) =>
        arr.map((_, sp) => weightedValue(entries, (m) => m.data[month]?.[day]?.pLevels[k]?.[sp]))
      );

      data[month][day] = { mean, pLevels };
    }
  }

  return { keys: base.keys, data };
};

const main = () => {
  const groupings = readJson(GROUPINGS_FILE);
  const capacitiesFile = resolveCapacitiesFile();
  const capsRaw = readJson(capacitiesFile);
  const caps = new Map(
    capsRaw
      .filter((e) => e && e.gspId != null && Number(e.installedCapacityMw) > 0)
      .map((e) => [Number(e.gspId), Number(e.installedCapacityMw)])
  );

  const metricsCache = new Map();
  const loadMetrics = (gspId) => {
    if (metricsCache.has(gspId)) return metricsCache.get(gspId);
    let metrics = null;
    try {
      metrics = readJson(join(GSP_METRICS_DIR, `gsp_${gspId}.json`));
    } catch {
      metrics = null;
    }
    metricsCache.set(gspId, metrics);
    return metrics;
  };

  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(MANIFEST_DIR, { recursive: true });

  const generatedAt = new Date().toISOString();
  const manifest = {};
  const summary = [];

  for (const [dnoName, gspIds] of Object.entries(groupings)) {
    const used = [];
    const missingMetrics = [];
    const missingCapacity = [];

    for (const gspId of gspIds) {
      const metrics = loadMetrics(gspId);
      const cap = caps.get(Number(gspId));
      if (!metrics) {
        missingMetrics.push(gspId);
        continue;
      }
      if (!cap) {
        missingCapacity.push(gspId);
        continue;
      }
      used.push({ gspId, cap, metrics });
    }

    if (!used.length) {
      console.warn(`! ${dnoName}: no GSPs with both metrics and capacity — skipped`);
      continue;
    }

    const slug = slugify(dnoName);
    const file = `${slug}.json`;
    const snapshotCapacityUsed = used.reduce((acc, e) => acc + e.cap, 0);
    const meta = {
      dnoName,
      generatedAt,
      capacitiesFile: capacitiesFile.split("/data/").pop(),
      gspIdsUsed: used.map((e) => e.gspId),
      gspIdsMissingMetrics: missingMetrics,
      gspIdsMissingCapacity: missingCapacity,
      snapshotCapacityUsedMw: Number(snapshotCapacityUsed.toFixed(3))
    };

    const combined = combineMetrics(used.map(({ cap, metrics }) => ({ cap, metrics })));
    writeFileSync(join(OUT_DIR, file), JSON.stringify({ meta, ...combined }));

    manifest[dnoName] = { file, ...meta };
    summary.push({
      DNO: dnoName,
      used: used.length,
      missingMetrics: missingMetrics.length,
      missingCapacity: missingCapacity.length,
      capacityMw: meta.snapshotCapacityUsedMw
    });
  }

  writeFileSync(join(MANIFEST_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(`\nGenerated ${summary.length} DNO metrics files in public/metrics/dno_metrics/`);
  console.log(`Capacities: ${capacitiesFile.split("/data/").pop()}`);
  console.table(summary);
};

main();
