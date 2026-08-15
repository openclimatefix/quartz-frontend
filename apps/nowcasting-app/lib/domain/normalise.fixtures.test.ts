import { describe, expect, test } from "@jest/globals";

import {
  normaliseCountries,
  normaliseForecast,
  normaliseForecastMatrix,
  normaliseForecastSnapshot,
  normaliseGeneration,
  normaliseGenerationMatrix,
  normaliseGenerationSnapshot,
  normaliseRegions
} from "./normalise";

import countries from "../api/v1/__fixtures__/countries.json";
import gbNationalForecast from "../api/v1/__fixtures__/gb-national-forecast.json";
import gbNationalGeneration from "../api/v1/__fixtures__/gb-national-generation-pvlive_in_day.json";
import gbRegionsGsp from "../api/v1/__fixtures__/gb-regions-gsp.json";
import gbGspForecastsPeriod from "../api/v1/__fixtures__/gb-gsp-forecasts-period.json";
import gbGspGenerationPeriod from "../api/v1/__fixtures__/gb-gsp-generation-period.json";
import gbGspForecastsSnapshot from "../api/v1/__fixtures__/gb-gsp-forecasts-snapshot.json";
import gbGspGenerationSnapshot from "../api/v1/__fixtures__/gb-gsp-generation-snapshot.json";
import gbGspGenerationSnapshotPartial from "../api/v1/__fixtures__/gb-gsp-generation-snapshot-partial.json";
import nlProvinceForecastsPeriod from "../api/v1/__fixtures__/nl-province-forecasts-period.json";
import nlRegionsProvince from "../api/v1/__fixtures__/nl-regions-province.json";
import nlNationalGeneration from "../api/v1/__fixtures__/nl-national-generation-ned_nl.json";
import * as normalisers from "./normalise";

// normalise.test.ts covers the behaviour with hand-built samples; this suite runs the
// same functions over payloads recorded verbatim from the production v1 API, which is
// what catches the difference between what the spec promises and what the wire sends.
// See lib/api/v1/__fixtures__/README.md for how each fixture was recorded.

/** Every instant the domain model emits must be in the one canonical spelling. */
const CANONICAL_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/** GB national peaks around 8-12 GW. Catches an inverted or missing kW->MW conversion. */
const GB_NATIONAL_PEAK_MW = { min: 1_000, max: 20_000 };

/** NL national, against 25.1 GW installed. Same job: a magnitude sanity band, not a value. */
const NL_NATIONAL_PEAK_MW = { min: 1_000, max: 26_000 };

// `undefined` leaking into a value is the bug the domain types exist to prevent: a
// missing reading must arrive as `null`, because `undefined` yields NaN downstream in
// getZoomYMax and the region rollups (B8).
//
// An *absent optional property* is a different thing and is legal — `plevelsMw` is
// optional in types.ts, and GB gsp payloads carry no plevels at all, so it is correctly
// absent rather than an empty object. So this checks the values, not the keys.
type AnyRegionValues = {
  regionName?: string;
  capacityMw?: unknown;
  powerMw?: unknown;
  plevelsMw?: Record<string, unknown>;
};

const expectNoUndefinedValues = (regions: Record<string, AnyRegionValues>): void => {
  for (const [name, region] of Object.entries(regions)) {
    expect(region.regionName ?? name).toBeDefined();
    expect(region.capacityMw).not.toBeUndefined();

    const power = region.powerMw;
    if (Array.isArray(power)) {
      expect(power.some((v) => v === undefined)).toBe(false);
    } else {
      expect(power).not.toBeUndefined();
    }

    for (const series of Object.values(region.plevelsMw ?? {})) {
      const values = Array.isArray(series) ? series : [series];
      expect(values.some((v) => v === undefined)).toBe(false);
    }
  }
};

