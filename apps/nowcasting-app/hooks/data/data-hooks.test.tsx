/**
 * MSW + RTL over the real Phase 2 machinery — `queries` -> `client` -> `normalise` — against
 * the recorded production fixtures. Nothing here invents a wire shape where a fixture exists;
 * the two payloads that are built by hand (a snapshot carrying an explicit `null`, and a
 * second country's national forecast) are derived from recorded ones, because no recording
 * captured those exact cases.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test
} from "@jest/globals";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { SWRConfig } from "swr";

jest.mock("next/router", () => ({ __esModule: true, default: { push: jest.fn() } }));
jest.mock("@sentry/nextjs", () => ({ __esModule: true, captureException: jest.fn() }));
jest.mock("@auth0/nextjs-auth0/client", () => ({
  __esModule: true,
  useUser: () => ({ user: null, isLoading: false, error: undefined })
}));

import countriesFixture from "../../lib/api/v1/__fixtures__/countries.json";
import error400Fixture from "../../lib/api/v1/__fixtures__/error-400-national-on-period-endpoint.json";
import error422Fixture from "../../lib/api/v1/__fixtures__/error-422-missing-required-query-param.json";
import gbGspForecastPeriod from "../../lib/api/v1/__fixtures__/gb-gsp-forecasts-period.json";
import gbGspForecastSnapshot from "../../lib/api/v1/__fixtures__/gb-gsp-forecasts-snapshot.json";
import gbGspGenerationPeriod from "../../lib/api/v1/__fixtures__/gb-gsp-generation-period.json";
import gbGspGenerationSnapshot from "../../lib/api/v1/__fixtures__/gb-gsp-generation-snapshot.json";
import gbGspGenerationSnapshotPartial from "../../lib/api/v1/__fixtures__/gb-gsp-generation-snapshot-partial.json";
import gbNationalForecast from "../../lib/api/v1/__fixtures__/gb-national-forecast.json";
import gbNationalGenerationInDay from "../../lib/api/v1/__fixtures__/gb-national-generation-pvlive_in_day.json";
import gbRegionsGsp from "../../lib/api/v1/__fixtures__/gb-regions-gsp.json";
import nlProvinceForecastPeriod from "../../lib/api/v1/__fixtures__/nl-province-forecasts-period.json";
import nlRegionsProvince from "../../lib/api/v1/__fixtures__/nl-regions-province.json";
import { resetTokenCache } from "../../lib/api/auth/token";
import type { Scope } from "../../lib/domain/types";
import { describeApiError } from "./query";
import { regionSnapshotPowerMw, regionSnapshotState, snapshotCoverage } from "./snapshot-state";
import {
  useForecastLastUpdated,
  useForecastPeriod,
  useForecastSnapshot,
  useNationalForecast,
  useRegionForecast
} from "./use-forecast";
import {
  useGenerationPeriod,
  useGenerationSnapshot,
  useNationalGeneration
} from "./use-generation";
import { useGenerationSources, useRegionTypes, useRegions } from "./use-regions";

const V1 = "https://api.quartz.solar/v1";

const GB_NATIONAL: Scope = { country: "GB", source: "solar", regionType: "national" };
const GB_GSP: Scope = { country: "GB", source: "solar", regionType: "gsp" };
const NL_NATIONAL: Scope = { country: "NL", source: "solar", regionType: "national" };
const NL_PROVINCE: Scope = { country: "NL", source: "solar", regionType: "province" };

/** Requests seen, keyed by pathname, so dedupe and fanout are assertions rather than vibes. */
let requests: { path: string; url: URL }[] = [];
const countRequests = (path: string) => requests.filter((r) => r.path === path).length;
const lastQuery = (path: string) =>
  requests.filter((r) => r.path === path).slice(-1)[0]?.url.searchParams;

