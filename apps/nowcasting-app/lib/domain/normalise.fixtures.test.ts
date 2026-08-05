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

// normalise.test.ts covers the behaviour with hand-built samples; this suite runs the
// same functions over payloads recorded verbatim from the production v1 API, which is
// what catches the difference between what the spec promises and what the wire sends.
// See lib/api/v1/__fixtures__/README.md for how each fixture was recorded.

/** Every instant the domain model emits must be in the one canonical spelling. */
const CANONICAL_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/** GB national peaks around 8-12 GW. Catches an inverted or missing kW->MW conversion. */
const GB_NATIONAL_PEAK_MW = { min: 1_000, max: 20_000 };

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
});
