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

// The map hook builds boundary geometry, which is 10MB of GeoJSON this suite has no use for.
// The join it stands in for is covered by `map-value-join.test.ts`.
jest.mock("../helpers/data", () => {
  const actual = jest.requireActual<typeof import("../helpers/data")>("../helpers/data");
  return {
    __esModule: true,
    ...actual,
    buildMapGeometry: jest.fn(() => ({ type: "FeatureCollection", features: [] }))
  };
});

import gbGspForecastPeriod from "../../lib/api/v1/__fixtures__/gb-gsp-forecasts-period.json";
import gbGspGenerationPeriod from "../../lib/api/v1/__fixtures__/gb-gsp-generation-period.json";
import gbRegionsGsp from "../../lib/api/v1/__fixtures__/gb-regions-gsp.json";
import { resetTokenCache } from "../../lib/api/auth/token";
import { NationalAggregation } from "./types";
import { useMapRegionValues } from "./use-map-region-values";

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
    ({ targetTime }: { targetTime: string }) =>
      useMapRegionValues(NationalAggregation.GSP, targetTime),
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

  test("the window it asks for is a range, not a single instant", async () => {
    const view = renderMap(FIRST);
    await waitFor(() => {
      view.rerender({ targetTime: FIRST });
      expect(view.result.current.isLoading).toBe(false);
      expect(view.result.current.featureStates.size).toBeGreaterThan(0);
    });

    const query = lastQuery("/GB/solar/forecasts/period")!;
    expect(query.get("region_type")).toBe("gsp");
    expect(query.get("start_utc")).toBeTruthy();
    expect(query.get("end_utc")).toBeTruthy();
    expect(query.get("start_utc")).not.toBe(query.get("end_utc"));
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

  test("national capacity comes from the region list, which is a real partition", async () => {
    const view = renderMap(FIRST);
    await waitFor(() => {
      view.rerender({ targetTime: FIRST });
      expect(view.result.current.isLoading).toBe(false);
      expect(view.result.current.featureStates.size).toBeGreaterThan(0);
    });

    expect(view.result.current.nationalCapacityMw).toBeGreaterThan(0);
    expect(view.result.current.coverage.expected).toBe(338);
  });
});