// `API_V1_PREFIX` ends in `/v1`, so the intercepted pathname carries it. Strip it so the
// assertions read as the endpoint paths the plan's endpoint-mapping table names.
const record = (request: Request) => {
  const url = new URL(request.url);
  requests.push({ path: url.pathname.replace(/^\/v1/, ""), url });
};

const json = (path: string, body: Parameters<typeof HttpResponse.json>[0]) =>
  http.get(`${V1}${path}`, ({ request }) => {
    record(request);
    return HttpResponse.json(body);
  });

// An NL national forecast is not among the recordings; derived from the GB one so the fanout
// test asserts on a value that could only have come from the NL request.
const nlNationalForecast = {
  ...gbNationalForecast,
  region_name: "Nederland",
  capacity_kW: 25000000,
  values: gbNationalForecast.values.slice(0, 4).map((v, i) => ({ ...v, power_kW: 1000 * (i + 1) }))
};

const server = setupServer(
  http.get("/api/get_token", () => HttpResponse.json({ accessToken: "test-token" })),
  json("/countries", countriesFixture),
  json("/GB/solar/regions/national/forecast", gbNationalForecast),
  json("/GB/solar/regions/national/forecast/last-updated", "2026-08-05T15:10:00.123456Z"),
  json("/GB/solar/regions/national/generation", gbNationalGenerationInDay),
  json("/GB/solar/regions/citr_1/forecast", gbNationalForecast),
  json("/GB/solar/regions", gbRegionsGsp),
  json("/GB/solar/forecasts/period", gbGspForecastPeriod),
  json("/GB/solar/forecasts/snapshot", gbGspForecastSnapshot),
  json("/GB/solar/generation/period", gbGspGenerationPeriod),
  json("/GB/solar/generation/snapshot", gbGspGenerationSnapshot),
  json("/NL/solar/regions/national/forecast", nlNationalForecast),
  json("/NL/solar/regions", nlRegionsProvince),
  json("/NL/solar/forecasts/period", nlProvinceForecastPeriod)
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  requests = [];
});
afterAll(() => server.close());
beforeEach(() => resetTokenCache());

// A fresh SWR cache per render, so one test's cached response cannot satisfy the next test's
// request and hide a fetch that should have happened.
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
);

const render = <T,>(hook: () => T) => renderHook(hook, { wrapper });

const settled = async <T extends { isLoading: boolean }>(result: { current: T }) => {
  await waitFor(() => expect(result.current.isLoading).toBe(false));
};

/**
 * Wait for several hooks rendered by one `renderHook`, re-rendering on every poll.
 *
 * Both parts are load-bearing, and both are harness artefacts rather than anything about the
 * hooks. Read this before writing a view test that renders a container with several hooks in
 * it, because the failure mode looks exactly like a broken hook.
 *
 * 1. **One `waitFor`, not two sequential ones.** The first one's `act()` scope closes before
 *    the other requests have resolved, and their updates then land outside any act scope,
 *    where a second `waitFor` never picks them up.
 * 2. **`rerender()` inside the polling callback.** When two hooks with *distinct* keys resolve
 *    within a few microseconds of each other, the second component update is dropped: SWR's
 *    cache does hold the second response — verified by reading the cache map directly at the
 *    point of timeout, where both entries had `data` — but the hook it belongs to keeps
 *    reporting `isLoading: true` indefinitely, because no render was ever scheduled for it.
 *    Forcing a render re-reads the already-correct snapshot. Anything that widens the gap
 *    between the two resolutions — even one extra statement in the render callback — hides
 *    it, which is why it presents as flakiness that moves with unrelated edits.
 *
 * Hooks sharing one key are unaffected (one cache entry, one notification), which is why the
 * dedupe test passed throughout.
 */
const bothSettled = async <T extends Record<string, { isLoading: boolean }>>(
  view: { result: { current: T }; rerender: () => void },
  ...keys: (keyof T)[]
) => {
  await waitFor(() => {
    view.rerender();
    for (const key of keys) expect(view.result.current[key].isLoading).toBe(false);
  });
};

