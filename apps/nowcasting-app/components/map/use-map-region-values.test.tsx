/**
 * The scrub path.
 *
 * The claim under test is the one the progress notes call the likely dominant source of the
 * map's felt lag: `useGetGspForecast(selectedTime)` set `start == end == targetTime`, so every
 * tick of the scrubber was a fresh round trip. `useMapRegionValues` fetches the whole window
 * once and moves the selection client-side, so dragging the scrubber must issue **no**
 * requests at all.
 *
 * Harness notes (both documented at `bothSettled` in `hooks/data/data-hooks.test.tsx`, and
 * both hit here because this renders a container with three hooks in it): use one `waitFor`,
 * never two sequential ones, and call `rerender()` inside the polling callback.
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

// Geometry is fetched from `public/geo/` since Phase 5 and there is no server here to serve
// it — nor any reason to parse 9 MB of GB boundaries for a suite about the value pipeline.
// `useMapGeometry` is stubbed out entirely; its own behaviour, including the out-of-order
// guard, is covered by `hooks/data/use-map-geometry.test.tsx`, and the value join by
// `map-value-join.test.ts`.
jest.mock("../../hooks/data/use-map-geometry", () => {
  // A single frozen object, because the identity of `geometry` is load-bearing: the map
  // components call `setData` only when it changes, and a stub that returned a fresh literal
  // per render would make the "no `setData` on a scrub tick" test vacuously pass.
  const geometry = { type: "FeatureCollection", features: [] };
  return {
    __esModule: true,
    useMapGeometry: () => ({
      geometry,
      groupings: undefined,
      isLoading: false,
      error: undefined
    })
  };
});

import gbGspForecastPeriod from "../../lib/api/v1/__fixtures__/gb-gsp-forecasts-period.json";
import gbGspGenerationPeriod from "../../lib/api/v1/__fixtures__/gb-gsp-generation-period.json";
import gbRegionsGsp from "../../lib/api/v1/__fixtures__/gb-regions-gsp.json";
import { isLegacyRegion } from "../../config/geo-aliases";
import { resetTokenCache } from "../../lib/api/auth/token";
import type { AggregationLevel } from "../helpers/aggregationLevels";
import { useMapRegionValues } from "./use-map-region-values";

/** GB's finest non-derived level, as `deriveAggregationLevels` produces it. */
const GSP_LEVEL: AggregationLevel = {
  regionType: "gsp",
  level: 10,
  label: "Grid Supply Point",
  minZoom: 7,
  maxZoom: 8.5,
  derived: false
};

const V1 = "https://api.quartz.solar/v1";

let requests: { path: string; url: URL }[] = [];
const countRequests = (path: string) => requests.filter((r) => r.path === path).length;
const lastQuery = (path: string) =>
  requests.filter((r) => r.path === path).slice(-1)[0]?.url.searchParams;

// `API_V1_PREFIX` ends in `/v1`, so the intercepted pathname carries it.
const json = (path: string, body: Parameters<typeof HttpResponse.json>[0]) =>
  http.get(`${V1}${path}`, ({ request }) => {
    const url = new URL(request.url);
    requests.push({ path: url.pathname.replace(/^\/v1/, ""), url });
    return HttpResponse.json(body);
  });

const server = setupServer(
  http.get("/api/get_token", () => HttpResponse.json({ accessToken: "test-token" })),
  json("/GB/solar/regions", gbRegionsGsp),
  json("/GB/solar/forecasts/period", gbGspForecastPeriod),
  json("/GB/solar/generation/period", gbGspGenerationPeriod)
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  requests = [];
});
afterAll(() => server.close());
beforeEach(() => resetTokenCache());

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
);

const FIRST = gbGspForecastPeriod.times_utc[20];
const SECOND = gbGspForecastPeriod.times_utc[21];
const THIRD = gbGspForecastPeriod.times_utc[22];

const renderMap = (initialTime: string) =>
  renderHook(
    ({ targetTime }: { targetTime: string }) => useMapRegionValues(GSP_LEVEL, targetTime),
    { wrapper, initialProps: { targetTime: initialTime } }
  );

