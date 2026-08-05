import { describe, expect, test } from "@jest/globals";

import {
  __test__,
  normaliseCountries,
  normaliseForecast,
  normaliseForecastMatrix,
  normaliseForecastSnapshot,
  normaliseGeneration,
  normaliseGenerationMatrix,
  normaliseGenerationSnapshot,
  normaliseRegions
} from "./normalise";

const { kwToMw, alignToLength, normalisePlevels } = __test__;

// --- kW -> MW: the single most important behaviour in this module ---------------------

describe("kwToMw", () => {
  test("converts a realistic GB national peak into a plausible MW range", () => {
    // ~10-12 GW national peak, i.e. power_kW around 10,000,000.
    const mw = kwToMw(10_500_000);
    expect(mw).toBeGreaterThan(8_000);
    expect(mw).toBeLessThan(15_000);
    expect(mw).toBe(10_500);
  });

  test("a genuine 0 kW survives as 0, not null", () => {
    expect(kwToMw(0)).toBe(0);
  });

  test("null stays null", () => {
    expect(kwToMw(null)).toBeNull();
  });

  test("undefined becomes null, never leaks and never becomes NaN", () => {
    const result = kwToMw(undefined);
    expect(result).toBeNull();
    expect(result).not.toBeUndefined();
    expect(Number.isNaN(result)).toBe(false);
  });
});

describe("normalisePlevels", () => {
  test("converts each plevel key from kW to MW, preserving 0 and null", () => {
    expect(normalisePlevels({ "10": 1_000_000, "90": 0 })).toEqual({ "10": 1000, "90": 0 });
  });

  test("absent plevels object stays absent (undefined), not {}", () => {
    expect(normalisePlevels(undefined)).toBeUndefined();
    expect(normalisePlevels(null)).toBeUndefined();
  });
});

// --- array alignment (matrix defensiveness) --------------------------------------------

describe("alignToLength", () => {
  test("equal length passes through unchanged", () => {
    expect(alignToLength([1, 2, 3], 3)).toEqual([1, 2, 3]);
  });

  test("shorter array is padded with null at the tail", () => {
    expect(alignToLength([1, 2], 4)).toEqual([1, 2, null, null]);
  });

  test("longer array is truncated to the expected length (documented choice, not a throw)", () => {
    expect(alignToLength([1, 2, 3, 4, 5], 3)).toEqual([1, 2, 3]);
  });
});

// --- /countries -------------------------------------------------------------------------

describe("normaliseCountries", () => {
  test("maps capacity kW->MW, centroid, region types and generation sources", () => {
    const result = normaliseCountries([
      {
        country: "GB",
        name: "Great Britain",
        capacity_kW: 15_000_000,
        centroid: { lat: 54.0, lng: -2.5 },
        region_types: [
          {
            type: "gsp",
            label: "GSP",
            level: 10,
            default_model: "blend",
            forecast_models: [{ name: "blend", label: "Blend" }]
          }
        ],
        generation_sources: [{ source: "solar", name: "pvlive_in_day", label: "PVLive (in day)" }]
      }
    ]);

    expect(result).toEqual([
      {
        code: "GB",
        name: "Great Britain",
        capacityMw: 15_000,
        centroid: { lat: 54.0, lng: -2.5 },
        regionTypes: [
          {
            type: "gsp",
            label: "GSP",
            level: 10,
            forecastModels: [{ name: "blend", label: "Blend" }],
            defaultModel: "blend"
          }
        ],
        generationSources: [{ source: "solar", name: "pvlive_in_day", label: "PVLive (in day)" }]
      }
    ]);
  });

  test("missing region_types/generation_sources default to empty arrays, not undefined", () => {
    const [result] = normaliseCountries([
      {
        country: "NL",
        name: "Netherlands",
        capacity_kW: 5_000_000,
        centroid: { lat: 52.1, lng: 5.3 }
      }
    ]);
    expect(result.regionTypes).toEqual([]);
    expect(result.generationSources).toEqual([]);
  });

  test("empty country list", () => {
    expect(normaliseCountries([])).toEqual([]);
  });
});

// --- /regions -----------------------------------------------------------------------

describe("normaliseRegions", () => {
  test("label falls back to the raw region name when metadata.full_name is absent", () => {
    const [result] = normaliseRegions([
      { name: "citr_1", capacity_kW: 100, centroid: { lat: 1, lng: 1 } }
    ]);
    expect(result.label).toBe("citr_1");
    expect(result.metadata).toEqual({});
  });

  test("label uses metadata.full_name when present", () => {
    const [result] = normaliseRegions([
      {
        name: "citr_1",
        type: "gsp",
        capacity_kW: 100,
        centroid: { lat: 1, lng: 1 },
        metadata: { full_name: "City Road" }
      }
    ]);
    expect(result.label).toBe("City Road");
    expect(result.regionType).toBe("gsp");
  });

  test("region name is treated as an opaque key: a pipe-joined merged region is not split", () => {
    const [result] = normaliseRegions([
      { name: "actl_2|cbnk_h|gree_h", capacity_kW: 1, centroid: { lat: 0, lng: 0 } }
    ]);
    expect(result.name).toBe("actl_2|cbnk_h|gree_h");
  });

  test("missing type defaults to null", () => {
    const [result] = normaliseRegions([
      { name: "r1", capacity_kW: 1, centroid: { lat: 0, lng: 0 } }
    ]);
    expect(result.regionType).toBeNull();
  });

  test("empty region list", () => {
    expect(normaliseRegions([])).toEqual([]);
  });
});