describe("forecast hooks", () => {
  test("useNationalForecast normalises kW to MW and keys on the national path alias", async () => {
    const { result } = render(() => useNationalForecast(GB_NATIONAL));
    await settled(result);

    expect(countRequests("/GB/solar/regions/national/forecast")).toBe(1);
    expect(result.current.data?.regionName).toBe("Great Britain");
    // 21_905_152 kW on the wire; MW is what every chart, the CSV and Y_MAX_TICKS assume.
    expect(result.current.data?.capacityMw).toBeCloseTo(21905.152, 3);
    expect(result.current.data?.forecast?.modelName).toBe("blend_adjust");
    expect(result.current.data?.values[0].timeUtc).toBe("2026-08-04T00:00:00Z");
    expect(result.current.error).toBeUndefined();
  });

  // Model comparison is national-only, confirmed against the code being replaced: every
  // `model_name` in pages/index.tsx is on the national forecast endpoint and no regional view
  // offers a picker. `period` has no `model` param, so this endpoint is where it has to live.
  test("useNationalForecast passes the model through and keys separately per model", async () => {
    const view = render(() => ({
      blend: useNationalForecast(GB_NATIONAL, { model: "blend" }),
      adjust: useNationalForecast(GB_NATIONAL, { model: "blend_adjust" })
    }));
    await bothSettled(view, "blend", "adjust");

    expect(countRequests("/GB/solar/regions/national/forecast")).toBe(2);
    const models = requests
      .filter((r) => r.path === "/GB/solar/regions/national/forecast")
      .map((r) => r.url.searchParams.get("model"));
    expect(models.sort()).toEqual(["blend", "blend_adjust"]);
  });

  test("useNationalForecast sends no model when none is asked for, letting the API default", async () => {
    const { result } = render(() => useNationalForecast(GB_NATIONAL));
    await settled(result);
    expect(lastQuery("/GB/solar/regions/national/forecast")?.has("model")).toBe(false);
  });

  test("useRegionForecast addresses the region named in the scope", async () => {
    const { result } = render(() => useRegionForecast({ ...GB_GSP, region: "citr_1" }));
    await settled(result);
    expect(countRequests("/GB/solar/regions/citr_1/forecast")).toBe(1);
  });

  // "gsp" is a region type, never a region. Sending it as a path segment would 404; the query
  // is disabled until the user has selected one.
  test("a region-scoped hook with no region does not fetch", async () => {
    const { result } = render(() => useRegionForecast(GB_GSP));
    await settled(result);
    expect(requests).toHaveLength(0);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeUndefined();
  });

  test("a null scope does not fetch", async () => {
    const { result } = render(() => useNationalForecast(null));
    await settled(result);
    expect(requests).toHaveLength(0);
  });

  test("useForecastPeriod turns the columnar matrix into a name-keyed series", async () => {
    const { result } = render(() =>
      useForecastPeriod(GB_GSP, { start: "2026-08-04T00:00:00Z", end: "2026-08-06T00:00:00Z" })
    );
    await settled(result);

    const query = lastQuery("/GB/solar/forecasts/period");
    expect(query?.get("region_type")).toBe("gsp");
    expect(query?.get("start_utc")).toBe("2026-08-04T00:00:00Z");
    // No model parameter exists on this endpoint — the region type's default is what is
    // pre-warmed. A regional time series is pinned to it by design.
    expect(query?.has("model")).toBe(false);

    expect(result.current.data?.times[0]).toBe("2026-08-04T00:00:00Z");
    const citr = result.current.data?.regions["citr_1"];
    expect(citr?.powerMw).toHaveLength(result.current.data?.times.length ?? 0);
    expect(citr?.powerMw[10]).toBeCloseTo(0.029, 6);
  });

  test("useForecastSnapshot sends model_name, unlike period", async () => {
    const { result } = render(() =>
      useForecastSnapshot(GB_GSP, { modelName: "blend", time: "2026-08-05T15:00:00Z" })
    );
    await settled(result);
    const query = lastQuery("/GB/solar/forecasts/snapshot");
    expect(query?.get("model_name")).toBe("blend");
    expect(query?.get("time_utc")).toBe("2026-08-05T15:00:00Z");
    expect(result.current.data?.regions["citr_1"].powerMw).toBeCloseTo(2.026439, 6);
  });

  test("useForecastLastUpdated canonicalises the bare instant it is given", async () => {
    const { result } = render(() => useForecastLastUpdated(GB_NATIONAL));
    await settled(result);
    // Sub-second precision is truncated by the shared canonicaliser, as everywhere else.
    expect(result.current.data).toBe("2026-08-05T15:10:00Z");
  });
});

