/**
 * The join rate between the shipped `public/geo/` assets and the API's regions.
 *
 * This is the test that catches an asset rebuild silently dropping polygons. It reads the
 * committed files off disk rather than importing them, because the thing under test is what
 * `fetch` will actually receive in the browser — not what a bundler could resolve.
 *
 * **The direction that matters is feature-side.** Per Brad's rule, the NESO boundary file is
 * the definitive GSP set; the API additionally serves merged and legacy spellings for
 * backward compatibility. So the question is "how many of the 362 features does the API give
 * us a value for", not "how many API regions did we manage to draw". The regions that draw
 * nothing are enumerated in `LEGACY_REGIONS` with the reason — visible by construction, which
 * is the point. A silent drop is what this file exists to prevent.
 *
 * None of the numbers below came from the contract; they were measured against the shipped
 * assets after the rule changed. If a boundary refresh moves them, work out which side is
 * real and update `geo-aliases.ts` — never relax an assertion so a rebuild goes quiet.
 */
import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GEO_ALIASES, LEGACY_REGIONS, geoAliasesFor, isLegacyRegion } from "./geo-aliases";
import { COUNTRY_CONFIG } from "./countries";

import gbGspRegions from "../lib/api/v1/__fixtures__/gb-regions-gsp.json";
import gbNationalRegions from "../lib/api/v1/__fixtures__/gb-regions-national.json";
import nlProvinceRegions from "../lib/api/v1/__fixtures__/nl-regions-province.json";

type Feature = { properties: Record<string, unknown> };
type FeatureCollection = { features: Feature[] };

const readAsset = (relPath: string): FeatureCollection =>
  JSON.parse(readFileSync(join(__dirname, "..", "public", relPath), "utf8"));

const readGroupings = (relPath: string): Record<string, string[]> =>
  JSON.parse(readFileSync(join(__dirname, "..", "public", relPath), "utf8"));

/** The transformed join keys a feature collection offers, in feature order (duplicates kept). */
const featureKeys = (fc: FeatureCollection, joinProperty: string, lowercase: boolean): string[] =>
  fc.features.map((f) => {
    const raw = String(f.properties[joinProperty]);
    return lowercase ? raw.toLowerCase() : raw;
  });

describe("shipped GB GSP boundaries", () => {
  const layer = COUNTRY_CONFIG.GB.geo.gsp;
  const fc = readAsset(layer.url);
  const keys = featureKeys(fc, layer.joinProperty, layer.joinTransform === "lowercase");
  const keySet = new Set(keys);
  const regionNames = gbGspRegions.map((r) => r.name);
  /** The API regions that survive the NESO rule — i.e. everything that is not backward-compat. */
  const realRegions = gbGspRegions.filter((r) => !isLegacyRegion("GB", r.name));

  it("ships the 2026 NESO vintage — 362 features carrying 335 distinct join keys", () => {
    expect(fc.features.length).toBe(362);
    // 22 keys appear on more than one feature (27 extra features), `off_nets(unassigned)`
    // alone on five. A multi-part GSP is legitimately several polygons under one key.
    expect(keySet.size).toBe(335);
    expect(regionNames.length).toBe(338);
  });

  it("draws 355 of 362 features — the direction that matters", () => {
    const drawn = keys.filter((k) => regionNames.includes(k));
    expect(drawn.length).toBe(355);
    // Same measure deduplicated, so a change in multi-part polygons cannot mask a change in
    // which GSPs have data.
    expect([...keySet].filter((k) => regionNames.includes(k)).length).toBe(332);
  });

  it("leaves exactly three feature keys with no API region behind them", () => {
    // `off_nets(unassigned)` (5 features) is the boundary file's placeholder for unassigned
    // network and was never a GSP. `grem_p` (Gremista) has no v1 region under any spelling —
    // checked, there is no near-miss. `seab1` is undrawn on purpose: the API publishes
    // Seabank only inside the legacy merged `seab1|safo_1`, so there is no value to paint on
    // it. See LEGACY_REGIONS for why aliasing it would be wrong.
    expect([...keySet].filter((k) => !regionNames.includes(k)).sort()).toEqual([
      "grem_p",
      "off_nets(unassigned)",
      "seab1"
    ]);
  });

  it("draws every API region that is not backward-compat legacy", () => {
    expect(realRegions.length).toBe(332);
    const undrawn = realRegions.filter((r) =>
      geoAliasesFor("GB", r.name).some((key) => !keySet.has(key))
    );
    expect(undrawn.map((r) => r.name)).toEqual([]);
  });

  it("names every legacy region and matches none of them to a feature", () => {
    // If one of these ever starts joining, the API and the file have converged and the entry
    // must come out of LEGACY_REGIONS — this is the assertion that tells us.
    expect(LEGACY_REGIONS.GB.length).toBe(6);
    for (const name of LEGACY_REGIONS.GB) {
      expect({ name, isARegion: regionNames.includes(name) }).toEqual({ name, isARegion: true });
      expect({ name, joins: keySet.has(name) }).toEqual({ name, joins: false });
    }
  });

  it("needs no aliases at all under the NESO rule", () => {
    // Every entry this table once held was a split/merge duplicate, not a spelling
    // disagreement, and moved to LEGACY_REGIONS. A non-empty table is not a failure — it
    // means a refresh introduced a genuine naming disagreement, and this assertion is the
    // prompt to document it.
    expect(GEO_ALIASES.GB).toEqual({});
  });
});

