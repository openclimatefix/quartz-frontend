#!/usr/bin/env node
//
// Builds the static geometry assets Phase 5 moves out of the JS bundle.
//
// Why a committed script rather than a one-off: the inputs in `data/` are third-party
// publications that get refreshed (the GSP boundary file already has two vintages), and the
// grouping re-key depends on a captured API region list that will drift. When either moves,
// the correct action is to re-run this and read the manifest diff — not to hand-edit 17 MB of
// GeoJSON. It is deliberately dependency-light: plain node ESM, and the only library it uses
// (`@turf/turf`, for the NL dissolve) is already a dependency of the app.
//
// Run from anywhere:  node apps/nowcasting-app/scripts/build-geo-assets.mjs
//
// Outputs are exactly the paths `config/countries.ts` already declares. It invents no new
// path; if you need a new asset, declare it in the registry first and add it here second.
//
// Everything is written minified. These are build artefacts read by `fetch`, never by a
// human, and pretty-printing `zone.json` costs ~4 MB of whitespace in git.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { union, featureCollection } from "@turf/turf";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, "..");
const DATA = join(APP, "data");
const PUBLIC = join(APP, "public");

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const writeJson = (relPath, value) => {
  const out = join(PUBLIC, relPath);
  mkdirSync(dirname(out), { recursive: true });
  const body = JSON.stringify(value);
  writeFileSync(out, body);
  const mb = (Buffer.byteLength(body) / 1024 / 1024).toFixed(2);
  console.log(`  wrote public${relPath}  (${mb} MB)`);
};

// GeoJSON's `crs` member was dropped in RFC 7946 — everything is WGS84 now — and both
// Mapbox and turf ignore it. Stripping it keeps the shipped files to the current spec and
// removes a field that reads like a promise the file cannot keep (the 2020 DNO export
// declares EPSG::4326 in a `crs` block while already being lat/long).
const stripCrs = (fc) => {
  const { crs, ...rest } = fc;
  return rest;
};

// ---------------------------------------------------------------------------------------
// The region list the groupings and the alias table are derived against.
//
// This is a captured live-API response (338 GB GSP regions, 2026-08), the same shape
// `buildRegionBridge` consumes at runtime, and it is the only artefact in the repo carrying
// BOTH `metadata.gsp_id` and the v1 `name`. `data/gsp-regions.json` and
// `data/grid-supply-points.json` are pre-v1: the former is 2022 boundary geometry, the
// latter a spreadsheet export keyed on "GSP ID" (`ABNE_P`) with no gsp_id at all. Neither
// can perform the id -> v1 name translation, so the fixture it is.
// ---------------------------------------------------------------------------------------
const GB_REGIONS = readJson(join(APP, "lib/api/v1/__fixtures__/gb-regions-gsp.json"));
const gspNameById = new Map(
  GB_REGIONS.filter((r) => typeof r.metadata?.gsp_id === "number").map((r) => [
    r.metadata.gsp_id,
    r.name
  ])
);

/**
 * Re-key a `Record<string, number[]>` grouping file to `Record<string, string[]>`.
 *
 * Duplicates are preserved exactly as they appear. GB's DNO file lists 15 GSP ids in two
 * licence areas each; whether a GSP feeding two areas is legitimate is an open question with
 * the API owner, so Phase 5 reproduces the double-count rather than quietly de-duplicating
 * it. See `data.reconciliation.test.ts`, which pins the resulting excess.
 *
 * Ids with no v1 region behind them are dropped from the output — they cannot be drawn —
 * but every one of them is recorded in the manifest. A silently lossy rebuild is the exact
 * failure this whole script exists to make visible.
 */
const rekeyGroupings = (groupings) => {
  const out = {};
  const unresolved = [];
  const covered = new Set();
  for (const [groupName, ids] of Object.entries(groupings)) {
    const names = [];
    for (const id of ids) {
      const name = gspNameById.get(id);
      if (name === undefined) {
        unresolved.push({ group: groupName, gspId: id });
        continue;
      }
      names.push(name);
      covered.add(name);
    }
    out[groupName] = names;
  }
  const refs = Object.values(groupings).reduce((n, ids) => n + ids.length, 0);
  return {
    groupings: out,
    report: {
      groups: Object.keys(groupings).length,
      refs,
      resolved: refs - unresolved.length,
      unresolvedGspIds: unresolved,
      regionsInNoGroup: [...gspNameById.values()].filter((n) => !covered.has(n)).sort()
    }
  };
};

console.log("GB");

// GSP boundaries. The 2026 vintage, per the contract: it is already on `development` and
// arrives at merge regardless, and neither vintage joins cleanly — the refresh moves the
// gaps rather than closing them, which is why `config/geo-aliases.ts` exists.
const gsp = stripCrs(readJson(join(DATA, "GSP_regions_4326_20260209.json")));
writeJson("/geo/gb/gsp.json", gsp);