describe("generation hooks", () => {
  test("useNationalGeneration passes the observer and keys separately per observer", async () => {
    const view = render(() => ({
      inDay: useNationalGeneration(GB_NATIONAL, { observer: "pvlive_in_day" }),
      dayAfter: useNationalGeneration(GB_NATIONAL, { observer: "pvlive_day_after" })
    }));
    await bothSettled(view, "inDay", "dayAfter");

    expect(countRequests("/GB/solar/regions/national/generation")).toBe(2);
    expect(view.result.current.inDay.data?.observerName).toBe("pvlive_in_day");
  });

  test("useGenerationPeriod normalises the matrix", async () => {
    const { result } = render(() => useGenerationPeriod(GB_GSP, { observer: "pvlive_in_day" }));
    await settled(result);
    expect(lastQuery("/GB/solar/generation/period")?.get("observer")).toBe("pvlive_in_day");
    expect(Object.keys(result.current.data?.regions ?? {}).length).toBeGreaterThan(0);
  });
});

describe("the absent / null / zero distinction", () => {
  // The newest generation slot publishes region by region and can be read mid-fill: 127 of
  // 336 regions in this recording, complete 11 minutes later. Regions still to publish are
  // absent from the payload, not present with null — three states, three renderings.
  test("a region missing from a partial snapshot reads as unpublished, not as no-data", async () => {
    server.use(json("/GB/solar/generation/snapshot", gbGspGenerationSnapshotPartial));
    const { result } = render(() => useGenerationSnapshot(GB_GSP));
    await settled(result);

    const published = gbGspGenerationSnapshotPartial.values.map((v) => v.region_name);
    const complete = gbGspGenerationSnapshot.values.map((v) => v.region_name);
    const missing = complete.find((name) => !published.includes(name));

    expect(published).toHaveLength(127);
    expect(regionSnapshotState(result.current.data, published[0])).toBe("value");
    expect(regionSnapshotState(result.current.data, missing as string)).toBe("unpublished");
    expect(result.current.data?.regions[missing as string]).toBeUndefined();

    const coverage = snapshotCoverage(result.current.data, complete);
    expect(coverage).toEqual({ published: 127, expected: complete.length, isPartial: true });
  });

  // No recording caught a present-with-null region, so this one payload is derived from a
  // recorded one. The distinction it pins is the whole point of the nullish checks in
  // normalise.ts: `null / 1000 === 0` is audit B8, a missing reading plotted as a hard zero.
  test("present-with-null, genuine zero and a real value stay three different things", async () => {
    server.use(
      json("/GB/solar/generation/snapshot", {
        ...gbGspGenerationSnapshot,
        values: [
          { region_name: "has_value", capacity_kW: 1000, power_kW: 25775.5166 },
          { region_name: "is_zero", capacity_kW: 1000, power_kW: 0 },
          { region_name: "is_null", capacity_kW: 1000, power_kW: null }
        ]
      })
    );
    const { result } = render(() => useGenerationSnapshot(GB_GSP));
    await settled(result);

    expect(regionSnapshotState(result.current.data, "has_value")).toBe("value");
    expect(regionSnapshotState(result.current.data, "is_zero")).toBe("value");
    expect(regionSnapshotState(result.current.data, "is_null")).toBe("no-data");
    expect(regionSnapshotState(result.current.data, "never_heard_of_it")).toBe("unpublished");

    expect(regionSnapshotPowerMw(result.current.data, "is_zero")).toBe(0);
    expect(regionSnapshotPowerMw(result.current.data, "is_null")).toBeNull();
    expect(regionSnapshotPowerMw(result.current.data, "never_heard_of_it")).toBeNull();
  });
});

