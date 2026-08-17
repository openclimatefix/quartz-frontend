import { readFileSync } from "fs";
import { join } from "path";

import { describe, expect, test } from "@jest/globals";

import { defaultSeriesStart } from "./series-window";
import { toUtcInstant } from "../../domain/time";

import {
  forecast,
  forecastLastUpdated,
  forecastPeriod,
  forecastSnapshot,
  generation,
  generationPeriod,
  generationSnapshot,
  generationSources,
  queryKey,
  region,
  regionTypes,
  regions,
  sources,
  countries
} from "./queries";
import type { Scope } from "../../domain/types";

const scopes: Record<"GB" | "NL", Scope> = {
  GB: { country: "GB", source: "solar", regionType: "gsp", region: "1" },
  NL: { country: "NL", source: "solar", regionType: "province", region: "Zuid-Holland" }
};

describe("discovery endpoints", () => {
  test("sources and countries take no params", () => {
    expect(sources()).toEqual({ path: "/sources", params: {} });
    expect(countries()).toEqual({ path: "/countries", params: {} });
  });

  test.each(["GB", "NL"] as const)("regionTypes for %s", (code) => {
    const scope = scopes[code];
    expect(regionTypes(scope)).toEqual({
      path: "/{country}/{source}/region-types",
      params: { path: { country: scope.country, source: scope.source } }
    });
  });

  test.each(["GB", "NL"] as const)("generationSources for %s", (code) => {
    const scope = scopes[code];
    expect(generationSources(scope)).toEqual({
      path: "/{country}/{source}/generation-sources",
      params: { path: { country: scope.country, source: scope.source } }
    });
  });

  test.each(["GB", "NL"] as const)("region for %s", (code) => {
    const scope = scopes[code];
    expect(region({ ...scope, region: scope.region as string })).toEqual({
      path: "/{country}/{source}/regions/{region}",
      params: { path: { country: scope.country, source: scope.source, region: scope.region } }
    });
  });

  test.each(["GB", "NL"] as const)("regions for %s omits undefined filters", (code) => {
    const scope = scopes[code];
    expect(regions(scope)).toEqual({
      path: "/{country}/{source}/regions",
      params: { path: { country: scope.country, source: scope.source }, query: {} }
    });
  });

  test("regions applies filters and omits absent ones", () => {
    const descriptor = regions(scopes.GB, { regionType: "gsp", name: "bristol" });
    expect(descriptor.params.query).toEqual({ region_type: "gsp", name: "bristol" });
    expect(descriptor.params.query).not.toHaveProperty("parent");
  });
});