describe("useMapRegionValues", () => {
  test("fetches the window once and never again while the user scrubs", async () => {
    const view = renderMap(FIRST);
    await waitFor(() => {
      view.rerender({ targetTime: FIRST });
      expect(view.result.current.isLoading).toBe(false);
      expect(view.result.current.featureStates.size).toBeGreaterThan(0);
    });

    expect(countRequests("/GB/solar/forecasts/period")).toBe(1);
    expect(countRequests("/GB/solar/generation/period")).toBe(1);
    expect(countRequests("/GB/solar/regions")).toBe(1);

    const before = view.result.current.featureStates.get(67)!.power;
    view.rerender({ targetTime: SECOND });
    view.rerender({ targetTime: THIRD });
    view.rerender({ targetTime: FIRST });

    // Three scrub ticks, no network at all.
    expect(countRequests("/GB/solar/forecasts/period")).toBe(1);
    expect(countRequests("/GB/solar/generation/period")).toBe(1);
    expect(view.result.current.featureStates.get(67)!.power).toBe(before);
  });

  test("the scrub moves the values without moving the request", async () => {
    const view = renderMap(FIRST);
    await waitFor(() => {
      view.rerender({ targetTime: FIRST });
      expect(view.result.current.isLoading).toBe(false);
      expect(view.result.current.featureStates.size).toBeGreaterThan(0);
    });

    const at20 = view.result.current.featureStates.get(67)!.power;
    view.rerender({ targetTime: SECOND });
    const at21 = view.result.current.featureStates.get(67)!.power;

    expect(at20).toBeCloseTo(1.538, 6);
    expect(at21).toBeCloseTo(1.312, 6);
    expect(countRequests("/GB/solar/forecasts/period")).toBe(1);
  });

  /**
   * The v0 bug this replaced was `useGetGspForecast(selectedTime)`, which set
   * `start == end == targetTime` and refetched on every tick of the scrubber. The guard is now
   * stronger than "it is a range": the request carries **no window at all**, so there is no
   * timestamp in the SWR key that a scrub could move.
   *
   * `end_utc` must stay absent for a second reason. The forecast horizon is a per-country fact
   * — GB publishes 36h ahead, NL 48 — so any end we pin truncates somebody. The previous
   * `getFurthestForecastTimestamp()` (now +1 day) truncated everybody, and the `period`
   * endpoints' own defaults are both wider and the window their cache is pre-warmed on.
   */
  test("it asks for no window, so no scrub tick can reach the network", async () => {
    const view = renderMap(FIRST);
    await waitFor(() => {
      view.rerender({ targetTime: FIRST });
      expect(view.result.current.isLoading).toBe(false);
      expect(view.result.current.featureStates.size).toBeGreaterThan(0);
    });

    const query = lastQuery("/GB/solar/forecasts/period")!;
    expect(query.get("region_type")).toBe("gsp");
    expect(query.get("start_utc")).toBeNull();
    expect(query.get("end_utc")).toBeNull();
    // `period` 400s on region_type=national, so the map must never route through it.
    expect(query.get("region_type")).not.toBe("national");
  });

  test("geometry is rebuilt only when the region list or aggregation moves", async () => {
    const view = renderMap(FIRST);
    await waitFor(() => {
      view.rerender({ targetTime: FIRST });
      expect(view.result.current.isLoading).toBe(false);
      expect(view.result.current.featureStates.size).toBeGreaterThan(0);
    });

    const geometry = view.result.current.geometry;
    const states = view.result.current.featureStates;
    view.rerender({ targetTime: SECOND });

    // Same geometry object, so `setData` is never called on a scrub — that identity check is
    // exactly what the map components gate on. The value set is a new object, so feature
    // state is re-applied.
    expect(view.result.current.geometry).toBe(geometry);
    expect(view.result.current.featureStates).not.toBe(states);
  });

  // The region list is NOT a partition: six of GB's 338 regions are legacy spellings the API
  // keeps for backward compatibility of client scripts, and summing all of them lands 683 MW
  // (3.1 %) over national. The NESO boundary file is the definitive GSP set, so the sum
  // excludes them — the same rule the geometry and feature-state join apply.
  //
  // Asserting against the naive total is what makes this test discriminating: an equality
  // against a literal would still pass if the filter were dropped and the fixture changed.
  test("national capacity excludes the API's legacy backward-compatibility regions", async () => {
    const view = renderMap(FIRST);
    await waitFor(() => {
      view.rerender({ targetTime: FIRST });
      expect(view.result.current.isLoading).toBe(false);
      expect(view.result.current.featureStates.size).toBeGreaterThan(0);
    });

    // The fixture publishes kW, which `normalise` converts to MW — hence the /1000 here.
    const all = gbRegionsGsp;
    const sumMw = (rows: typeof all) =>
      rows.reduce((total, region) => total + (region.capacity_kW ?? 0) / 1000, 0);
    const legacy = all.filter((region) => isLegacyRegion("GB", region.name));
    const real = all.filter((region) => !isLegacyRegion("GB", region.name));

    // The fixture must actually contain legacy regions, or this asserts nothing.
    expect(legacy).toHaveLength(6);
    expect(view.result.current.nationalCapacityMw).toBeCloseTo(sumMw(real), 3);
    // The gap is the legacy regions' own capacity — the 683 MW over-count, to the MW.
    expect(sumMw(all) - view.result.current.nationalCapacityMw).toBeCloseTo(sumMw(legacy), 3);
    // All 338 are still fetched and still expected to publish values; only the sum narrows.
    expect(view.result.current.coverage.expected).toBe(338);
  });

  // The 503 that reached the UI as "boundaries drawn, no fill, no message" (2026-08-10).
  //
  // The map's failure state was gated on `error && !featureStates.size`. Feature states are
  // built from the *region list*, so `/regions` succeeding populates all 332 of them whether or
  // not a single forecast value arrives — the guard was false in exactly the case it existed
  // for, and every region painted as `power: 0`.
  //
  // Asserting `featureStates.size > 0` alongside `hasValues === false` is what makes this
  // discriminating: it pins the *divergence* between the two signals, so reverting the guard to
  // `.size` fails here rather than passing on a technicality.
  test("reports no values when the forecast fails but the region list arrives", async () => {
    server.use(
      http.get(`${V1}/GB/solar/forecasts/period`, () =>
        HttpResponse.json({ message: "Service Unavailable" }, { status: 503 })
      )
    );

    const view = renderMap(FIRST);
    await waitFor(() => {
      view.rerender({ targetTime: FIRST });
      expect(view.result.current.error).toBeTruthy();
      expect(view.result.current.isLoading).toBe(false);
    });

    expect(view.result.current.featureStates.size).toBeGreaterThan(0);
    expect(view.result.current.hasValues).toBe(false);
    expect(view.result.current.coverage.published).toBe(0);
  });

  // The counterpart, and the reason `hasValues` cannot be derived from the values themselves:
  // at night every region genuinely reads 0 MW, so "all zero" must stay distinguishable from
  // "nothing published". Coverage counts publication, not magnitude.
  test("reports values present even when every published region reads zero", async () => {
    // `regions` is an array, and must stay one — rebuilding it as an object keys it by index
    // and the payload no longer normalises.
    const allZero = {
      ...gbGspForecastPeriod,
      regions: gbGspForecastPeriod.regions.map((region) => ({
        ...region,
        power_kW: region.power_kW.map(() => 0)
      }))
    };
    server.use(json("/GB/solar/forecasts/period", allZero));

    const view = renderMap(FIRST);
    await waitFor(() => {
      view.rerender({ targetTime: FIRST });
      expect(view.result.current.isLoading).toBe(false);
      expect(view.result.current.featureStates.size).toBeGreaterThan(0);
    });

    expect(view.result.current.hasValues).toBe(true);
    expect(view.result.current.featureStates.get(67)!.power).toBe(0);
  });
});