describe("GB national capacity under the NESO rule", () => {
  // Measurement only. The contract records the 338 API regions summing to 22,588 MW against a
  // national 21,905 MW — 683 MW / 3.1 % over — and attributes the excess to exactly the six
  // legacy regions. Excluding them resolves the over-count and leaves a small shortfall, which
  // is a different and much more ordinary problem (undrawn `seab1`, `grem_p`). Pinned here so
  // that whoever owns the capacity decision can see it move. Nothing in this repo consumes it.
  const sumMw = (regions: { name: string; capacity_kW: number }[]) =>
    regions.reduce((total, r) => total + r.capacity_kW, 0) / 1000;

  it("over-counts by 683 MW when the legacy regions are included", () => {
    expect(Math.round(sumMw(gbGspRegions))).toBe(22588);
    expect(Math.round(gbNationalRegions[0].capacity_kW / 1000)).toBe(21905);
  });

  it("lands 122 MW UNDER national once the legacy regions are excluded", () => {
    const real = gbGspRegions.filter((r) => !isLegacyRegion("GB", r.name));
    expect(Math.round(sumMw(real))).toBe(21783);
    expect(Math.round(sumMw(real) - gbNationalRegions[0].capacity_kW / 1000)).toBe(-122);
  });
});

describe("shipped GB derived-level and national boundaries", () => {
  it("joins every DNO grouping name to a polygon", () => {
    const derived = COUNTRY_CONFIG.GB.derivedRegionTypes.dno;
    const keys = new Set(featureKeys(readAsset(derived.geometry.url), "LongName", false));
    const groupings = readGroupings(derived.groupings);
    expect(Object.keys(groupings).length).toBe(14);
    expect(Object.keys(groupings).filter((g) => keys.has(g)).length).toBe(14);
  });

  it("joins every NG zone grouping name to a polygon", () => {
    const derived = COUNTRY_CONFIG.GB.derivedRegionTypes.zone;
    const keys = new Set(featureKeys(readAsset(derived.geometry.url), "id", false));
    const groupings = readGroupings(derived.groupings);
    expect(Object.keys(groupings).length).toBe(19);
    expect(Object.keys(groupings).filter((g) => keys.has(g)).length).toBe(19);
  });

  it("names the national outline as the API names the region", () => {
    const fc = readAsset(COUNTRY_CONFIG.GB.geo.national.url);
    expect(fc.features.length).toBe(1);
    expect(fc.features[0].properties.name).toBe(gbNationalRegions[0].name);
  });
});

describe("shipped NL boundaries", () => {
  it("matches 12/12 provinces, with no aliases and no legacy regions", () => {
    const layer = COUNTRY_CONFIG.NL.geo.province;
    const fc = readAsset(layer.url);
    const keys = new Set(featureKeys(fc, layer.joinProperty, layer.joinTransform === "lowercase"));
    expect(fc.features.length).toBe(12);
    expect(nlProvinceRegions.filter((r) => keys.has(r.name)).length).toBe(12);
    expect(GEO_ALIASES.NL).toBeUndefined();
    expect(LEGACY_REGIONS.NL).toBeUndefined();
  });

  it("dissolves the provinces into one national feature", () => {
    const fc = readAsset(COUNTRY_CONFIG.NL.geo.national.url);
    expect(fc.features.length).toBe(1);
    expect(fc.features[0].properties.name).toBe("netherlands");
  });
});

describe("the grouping files after the Phase 5 re-key", () => {
  const manifest = JSON.parse(
    readFileSync(join(__dirname, "..", "public/geo/gb/groupings-manifest.json"), "utf8")
  );

  it("is keyed on v1 region names, not gsp_ids", () => {
    const names = new Set(gbGspRegions.map((r) => r.name));
    for (const path of ["/geo/gb/dno-groupings.json", "/geo/gb/zone-groupings.json"]) {
      for (const members of Object.values(readGroupings(path))) {
        for (const member of members) {
          expect(typeof member).toBe("string");
          expect(names.has(member)).toBe(true);
        }
      }
    }
  });

  it("resolves the Phase 2 reference counts — 348/349 DNO and 306/317 zone", () => {
    expect(manifest.files["dno-groupings.json"].resolved).toBe(348);
    expect(manifest.files["dno-groupings.json"].refs).toBe(349);
    expect(manifest.files["zone-groupings.json"].resolved).toBe(306);
    expect(manifest.files["zone-groupings.json"].refs).toBe(317);
  });

  it("reproduces the DNO double-count rather than de-duplicating it", () => {
    // 15 GSPs sit in two licence areas each. This is a SEPARATE problem from the legacy
    // regions above and Brad's NESO rule does not touch it: these are ordinary GSPs
    // appearing twice in a grouping file, not duplicate spellings from the API. Still open
    // with the API owner; pinned, not fixed. See `data.reconciliation.test.ts`.
    const seen = new Set<string>();
    const duplicated = new Set<string>();
    for (const members of Object.values(readGroupings("/geo/gb/dno-groupings.json"))) {
      for (const member of members) {
        if (seen.has(member)) duplicated.add(member);
        seen.add(member);
      }
    }
    expect(duplicated.size).toBe(15);
  });

  it("has no duplicate across NG zone groupings — they are a partition", () => {
    const members = Object.values(readGroupings("/geo/gb/zone-groupings.json")).flat();
    expect(new Set(members).size).toBe(members.length);
  });
});