// National outline. The source carries `properties.id = "National"`; the registry joins
// `national` on `name`, untransformed, and the v1 national region is named "Great Britain",
// so the join key is written explicitly here rather than left to a runtime special case.
const gbNational = stripCrs(readJson(join(DATA, "national_gsp_shape.json")));
const GB_NATIONAL_NAME = GB_REGIONS_NATIONAL_NAME();
gbNational.features = gbNational.features.map((f) => ({
  ...f,
  properties: { ...f.properties, name: GB_NATIONAL_NAME }
}));
writeJson("/geo/gb/national.json", gbNational);

// Derived-level polygons. DNO joins on `LongName` ("UKPN (East)") and NG zones on `id`
// ("NE Scotland") — both already spelled exactly as the grouping files key their groups, so
// no transform is needed on either. Verified against the sources, not assumed.
writeJson(
  "/geo/gb/dno.json",
  stripCrs(readJson(join(DATA, "dno_regions_lat_long_converted.json")))
);
writeJson("/geo/gb/zone.json", stripCrs(readJson(join(DATA, "ng_zones.json"))));

// Overlay. LineStrings, not polygons; drawn, never joined.
writeJson(
  "/geo/gb/ng-constraints.json",
  stripCrs(readJson(join(DATA, "ng_constraint_boundaries.json")))
);

const dno = rekeyGroupings(readJson(join(DATA, "dno_gsp_groupings.json")));
const zone = rekeyGroupings(readJson(join(DATA, "ng_gsp_zone_groupings.json")));
writeJson("/geo/gb/dno-groupings.json", dno.groupings);
writeJson("/geo/gb/zone-groupings.json", zone.groupings);

// The manifest lives alongside the assets rather than under `docs/` on purpose: it is
// generated by the same run that generates them, so keeping it in the same directory means a
// rebuild that changes what resolves shows up in the same diff as the files that changed.
// It is a few KB and nothing fetches it.
writeJson("/geo/gb/groupings-manifest.json", {
  generatedBy: "scripts/build-geo-assets.mjs",
  regionSource: "lib/api/v1/__fixtures__/gb-regions-gsp.json",
  regionCount: gspNameById.size,
  // Phase 2 measured 348/349 and 306/317. Materially different numbers here are a finding,
  // not something to tune the script until it matches.
  expected: { "dno-groupings": "348/349", "zone-groupings": "306/317" },
  files: { "dno-groupings.json": dno.report, "zone-groupings.json": zone.report }
});
console.log(
  `  dno-groupings   ${dno.report.resolved}/${dno.report.refs} refs resolved` +
    `, ${dno.report.regionsInNoGroup.length} regions in no group`
);
console.log(
  `  zone-groupings  ${zone.report.resolved}/${zone.report.refs} refs resolved` +
    `, ${zone.report.regionsInNoGroup.length} regions in no group`
);

writeJson("/data/gb/national-metrics.json", readJson(join(DATA, "national_metrics.json")));

// ---------------------------------------------------------------------------------------
// Sites view (Phase 5 Track E / peripherals).
//
// `sitesMap.tsx` used to bundle two more GeoJSON files directly — 25 MB of the phase's
// bundle number lived here. Both draw as plain outline overlays with no property join
// against site/GSP data, so there is nothing here to key or alias.
//
//  - GSP boundaries: sitesMap originally used `data/gsp_regions_20220314.json`, a 2022
//    vintage. Per Brad's decision, the sites view now draws the same canonical GSP file
//    as the region view (`gsp.json`, from `GSP_regions_4326_20260209.json`, emitted
//    above) — there is exactly one GSP boundary asset in the repo. The 2022 file and its
//    build step are gone; nothing reads `data/gsp_regions_20220314.json` any more.
//  - DNO boundaries: sitesMap uses `data/dno_regions_lat_long_converted.json`, the exact
//    same source file already emitted above as `dno.json` (verified byte-identical after
//    `crs` stripping). No second copy — sitesMap fetches `/geo/gb/dno.json`.
// ---------------------------------------------------------------------------------------
console.log("GB — sites view (Track E): reuses gsp.json and dno.json above, nothing to emit");

console.log("NL");

const provinces = stripCrs(readJson(join(DATA, "netherlands.json")));
writeJson("/geo/nl/province.json", provinces);

// There is no published NL national outline, so one is dissolved from the 12 provinces here,
// at build time, rather than 12 polygons being unioned in the browser on every load.
//
// This is a true dissolve, not a bag of 12 polygons in a MultiPolygon: `turf.union` clips
// against the shared borders, so the internal province boundaries are gone from the result.
// turf is already an app dependency — nothing new was added for this.
//
// The feature is named `"netherlands"`, which is what the v1 manifest calls the NL national
// region, so it joins on `name` with no transform like GB's does.
const nlNational = union(featureCollection(provinces.features));
writeJson("/geo/nl/national.json", {
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { name: "netherlands" }, geometry: nlNational.geometry }
  ]
});

// Hoisted so the national-name lookup reads as a named thing at its use site above.
function GB_REGIONS_NATIONAL_NAME() {
  const national = readJson(join(APP, "lib/api/v1/__fixtures__/gb-regions-national.json"));
  return national[0].name;
}

console.log("done");