describe("regions and capabilities", () => {
  test("useRegions labels on full_name and keys on the raw name", async () => {
    const { result } = render(() => useRegions(GB_GSP));
    await settled(result);
    expect(lastQuery("/GB/solar/regions")?.get("region_type")).toBe("gsp");
    expect(result.current.data?.[0]).toMatchObject({ name: "citr_1", label: "City Road" });
  });

  // Models are per region type, not per country: a picker reading the country's models would
  // offer national models on a GSP endpoint that rejects them.
  test("useRegionTypes exposes per-region-type models and defaults", async () => {
    const { result } = render(() => useRegionTypes(GB_GSP));
    await settled(result);

    const byType = Object.fromEntries((result.current.data ?? []).map((rt) => [rt.type, rt]));
    expect(byType.national.forecastModels.length).toBe(12);
    expect(byType.national.defaultModel).toBe("blend_adjust");
    expect(byType.gsp.forecastModels.map((m) => m.name)).toEqual([
      "blend",
      "pvnet_intraday",
      "pvnet_day_ahead"
    ]);
    expect(byType.gsp.defaultModel).toBe("blend");
    expect(byType.national.level).toBe(0);
    expect(byType.gsp.level).toBe(10);
  });

  // GB's two-line GENERATION vs GENERATION_UPDATED chart is a GB fact. NL has one observer,
  // so any series list must be built from this rather than from a hardcoded pair.
  test("useGenerationSources reflects that NL has one observer where GB has two", async () => {
    const view = render(() => ({
      gb: useGenerationSources(GB_NATIONAL),
      nl: useGenerationSources(NL_NATIONAL)
    }));
    await bothSettled(view, "gb", "nl");

    expect(view.result.current.gb.data?.map((s) => s.name)).toEqual([
      "pvlive_in_day",
      "pvlive_day_after"
    ]);
    expect(view.result.current.nl.data?.map((s) => s.name)).toEqual(["ned_nl"]);
    // Both slices come from the one hourly manifest request.
    expect(countRequests("/countries")).toBe(1);
  });
});

describe("multi-country fanout and dedupe", () => {
  test("two countries fan out to two requests with independent data", async () => {
    const view = render(() => ({
      gb: useNationalForecast(GB_NATIONAL),
      nl: useNationalForecast(NL_NATIONAL)
    }));
    await bothSettled(view, "gb", "nl");

    expect(view.result.current.gb.data?.regionName).toBe("Great Britain");
    expect(view.result.current.nl.data?.regionName).toBe("Nederland");
    expect(countRequests("/GB/solar/regions/national/forecast")).toBe(1);
    expect(countRequests("/NL/solar/regions/national/forecast")).toBe(1);
  });

  test("region types differ per country and address the right endpoint", async () => {
    const view = render(() => ({
      gb: useForecastPeriod(GB_GSP),
      nl: useForecastPeriod(NL_PROVINCE)
    }));
    await bothSettled(view, "gb", "nl");

    expect(lastQuery("/NL/solar/forecasts/period")?.get("region_type")).toBe("province");
    expect(view.result.current.nl.data?.regions["zeeland"]).toBeDefined();
    expect(view.result.current.gb.data?.regions["citr_1"]).toBeDefined();
  });

  // This is what replaces `CombinedData`: two components asking for the same thing is one
  // request, because the cache key is the request. No bundle has to be assembled and drilled.
  test("two consumers of the same query share one request", async () => {
    const view = render(() => ({
      a: useNationalForecast(GB_NATIONAL, { model: "blend" }),
      // Same request, properties supplied in a different order — queryKey sorts them.
      b: useNationalForecast(
        { source: "solar", country: "GB", regionType: "national" },
        { model: "blend" }
      )
    }));
    await bothSettled(view, "a", "b");

    expect(countRequests("/GB/solar/regions/national/forecast")).toBe(1);
    expect(view.result.current.b.data).toBe(view.result.current.a.data);
  });
});