// --- /regions/{region}/forecast --------------------------------------------------------

describe("normaliseForecast", () => {
  test("converts values, plevels, and metadata; Z and +00:00 converge to the same instant", () => {
    const result = normaliseForecast({
      region_name: "national_GB",
      capacity_kW: 15_000_000,
      model_name: "blend",
      model_version: "1.2.3",
      last_updated_utc: "2026-08-05T14:43:00Z",
      latest_init_utc: "2026-08-05T14:00:00+00:00",
      horizon_minutes: 60,
      values: [
        {
          time_utc: "2026-08-05T14:43:00Z",
          power_kW: 10_500_000,
          plevels_kW: { "10": 9_000_000, "90": 12_000_000 }
        },
        { time_utc: "2026-08-05T14:48:00Z", power_kW: 0 }
      ]
    });

    expect(result.regionName).toBe("national_GB");
    expect(result.capacityMw).toBe(15_000);
    expect(result.values[0]).toEqual({
      timeUtc: "2026-08-05T14:43:00Z",
      powerMw: 10_500,
      plevelsMw: { "10": 9_000, "90": 12_000 }
    });
    // A genuine 0 kW reading survives as 0, and the absent plevels_kW stays undefined.
    expect(result.values[1].powerMw).toBe(0);
    expect(result.values[1].plevelsMw).toBeUndefined();
    expect(result.forecast).toEqual({
      modelName: "blend",
      modelVersion: "1.2.3",
      lastUpdatedUtc: "2026-08-05T14:43:00Z",
      latestInitUtc: "2026-08-05T14:00:00Z",
      horizonMinutes: 60
    });
  });

  test("null/absent metadata passes through as null, not undefined", () => {
    const result = normaliseForecast({
      region_name: "r1",
      capacity_kW: 1000,
      values: []
    });
    expect(result.forecast).toEqual({
      modelName: null,
      modelVersion: null,
      lastUpdatedUtc: null,
      latestInitUtc: null,
      horizonMinutes: null
    });
    expect(result.values).toEqual([]);
  });
});

// --- /regions/{region}/generation -------------------------------------------------------

describe("normaliseGeneration", () => {
  test("converts values and observer name; no plevels field on generation", () => {
    const result = normaliseGeneration({
      region_name: "national_GB",
      capacity_kW: 15_000_000,
      observer_name: "pvlive_in_day",
      values: [{ time_utc: "2026-08-05T14:43:00Z", power_kW: 0 }]
    });
    expect(result.observerName).toBe("pvlive_in_day");
    expect(result.values[0].powerMw).toBe(0);
    expect((result.values[0] as { plevelsMw?: unknown }).plevelsMw).toBeUndefined();
  });

  test("missing observer_name becomes null", () => {
    const result = normaliseGeneration({ region_name: "r1", capacity_kW: 1, values: [] });
    expect(result.observerName).toBeNull();
  });
});

// --- /forecasts/period ------------------------------------------------------------------

describe("normaliseForecastMatrix", () => {
  const times_utc = ["2026-08-05T14:00:00Z", "2026-08-05T14:05:00Z", "2026-08-05T14:10:00Z"];

  test("keys regions by name, converts power and plevel arrays, preserves null/0", () => {
    const result = normaliseForecastMatrix({
      model_name: "blend",
      model_version: "2.0",
      last_updated_utc: "2026-08-05T14:10:00Z",
      latest_init_utc: "2026-08-05T14:00:00Z",
      cache_updated_utc: "2026-08-05T14:10:00Z",
      times_utc,
      regions: [
        {
          region_name: "citr_1",
          capacity_kW: 1_000_000,
          power_kW: [10_500_000, 0, 10_000_000],
          plevels_kW: { "10": [9_000_000, 0, 8_000_000] }
        }
      ]
    });

    expect(result.times).toEqual(times_utc);
    expect(result.regions["citr_1"].powerMw).toEqual([10_500, 0, 10_000]);
    expect(result.regions["citr_1"].plevelsMw).toEqual({ "10": [9_000, 0, 8_000] });
    expect(result.cacheUpdatedUtc).toBe("2026-08-05T14:10:00Z");
  });

  test("a region's power_kW shorter than times_utc is padded with null, not truncated silently to 0", () => {
    const result = normaliseForecastMatrix({
      times_utc,
      regions: [{ region_name: "r1", capacity_kW: 1, power_kW: [1000, 2000] }]
    });
    expect(result.regions["r1"].powerMw).toEqual([1, 2, null]);
  });

  test("a region's power_kW longer than times_utc is truncated to times.length", () => {
    const result = normaliseForecastMatrix({
      times_utc,
      regions: [{ region_name: "r1", capacity_kW: 1, power_kW: [1000, 2000, 3000, 4000, 5000] }]
    });
    expect(result.regions["r1"].powerMw).toEqual([1, 2, 3]);
  });

  test("duplicate region names: last entry wins", () => {
    const result = normaliseForecastMatrix({
      times_utc,
      regions: [
        { region_name: "dup", capacity_kW: 1, power_kW: [1000, 1000, 1000] },
        { region_name: "dup", capacity_kW: 2, power_kW: [2000, 2000, 2000] }
      ]
    });
    expect(result.regions["dup"].capacityMw).toBe(0.002);
    expect(result.regions["dup"].powerMw).toEqual([2, 2, 2]);
    expect(Object.keys(result.regions)).toEqual(["dup"]);
  });

  test("empty regions and empty times_utc", () => {
    const result = normaliseForecastMatrix({ times_utc: [], regions: [] });
    expect(result.times).toEqual([]);
    expect(result.regions).toEqual({});
  });

  test("missing optional metadata becomes null", () => {
    const result = normaliseForecastMatrix({ times_utc, regions: [] });
    expect(result.forecast).toEqual({
      modelName: null,
      modelVersion: null,
      lastUpdatedUtc: null,
      latestInitUtc: null
    });
    expect(result.cacheUpdatedUtc).toBeNull();
  });
});