describe("normalise over recorded v1 payloads", () => {
  test("countries: both live countries, capacity in MW, capabilities intact", () => {
    const result = normaliseCountries(countries as Parameters<typeof normaliseCountries>[0]);

    expect(result.map((c) => c.code)).toEqual(["GB", "NL"]);

    const gb = result.find((c) => c.code === "GB")!;
    expect(gb.name).toBe("Great Britain");
    expect(gb.capacityMw).toBeGreaterThan(1_000);
    expect(gb.centroid).toEqual({ lat: expect.any(Number), lng: expect.any(Number) });

    // Fact 6: models are per region type, not per country, and the defaults differ.
    const gbRegionTypes = Object.fromEntries(gb.regionTypes.map((r) => [r.type, r]));
    expect(gbRegionTypes.national.level).toBe(0);
    expect(gbRegionTypes.gsp.level).toBe(10);
    expect(gbRegionTypes.national.forecastModels.length).toBeGreaterThan(
      gbRegionTypes.gsp.forecastModels.length
    );
    expect(gbRegionTypes.national.defaultModel).not.toBe(gbRegionTypes.gsp.defaultModel);

    // Fact 5: NL has one observer where GB has two, so chart series must be manifest-driven.
    const nl = result.find((c) => c.code === "NL")!;
    expect(gb.generationSources.map((s) => s.name).sort()).toEqual([
      "pvlive_day_after",
      "pvlive_in_day"
    ]);
    expect(nl.generationSources.map((s) => s.name)).toEqual(["ned_nl"]);
  });

  test("regions: every region gets a human label, composite names stay opaque", () => {
    const result = normaliseRegions(gbRegionsGsp as Parameters<typeof normaliseRegions>[0]);

    expect(result.length).toBeGreaterThan(300);
    // Fact 3: raw codes must not reach users, so a label is always populated.
    expect(result.every((r) => r.label.length > 0)).toBe(true);

    const cityRoad = result.find((r) => r.name === "citr_1");
    expect(cityRoad?.label).toBe("City Road");

    // Fact 1: merged regions are pipe-joined composites and are treated as one opaque key.
    const composite = result.find((r) => r.name.includes("|"));
    expect(composite).toBeDefined();
    expect(composite!.name).not.toContain(" ");
  });

  test("national forecast: kW -> MW at a plausible GB magnitude", () => {
    const result = normaliseForecast(gbNationalForecast as Parameters<typeof normaliseForecast>[0]);

    const peakMw = Math.max(...result.values.map((v) => v.powerMw ?? 0));
    expect(peakMw).toBeGreaterThan(GB_NATIONAL_PEAK_MW.min);
    expect(peakMw).toBeLessThan(GB_NATIONAL_PEAK_MW.max);

    // The wire spells instants with `Z`; the domain model must too, and consistently.
    expect(result.values.every((v) => CANONICAL_INSTANT.test(v.timeUtc))).toBe(true);
    expect(result.forecast?.lastUpdatedUtc).toMatch(CANONICAL_INSTANT);

    // Overnight readings are genuine zeros, not missing data (B8).
    const zeros = result.values.filter((v) => v.powerMw === 0);
    expect(zeros.length).toBeGreaterThan(0);
    expect(result.values.every((v) => v.powerMw !== undefined)).toBe(true);

    // Fact 5 / plevels: GB national carries plevels, with no p50 anywhere on the wire.
    const withPlevels = result.values.find((v) => v.plevelsMw && Object.keys(v.plevelsMw).length);
    expect(withPlevels).toBeDefined();
    expect(Object.keys(withPlevels!.plevelsMw!)).not.toContain("p50");

    // **The key shape, which is what the chart and the CSV actually index by.** `PlevelsMw` is
    // documented as keyed by the bare level, and both consumers look up `"10"` / `plevel_10`;
    // the wire sends `p10`, and for a while the prefix was passed straight through, so every
    // lookup missed and no confidence band was ever drawn. Nothing failed — an absent band is a
    // legal state — so this went unseen.
    //
    // Note what the `p50` assertion above could *not* do: it is true whether the keys are
    // `p2, p10, …` or `2, 10, …`, so it agreed with the bug as readily as with the fix. An
    // assertion that cannot come out differently when the thing is broken is not evidence.
    const plevelKeys = Object.keys(withPlevels!.plevelsMw!);
    expect(plevelKeys.every((key) => /^\d+$/.test(key))).toBe(true);
    expect(plevelKeys.sort((a, b) => Number(a) - Number(b))).toEqual([
      "2",
      "10",
      "25",
      "75",
      "90",
      "98"
    ]);
  });

  test("national generation: observer preserved, values in MW", () => {
    const result = normaliseGeneration(
      gbNationalGeneration as Parameters<typeof normaliseGeneration>[0]
    );

    expect(result.observerName).toBe("pvlive_in_day");
    const peakMw = Math.max(...result.values.map((v) => v.powerMw ?? 0));
    expect(peakMw).toBeGreaterThan(GB_NATIONAL_PEAK_MW.min);
    expect(peakMw).toBeLessThan(GB_NATIONAL_PEAK_MW.max);
    expect(result.values.every((v) => CANONICAL_INSTANT.test(v.timeUtc))).toBe(true);
  });

  test.each([
    ["GB gsp forecast", gbGspForecastsPeriod, normaliseForecastMatrix],
    ["GB gsp generation", gbGspGenerationPeriod, normaliseGenerationMatrix],
    ["NL province forecast", nlProvinceForecastsPeriod, normaliseForecastMatrix]
  ])("%s period matrix: columnar -> keyed, index-aligned", (_label, fixture, normalise) => {
    const result = (normalise as (f: unknown) => ReturnType<typeof normaliseForecastMatrix>)(
      fixture
    );

    const regionNames = Object.keys(result.regions);
    expect(regionNames.length).toBeGreaterThan(0);
    expect(result.times.length).toBeGreaterThan(0);
    expect(result.times.every((t) => CANONICAL_INSTANT.test(t))).toBe(true);

    // The whole point of the keyed shape: one entry per region, aligned to the time axis,
    // so the map is an O(1) lookup rather than the old O(n*m) join.
    for (const name of regionNames) {
      expect(result.regions[name].powerMw.length).toBe(result.times.length);
      expect(result.regions[name].regionName).toBe(name);
    }
    expectNoUndefinedValues(result.regions);
  });

  test.each([
    ["forecast", gbGspForecastsSnapshot, normaliseForecastSnapshot],
    ["generation", gbGspGenerationSnapshot, normaliseGenerationSnapshot]
  ])("gsp %s snapshot: one value per region name", (_label, fixture, normalise) => {
    const result = (normalise as (f: unknown) => ReturnType<typeof normaliseForecastSnapshot>)(
      fixture
    );

    expect(result.timeUtc).toMatch(CANONICAL_INSTANT);
    expect(Object.keys(result.regions).length).toBeGreaterThan(100);
    expectNoUndefinedValues(result.regions);
  });

  // A settlement period mid-publish. Observed generation lands per-GSP over a few
  // minutes, so the most recent slot can return a partial set of regions before it
  // completes — `gb-gsp-generation-snapshot-partial.json` caught the 15:00 slot with 127
  // of 336 regions, and the same request 11 minutes later returned all 336.
  //
  // This is a transient the UI will hit at the leading edge, not a coverage gap, and the
  // distinction matters for Phase 4: the absent regions are missing from the payload
  // entirely rather than present with a null value, so a consumer that only checks for
  // null will not notice them. "Not published yet" must render differently from "no
  // data", and neither may be drawn as a zero.
  test("a mid-publish generation snapshot omits regions rather than nulling them", () => {
    const forecast = normaliseForecastSnapshot(
      gbGspForecastsSnapshot as Parameters<typeof normaliseForecastSnapshot>[0]
    );
    const partial = normaliseGenerationSnapshot(
      gbGspGenerationSnapshotPartial as Parameters<typeof normaliseGenerationSnapshot>[0]
    );

    expect(forecast.timeUtc).toBe(partial.timeUtc);

    const forecastRegions = Object.keys(forecast.regions);
    const publishedRegions = new Set(Object.keys(partial.regions));
    const notYetPublished = forecastRegions.filter((name) => !publishedRegions.has(name));

    expect(notYetPublished.length).toBeGreaterThan(0);
    expect(notYetPublished.every((name) => !(name in partial.regions))).toBe(true);

    // Every region that *did* publish carries a real value, which is what makes this
    // publishing lag rather than a data quality problem.
    expect(Object.values(partial.regions).every((r) => r.powerMw !== null)).toBe(true);
  });

  test("a settled generation snapshot covers the same regions as the forecast", () => {
    const generation = normaliseGenerationSnapshot(
      gbGspGenerationSnapshot as Parameters<typeof normaliseGenerationSnapshot>[0]
    );

    // Recorded at a slot old enough to have fully published: complete GSP coverage.
    expect(Object.keys(generation.regions).length).toBe(336);
  });

  // --- NL, the least-exercised country -------------------------------------------------

  test("NL regions: no full_name on the wire, so the label falls back to the raw name", () => {
    const result = normaliseRegions(nlRegionsProvince as Parameters<typeof normaliseRegions>[0]);

    expect(result).toHaveLength(12);
    // This is the fact `GeoLayerConfig.regionNameStyle` exists for, recorded against the real
    // payload rather than assumed: v1 serves NL provinces with `metadata.region_id` and **no**
    // `full_name`, so `Region.label` is the raw lowercase name and the UI must case it itself
    // (`lib/domain/region-label.ts`). If the API ever starts sending `full_name`, this test is
    // what says so, and the registry opt-in can be dropped.
    expect(result.every((region) => region.metadata["full_name"] === undefined)).toBe(true);
    expect(result.every((region) => region.label === region.name)).toBe(true);
    expect(result.every((region) => region.label === region.label.toLowerCase())).toBe(true);
    expect(result.map((region) => region.name)).toContain("noord-brabant");

    // GB is the contrast, and it is what makes the flag a per-region-type decision rather than
    // a global one: its GSP names are codes with a human `full_name` alongside.
    const gb = normaliseRegions(gbRegionsGsp as Parameters<typeof normaliseRegions>[0]);
    expect(gb.some((region) => region.label !== region.name)).toBe(true);
  });

  /**
   * `metadata` is the spec's other free-form object — `additionalProperties` with no declared
   * keys — so `fixtures.contract.test.ts` validates it whatever is inside, and every key the
   * client reads out of it is an unchecked string. Two are load-bearing:
   *
   *  - `gsp_id`, which `buildRegionBridge().byGspId` needs as a **number** to resolve a clicked
   *    Mapbox feature id to a v1 region (`components/helpers/data.ts`). It is typed
   *    `string | integer` in the spec, and the bridge silently skips anything non-numeric — so
   *    a payload that started quoting it would empty the map-click path with no error at all.
   *  - `full_name`, asserted above.
   */
  test("GB gsp metadata carries a numeric gsp_id, which the click-to-chart bridge needs", () => {
    const gb = normaliseRegions(gbRegionsGsp as Parameters<typeof normaliseRegions>[0]);
    const withGspId = gb.filter((region) => typeof region.metadata["gsp_id"] === "number");

    expect(withGspId).toHaveLength(gb.length);
  });

  test("NL national generation: single observer, values in MW", () => {
    const result = normaliseGeneration(
      nlNationalGeneration as Parameters<typeof normaliseGeneration>[0]
    );

    expect(result.observerName).toBe("ned_nl");
    const peakMw = Math.max(...result.values.map((v) => v.powerMw ?? 0));
    expect(peakMw).toBeGreaterThan(NL_NATIONAL_PEAK_MW.min);
    expect(peakMw).toBeLessThan(NL_NATIONAL_PEAK_MW.max);
    expect(result.values.every((v) => CANONICAL_INSTANT.test(v.timeUtc))).toBe(true);
  });

  // --- the seam the schema cannot police ------------------------------------------------

  /**
   * **Two payloads, joined by a key neither of them agrees to spell the same way.**
   *
   * This is the shape of the plevel bug one level up: the OpenAPI spec types the joining field
   * loosely (or types the two sides independently), so `fixtures.contract.test.ts` passes while
   * the client's join silently matches nothing. The app really does this join —
   * `buildRegionBridge().byName` in `components/helpers/data.ts` — keyed on the exact string,
   * and a case or spelling difference between `/regions` and `/forecasts/period` would empty
   * the map with no error anywhere.
   *
   * Asserted per country, because the two have different naming conventions (GB codes,
   * NL lowercase proper nouns) and a rule that holds for one proves nothing about the other.
   */
  test.each([
    ["GB gsp", gbRegionsGsp, gbGspForecastsPeriod],
    ["NL province", nlRegionsProvince, nlProvinceForecastsPeriod]
  ])(
    "%s: every matrix region key exists verbatim in the /regions payload",
    (_l, regions, matrix) => {
      const known = new Set(
        normaliseRegions(regions as Parameters<typeof normaliseRegions>[0]).map((r) => r.name)
      );
      const keyed = Object.keys(
        normaliseForecastMatrix(matrix as Parameters<typeof normaliseForecastMatrix>[0]).regions
      );

      expect(keyed.length).toBeGreaterThan(0);
      expect(keyed.filter((name) => !known.has(name))).toEqual([]);
    }
  );
});

