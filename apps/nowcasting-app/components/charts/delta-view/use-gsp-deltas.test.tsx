/**
 * `useGspDeltas` — the GSP delta list behind `delta-buckets-ui.tsx` and `GspDeltaColumn`.
 *
 * The claim under test: this hook must compute the *same* delta Track A's map computes (same
 * MW values, same `hasDelta` gate), not a second parallel computation with different rounding.
 * It reuses `buildRegionValues` directly, so these tests mostly pin the join around it — the
 * numeric-id bridge (`Region.metadata.gsp_id`) and the `hasDelta` exclusion.
 *
 * Harness notes carried over from `components/map/use-map-region-values.test.tsx` (documented
 * at `bothSettled` in `hooks/data/data-hooks.test.tsx`): one `waitFor`, never two sequential
 * ones, and call `rerender()` inside the polling callback — this hook renders three hooks on
 * distinct SWR keys, which is exactly the shape that drops a render otherwise.
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

import gbGspForecastPeriod from "../../../lib/api/v1/__fixtures__/gb-gsp-forecasts-period.json";
import gbGspGenerationPeriod from "../../../lib/api/v1/__fixtures__/gb-gsp-generation-period.json";
import gbRegionsGsp from "../../../lib/api/v1/__fixtures__/gb-regions-gsp.json";
import { resetTokenCache } from "../../../lib/api/auth/token";
import { useGspDeltas } from "./use-gsp-deltas";

const V1 = "https://api.quartz.solar/v1";

let requests: { path: string; url: URL }[] = [];
const countRequests = (path: string) => requests.filter((r) => r.path === path).length;

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

// citr_1 / gsp_id 67, the same fixture region `use-map-region-values.test.tsx` pins.
const FIRST = gbGspForecastPeriod.times_utc[20]; // forecast 1538 kW, generation 1599 kW
const SECOND = gbGspForecastPeriod.times_utc[21]; // forecast 1312 kW, generation 1575 kW

const renderDeltas = (initialTime: string) =>
  renderHook(({ targetTime }: { targetTime: string }) => useGspDeltas(targetTime), {
    wrapper,
    initialProps: { targetTime: initialTime }
  });

describe("useGspDeltas", () => {
  test("computes observed-minus-forecast in MW, keyed by region name, labelled and bridged to the numeric gspId", async () => {
    const view = renderDeltas(FIRST);
    await waitFor(() => {
      view.rerender({ targetTime: FIRST });
      expect(view.result.current.isLoading).toBe(false);
      expect(view.result.current.gspDeltas.size).toBeGreaterThan(0);
    });

    const row = view.result.current.gspDeltas.get("citr_1")!;
    expect(row).toBeDefined();
    expect(row.gspId).toBe(67);
    expect(row.gspRegion).toBe("City Road"); // Region.label, never the raw "citr_1"
    expect(row.forecast).toBeCloseTo(1.538, 6);
    expect(row.currentYield).toBeCloseTo(1.599, 6);
    expect(row.delta).toBeCloseTo(0.061, 6);
    expect(row.gspInstalledCapacity).toBeCloseTo(3.982, 6);
    expect(row.deltaBucketKey).toBe("ZERO");
  });

  test("the delta moves with the scrub and issues no extra requests", async () => {
    const view = renderDeltas(FIRST);
    await waitFor(() => {
      view.rerender({ targetTime: FIRST });
      expect(view.result.current.isLoading).toBe(false);
      expect(view.result.current.gspDeltas.size).toBeGreaterThan(0);
    });

    expect(countRequests("/GB/solar/forecasts/period")).toBe(1);
    expect(countRequests("/GB/solar/generation/period")).toBe(1);
    expect(countRequests("/GB/solar/regions")).toBe(1);

    view.rerender({ targetTime: SECOND });
    expect(view.result.current.gspDeltas.get("citr_1")!.delta).toBeCloseTo(0.263, 6);
    expect(countRequests("/GB/solar/forecasts/period")).toBe(1);
    expect(countRequests("/GB/solar/generation/period")).toBe(1);
  });

  test("a slot with no observation yet is dropped, not folded into the zero bucket", async () => {
    // Outside the fetched window: neither series has an entry at this instant, so every
    // region's `hasDelta` is false. The v0 code forced `delta = 0` here; Track A's `hasDelta`
    // convention means the map must come back empty instead of full of false zeroes.
    const outsideWindow = "2099-01-01T00:00:00Z";
    const view = renderDeltas(outsideWindow);
    await waitFor(() => {
      view.rerender({ targetTime: outsideWindow });
      expect(view.result.current.isLoading).toBe(false);
    });

    expect(view.result.current.gspDeltas.size).toBe(0);
  });
});