describe("no hardcoded country or source", () => {
  test("descriptors are driven entirely by the scope argument", () => {
    const gb = forecast({ ...scopes.GB, region: "1" });
    const nl = forecast({ ...scopes.NL, region: "Zuid-Holland" });
    expect(gb.params.path.country).toBe("GB");
    expect(nl.params.path.country).toBe("NL");
    // Every function in the module is exercised in this file — grep the source itself
    // rather than trust any one call site.
    const source = readFileSync(join(__dirname, "queries.ts"), "utf-8");
    // Only string literals, not identifiers like `country`/`source`/comments mentioning them.
    expect(source).not.toMatch(/["'`]GB["'`]/);
    expect(source).not.toMatch(/["'`]NL["'`]/);
    expect(source).not.toMatch(/["'`]solar["'`]/);
  });
});

describe("forecast", () => {
  test.each(["GB", "NL"] as const)("path and params for %s", (code) => {
    const scope = scopes[code];
    const descriptor = forecast(
      { ...scope, region: scope.region as string },
      {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-02T00:00:00Z",
        creationLimit: "2024-01-01T06:00:00Z",
        horizonMinutes: 60,
        model: "pvnet_intraday"
      }
    );
    expect(descriptor).toEqual({
      path: "/{country}/{source}/regions/{region}/forecast",
      params: {
        path: { country: scope.country, source: scope.source, region: scope.region },
        query: {
          start_utc: "2024-01-01T00:00:00Z",
          end_utc: "2024-01-02T00:00:00Z",
          creation_limit_utc: "2024-01-01T06:00:00Z",
          horizon_minutes: 60,
          model: "pvnet_intraday"
        }
      }
    });
  });

  test("supplies the shared history start when none is given, and nothing else", () => {
    // Changed 2026-08-16: this used to assert `{}`. The endpoint's own default is now → +48h,
    // i.e. no past at all, so "omit everything" meant every caller that forgot to pin a start
    // silently got a series with no history — which is exactly what happened to the
    // selected-GSP chart. The default lives in `series-window.ts` now and is applied here.
    const descriptor = forecast({ ...scopes.GB, region: "1" });
    expect(descriptor.params.query).toEqual({ start_utc: toUtcInstant(defaultSeriesStart()) });
  });

  test("the default start is on a 6-hour UTC boundary, so the cache key survives scrubbing", () => {
    // Not cosmetic: an unfloored "now minus two days" changes on every render and refetches
    // every series on every tick of the scrubber.
    const startUtc = forecast({ ...scopes.GB, region: "1" }).params.query?.start_utc as string;
    expect(startUtc).toMatch(/T(00|06|12|18):00:00Z$/);
  });

  test("an explicit start wins over the default", () => {
    // The property a selectable time-window control depends on: pass a window in and it is
    // used, untouched. The default only fills a gap.
    const descriptor = forecast({ ...scopes.GB, region: "1" }, { start: "2024-01-01T00:00:00Z" });
    expect(descriptor.params.query?.start_utc).toBe("2024-01-01T00:00:00Z");
  });

  test("the period endpoints are deliberately left unwindowed", () => {
    // They are served from a cache pre-warmed on the API's own default window, so pinning our
    // own start risks missing the warm path as well as truncating. If this ever starts sending
    // a start_utc, the map's requests have quietly left the warm path.
    expect(forecastPeriod(scopes.GB).params.query).toEqual({ region_type: scopes.GB.regionType });
  });

  test("a +01:00 offset and the equivalent Z instant normalise to the same param string", () => {
    const withOffset = forecast(
      { ...scopes.GB, region: "1" },
      { start: "2024-01-01T01:00:00+01:00" }
    );
    const withZ = forecast({ ...scopes.GB, region: "1" }, { start: "2024-01-01T00:00:00Z" });
    expect(withOffset.params.query?.start_utc).toBe(withZ.params.query?.start_utc);
    expect(withOffset.params.query?.start_utc).toBe("2024-01-01T00:00:00Z");
  });
});

describe("forecastLastUpdated", () => {
  test.each(["GB", "NL"] as const)("path and params for %s", (code) => {
    const scope = scopes[code];
    expect(forecastLastUpdated({ ...scope, region: scope.region as string }, "blend")).toEqual({
      path: "/{country}/{source}/regions/{region}/forecast/last-updated",
      params: {
        path: { country: scope.country, source: scope.source, region: scope.region },
        query: { model: "blend" }
      }
    });
  });

  test("omits model when not supplied", () => {
    const descriptor = forecastLastUpdated({ ...scopes.GB, region: "1" });
    expect(descriptor.params.query).toEqual({});
  });
});

describe("forecastSnapshot", () => {
  test.each(["GB", "NL"] as const)("path and params for %s", (code) => {
    const scope = scopes[code];
    const descriptor = forecastSnapshot(scope, {
      modelName: "blend",
      modelVersion: "1.2.3",
      time: "2024-01-01T00:00:00Z"
    });
    expect(descriptor).toEqual({
      path: "/{country}/{source}/forecasts/snapshot",
      params: {
        path: { country: scope.country, source: scope.source },
        query: {
          region_type: scope.regionType,
          model_name: "blend",
          model_version: "1.2.3",
          time_utc: "2024-01-01T00:00:00Z"
        }
      }
    });
  });
});

describe("forecastPeriod", () => {
  test.each(["GB", "NL"] as const)("path and params for %s", (code) => {
    const scope = scopes[code];
    const descriptor = forecastPeriod(scope, {
      start: "2024-01-01T00:00:00Z",
      end: "2024-01-02T00:00:00Z",
      regionNames: ["a", "b"]
    });
    expect(descriptor).toEqual({
      path: "/{country}/{source}/forecasts/period",
      params: {
        path: { country: scope.country, source: scope.source },
        query: {
          region_type: scope.regionType,
          start_utc: "2024-01-01T00:00:00Z",
          end_utc: "2024-01-02T00:00:00Z",
          region_names: ["a", "b"]
        }
      }
    });
  });

  test("omits regionNames when not supplied", () => {
    const descriptor = forecastPeriod(scopes.GB);
    expect(descriptor.params.query).not.toHaveProperty("region_names");
  });
});

describe("generation", () => {
  test.each(["GB", "NL"] as const)("path and params for %s", (code) => {
    const scope = scopes[code];
    const descriptor = generation(
      { ...scope, region: scope.region as string },
      { observer: "pvlive_in_day", start: "2024-01-01T00:00:00Z", end: "2024-01-02T00:00:00Z" }
    );
    expect(descriptor).toEqual({
      path: "/{country}/{source}/regions/{region}/generation",
      params: {
        path: { country: scope.country, source: scope.source, region: scope.region },
        query: {
          observer: "pvlive_in_day",
          start_utc: "2024-01-01T00:00:00Z",
          end_utc: "2024-01-02T00:00:00Z"
        }
      }
    });
  });
});

describe("generationSnapshot", () => {
  test.each(["GB", "NL"] as const)("path and params for %s", (code) => {
    const scope = scopes[code];
    const descriptor = generationSnapshot(scope, {
      observer: "pvlive_day_after",
      time: "2024-01-01T00:00:00Z"
    });
    expect(descriptor).toEqual({
      path: "/{country}/{source}/generation/snapshot",
      params: {
        path: { country: scope.country, source: scope.source },
        query: {
          region_type: scope.regionType,
          observer: "pvlive_day_after",
          time_utc: "2024-01-01T00:00:00Z"
        }
      }
    });
  });
});

describe("generationPeriod", () => {
  test.each(["GB", "NL"] as const)("path and params for %s", (code) => {
    const scope = scopes[code];
    const descriptor = generationPeriod(scope, {
      observer: "pvlive_in_day",
      start: "2024-01-01T00:00:00Z",
      end: "2024-01-02T00:00:00Z",
      regionNames: ["a"]
    });
    expect(descriptor).toEqual({
      path: "/{country}/{source}/generation/period",
      params: {
        path: { country: scope.country, source: scope.source },
        query: {
          region_type: scope.regionType,
          observer: "pvlive_in_day",
          start_utc: "2024-01-01T00:00:00Z",
          end_utc: "2024-01-02T00:00:00Z",
          region_names: ["a"]
        }
      }
    });
  });
});

describe("queryKey", () => {
  test("is stable for the same descriptor", () => {
    const descriptor = forecastPeriod(scopes.GB, { start: "2024-01-01T00:00:00Z" });
    expect(queryKey(descriptor)).toBe(queryKey(descriptor));
  });

  test("is insensitive to the order params were supplied in", () => {
    const a = {
      path: "/{country}/{source}/forecasts/period" as const,
      params: {
        path: { country: "GB", source: "solar" },
        query: { region_type: "gsp", start_utc: "2024-01-01T00:00:00Z", end_utc: undefined }
      }
    };
    const b = {
      path: "/{country}/{source}/forecasts/period" as const,
      params: {
        path: { source: "solar", country: "GB" },
        query: { end_utc: undefined, start_utc: "2024-01-01T00:00:00Z", region_type: "gsp" }
      }
    };
    expect(queryKey(a)).toBe(queryKey(b));
  });

  test("includes the country, so different countries never collide", () => {
    const gb = forecastPeriod(scopes.GB);
    const nl = forecastPeriod(scopes.NL);
    expect(queryKey(gb)).not.toBe(queryKey(nl));
    expect(queryKey(gb)).toContain("GB");
    expect(queryKey(nl)).toContain("NL");
  });

  test("distinguishes descriptors that otherwise share a path template", () => {
    const withRegion = forecast({ ...scopes.GB, region: "1" });
    const withOtherRegion = forecast({ ...scopes.GB, region: "2" });
    expect(queryKey(withRegion)).not.toBe(queryKey(withOtherRegion));
  });
});