// --- /generation/period ------------------------------------------------------------------

describe("normaliseGenerationMatrix", () => {
  const times_utc = ["2026-08-05T14:00:00Z", "2026-08-05T14:05:00Z"];

  test("keys regions by name and converts power arrays; no plevels on generation", () => {
    const result = normaliseGenerationMatrix({
      observer_name: "ned_nl",
      cache_updated_utc: "2026-08-05T14:05:00Z",
      times_utc,
      regions: [{ region_name: "prov_1", capacity_kW: 500_000, power_kW: [0, 250_000] }]
    });
    expect(result.regions["prov_1"].powerMw).toEqual([0, 250]);
    expect(result.observerName).toBe("ned_nl");
    expect((result.regions["prov_1"] as { plevelsMw?: unknown }).plevelsMw).toBeUndefined();
  });

  test("merged region names (pipe-joined) are kept as opaque keys", () => {
    const result = normaliseGenerationMatrix({
      times_utc,
      regions: [{ region_name: "actl_2|cbnk_h|gree_h", capacity_kW: 1, power_kW: [1000, 2000] }]
    });
    expect(Object.keys(result.regions)).toEqual(["actl_2|cbnk_h|gree_h"]);
  });
});

// --- /forecasts/snapshot -----------------------------------------------------------------

describe("normaliseForecastSnapshot", () => {
  test("keys regions by name and converts a single power+plevels value each", () => {
    const result = normaliseForecastSnapshot({
      time_utc: "2026-08-05T14:43:00Z",
      model_name: "blend",
      values: [
        {
          region_name: "citr_1",
          capacity_kW: 1_000_000,
          power_kW: 0,
          plevels_kW: { "10": 100_000, "90": 900_000 }
        },
        { region_name: "citr_2", capacity_kW: 500_000, power_kW: 250_000, plevels_kW: null }
      ]
    });

    expect(result.timeUtc).toBe("2026-08-05T14:43:00Z");
    expect(result.regions["citr_1"].powerMw).toBe(0);
    expect(result.regions["citr_1"].plevelsMw).toEqual({ "10": 100, "90": 900 });
    expect(result.regions["citr_2"].plevelsMw).toBeUndefined();
  });

  test("duplicate region names: last entry wins", () => {
    const result = normaliseForecastSnapshot({
      time_utc: "2026-08-05T14:43:00Z",
      values: [
        { region_name: "dup", capacity_kW: 1, power_kW: 1000 },
        { region_name: "dup", capacity_kW: 2, power_kW: 2000 }
      ]
    });
    expect(result.regions["dup"].powerMw).toBe(2);
  });

  test("empty values", () => {
    const result = normaliseForecastSnapshot({ time_utc: "2026-08-05T14:43:00Z", values: [] });
    expect(result.regions).toEqual({});
  });
});

// --- /generation/snapshot -----------------------------------------------------------------

describe("normaliseGenerationSnapshot", () => {
  test("keys regions by name and converts power; no plevels on generation snapshots", () => {
    const result = normaliseGenerationSnapshot({
      time_utc: "2026-08-05T14:43:00Z",
      observer_name: "pvlive_in_day",
      values: [{ region_name: "citr_1", capacity_kW: 1_000_000, power_kW: 0 }]
    });
    expect(result.regions["citr_1"].powerMw).toBe(0);
    expect(result.observerName).toBe("pvlive_in_day");
    expect((result.regions["citr_1"] as { plevelsMw?: unknown }).plevelsMw).toBeUndefined();
  });

  test("missing observer_name becomes null", () => {
    const result = normaliseGenerationSnapshot({ time_utc: "2026-08-05T14:43:00Z", values: [] });
    expect(result.observerName).toBeNull();
  });
});