/**
 * The mechanical half: a normaliser that no recorded payload is ever passed through is a seam
 * with nothing watching it, and that is precisely where the plevel bug lived.
 *
 * Read off the module's own exports rather than a list someone remembers to update, so adding a
 * normaliser without a fixture-driven test fails here rather than going unnoticed. It cannot
 * force a *good* assertion — `not.toContain("p50")` passed for months — but it does convert an
 * invisible gap into a red test, which is the failure mode that actually occurred.
 */
describe("every normaliser is exercised by a recorded payload", () => {
  const COVERED = new Set([
    "normaliseCountries",
    "normaliseRegions",
    "normaliseForecast",
    "normaliseGeneration",
    "normaliseForecastMatrix",
    "normaliseGenerationMatrix",
    "normaliseForecastSnapshot",
    "normaliseGenerationSnapshot"
  ]);

  test("no exported normaliser is missing from this suite", () => {
    const exported = Object.keys(normalisers).filter((name) => name.startsWith("normalise"));
    expect(exported.length).toBeGreaterThan(0);
    expect(exported.filter((name) => !COVERED.has(name))).toEqual([]);
  });

  test("the covered list names nothing that no longer exists", () => {
    const exported = new Set(Object.keys(normalisers));
    expect([...COVERED].filter((name) => !exported.has(name))).toEqual([]);
  });
});