describe("error handling", () => {
  // 400s carry {"detail": string}; 422s carry HTTPValidationError's {"detail": [...]}.
  // Code assuming one shape crashes on the other, so both go through describeApiError.
  test("a 400 detail string is surfaced as a message", async () => {
    server.use(
      http.get(`${V1}/GB/solar/forecasts/period`, ({ request }) => {
        record(request);
        return HttpResponse.json(error400Fixture, { status: 400 });
      })
    );
    const { result } = render(() => useForecastPeriod(GB_NATIONAL));
    await waitFor(() => expect(result.current.error).toBeDefined());

    const info = describeApiError(result.current.error);
    expect(info?.status).toBe(400);
    expect(info?.message).toContain("only sub-national region types are pre-warmed");
    expect(info?.validationErrors).toEqual([]);
    expect(info?.isFatal).toBe(false);
  }, 15000);

  test("a 422 HTTPValidationError is surfaced as a validation list", async () => {
    server.use(
      http.get(`${V1}/GB/solar/forecasts/snapshot`, ({ request }) => {
        record(request);
        return HttpResponse.json(error422Fixture, { status: 422 });
      })
    );
    const { result } = render(() => useForecastSnapshot(GB_GSP));
    await waitFor(() => expect(result.current.error).toBeDefined());

    const info = describeApiError(result.current.error);
    expect(info?.status).toBe(422);
    expect(info?.validationErrors[0]).toMatchObject({ msg: "Field required" });
    expect(info?.message).toBe("Field required");
  }, 15000);

  test("describeApiError ignores anything that is not an API error", () => {
    expect(describeApiError(new Error("normaliser blew up"))).toBeNull();
    expect(describeApiError(undefined)).toBeNull();
  });

  // A cold period/snapshot cache answers 503 "retry in 60 seconds". Confirmed with the API
  // owner as a brief post-deploy state, so it is retried silently — no "warming" UI state.
  test("a cold-cache 503 is retried and recovers, with no warming state exposed", async () => {
    let calls = 0;
    server.use(
      http.get(`${V1}/GB/solar/generation/period`, ({ request }) => {
        record(request);
        calls++;
        if (calls === 1) {
          return HttpResponse.json(
            { detail: "cache is being populated, please retry in 60 seconds" },
            { status: 503, headers: { "Retry-After": "60" } }
          );
        }
        return HttpResponse.json(gbGspGenerationPeriod);
      })
    );

    const { result } = render(() => useGenerationPeriod(GB_GSP));
    await waitFor(() => expect(result.current.data).toBeDefined(), { timeout: 8000 });
    expect(calls).toBeGreaterThan(1);
  }, 15000);

  // A 403 is the caller not being authorised; the same token retried cannot succeed, so
  // retrying only produces a request loop against an endpoint that will keep refusing.
  test("a 403 is not retried", async () => {
    let calls = 0;
    server.use(
      http.get(`${V1}/GB/solar/forecasts/snapshot`, ({ request }) => {
        record(request);
        calls++;
        return HttpResponse.json({ detail: "not allowed" }, { status: 403 });
      })
    );

    const { result } = render(() => useForecastSnapshot(GB_GSP));
    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(describeApiError(result.current.error)?.isFatal).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 2500));
    expect(calls).toBe(1);
  }, 15000);
});
