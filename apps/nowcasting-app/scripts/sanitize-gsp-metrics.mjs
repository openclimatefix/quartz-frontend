#!/usr/bin/env node
/**
 * Make the per-GSP metrics files valid JSON.
 *
 * The metrics are generated upstream with Python, which can emit `NaN` /
 * `Infinity` literals for settlement periods with missing/insufficient data.
 * Those are NOT valid JSON, so `JSON.parse` (used by the runtime `fetch().json()`
 * that loads these files) rejects the whole file and the GSP silently loses its
 * seasonal line. This rewrites any such literals to `null`, which the chart
 * treats as "no value" (a gap in the line) rather than a 0.
 *
 * Only files that actually contain invalid tokens are rewritten, and we preserve
 * their original formatting (a plain token replace), so the diff stays minimal.
 *
 * Run this whenever fresh gsp_metrics are dropped in, before building or
 * generating the DNO metrics. See also scripts/generate-dno-metrics.mjs.
 *
 * Usage: node scripts/sanitize-gsp-metrics.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// Per-GSP metrics are served as static assets (not webpacked), so they live
// under public/. See scripts/generate-dno-metrics.mjs for the DNO equivalent.
const GSP_METRICS_DIR = join(APP_ROOT, "public", "metrics", "gsp_metrics");

// Replace bare NaN / Infinity / -Infinity numeric tokens with null. These never
// appear inside the (known) string keys of these files, so a token replace is
// safe.
const sanitize = (text) => text.replace(/-?\bInfinity\b/g, "null").replace(/\bNaN\b/g, "null");

const main = () => {
  const files = readdirSync(GSP_METRICS_DIR).filter((f) => f.endsWith(".json"));
  const fixed = [];

  for (const file of files) {
    const path = join(GSP_METRICS_DIR, file);
    const text = readFileSync(path, "utf8");
    if (!/-?\bInfinity\b|\bNaN\b/.test(text)) continue;

    const cleaned = sanitize(text);
    // Validate before writing so we never persist broken JSON.
    JSON.parse(cleaned);
    writeFileSync(path, cleaned);
    fixed.push(file);
  }

  if (!fixed.length) {
    console.log(`All ${files.length} gsp_metrics files are already valid JSON.`);
  } else {
    console.log(`Sanitised ${fixed.length} of ${files.length} files (NaN/Infinity -> null):`);
    for (const f of fixed) console.log(`  ${f}`);
  }
};

main();
