/**
 * `useGspRegionData` against the real `queries -> client -> normalise` machinery (MSW), the
 * same style as `hooks/data/data-hooks.test.tsx` and `pv-remix-chart.test.tsx`.
 *
 * What matters here, per `docs/phase4-contract.md` and the Track D brief:
 *
 *  1. **Disabled stays a hook call, not a skipped one.** With no GSP selected (or the
 *     selection unresolved against `/regions`), every underlying hook still runs — SWR just
 *     gets a `null` key, so `isFetchableScope`/`toRegionScope` disable the request rather than
 *     the call. `scope` comes back `null` and no forecast/generation request goes out.
 *  2. **The numeric GSP id resolves to a v1 region name via `metadata.gsp_id`**, never a raw
 *     id reaching the forecast/generation path — "citr_1", not "67".
 *  3. **No `model` parameter is ever sent** — GSP time series are pinned to the region type's
 *     default (model selection is national-only).
 *  4. **Both of GB's observers are fetched**, one request each, keyed the same way the
 *     national chart keys them (`GENERATION` / `GENERATION_UPDATED`).
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

import countriesFixture from "../../../lib/api/v1/__fixtures__/countries.json";
import gbRegionsGsp from "../../../lib/api/v1/__fixtures__/gb-regions-gsp.json";
import gbNationalForecast from "../../../lib/api/v1/__fixtures__/gb-national-forecast.json";
import gbNationalGenerationInDay from "../../../lib/api/v1/__fixtures__/gb-national-generation-pvlive_in_day.json";
import gbNationalGenerationDayAfter from "../../../lib/api/v1/__fixtures__/gb-national-generation-pvlive_day_after.json";
import { resetTokenCache } from "../../../lib/api/auth/token";
import { setCurrentCountry } from "../../helpers/globalState";
import { DEFAULT_COUNTRY_CODE } from "../../helpers/countryState";
import { useGspRegionData } from "./use-gsp-region-data";

const V1 = "https://api.quartz.solar/v1";

// City Road: gsp_id 67 -> region name "citr_1", per the recorded fixture.
const CITR_1_GSP_ID = 67;

let requests: { path: string; url: URL }[] = [];
const seen = (path: string) => requests.filter((r) => r.path === path);
const record = (request: Request) => {
  const url = new URL(request.url);
  requests.push({ path: url.pathname.replace(/^\/v1/, ""), url });
};

const json = (path: string, body: Parameters<typeof HttpResponse.json>[0]) =>
  http.get(`${V1}${path}`, ({ request }) => {
    record(request);
    return HttpResponse.json(body);
  });

const server = setupServer(
  http.get("/api/get_token", () => HttpResponse.json({ accessToken: "test-token" })),
  json("/countries", countriesFixture),
  json("/GB/solar/regions", gbRegionsGsp),
  json("/GB/solar/regions/citr_1/forecast", gbNationalForecast),
  http.get(`${V1}/GB/solar/regions/citr_1/generation`, ({ request }) => {
    record(request);
    const observer = new URL(request.url).searchParams.get("observer");
    return HttpResponse.json(
      observer === "pvlive_day_after" ? gbNationalGenerationDayAfter : gbNationalGenerationInDay
    );
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  requests = [];
});
afterAll(() => server.close());
beforeEach(() => {
  resetTokenCache();
  setCurrentCountry(DEFAULT_COUNTRY_CODE);
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
);

type Options = { show: boolean; horizonMinutes: number };
const NO_NHOUR: Options = { show: false, horizonMinutes: 240 };

describe("disabled — no GSP selected", () => {
  test("every hook is still called, but with a null scope: no request goes out", async () => {
    const { result } = renderHook(() => useGspRegionData(undefined, false, NO_NHOUR), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.scope).toBeNull();
    expect(result.current.forecast).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(seen("/GB/solar/regions/citr_1/forecast")).toHaveLength(0);
    expect(seen("/GB/solar/regions/citr_1/generation")).toHaveLength(0);
  });
});

describe("enabled, but the selected id does not resolve to a region", () => {
  test("stays disabled rather than sending a bogus path segment", async () => {
    const { result } = renderHook(() => useGspRegionData(999999, true, NO_NHOUR), { wrapper });

    // Region list comes back, but nothing in it matches gsp_id 999999, so the scope never
    // resolves and no forecast/generation request is ever sent.
    await waitFor(() => {
      expect(seen("/GB/solar/regions")).toHaveLength(1);
      expect(result.current.region).toBeUndefined();
    });

    expect(result.current.region).toBeUndefined();
    expect(result.current.scope).toBeNull();
    expect(seen("/GB/solar/regions/citr_1/forecast")).toHaveLength(0);
  });
});

describe("enabled with a resolvable GSP", () => {
  test("resolves the numeric id to the v1 region name via metadata.gsp_id", async () => {
    const { result, rerender } = renderHook(() => useGspRegionData(CITR_1_GSP_ID, true, NO_NHOUR), {
      wrapper
    });

    await waitFor(() => {
      rerender();
      expect(seen("/GB/solar/regions/citr_1/forecast")).toHaveLength(1);
    });

    expect(result.current.region?.name).toBe("citr_1");
    expect(result.current.region?.label).toBe("City Road");
    expect(result.current.scope).toEqual({
      country: "GB",
      source: "solar",
      regionType: "gsp",
      region: "citr_1"
    });
  });

  test("fetches both of GB's observers, one request each, and no model param ever", async () => {
    const { result, rerender } = renderHook(() => useGspRegionData(CITR_1_GSP_ID, true, NO_NHOUR), {
      wrapper
    });

    await waitFor(() => {
      rerender();
      expect(seen("/GB/solar/regions/citr_1/generation")).toHaveLength(2);
    });

    const observerValues = seen("/GB/solar/regions/citr_1/generation")
      .map((r) => r.url.searchParams.get("observer"))
      .sort();
    expect(observerValues).toEqual(["pvlive_day_after", "pvlive_in_day"]);

    expect(seen("/GB/solar/regions/citr_1/forecast")[0]?.url.searchParams.get("model")).toBeNull();

    expect(result.current.generationSeries.map((s) => s.key)).toEqual([
      "GENERATION",
      "GENERATION_UPDATED"
    ]);
  });

  test("the N-hour series is only fetched when nHour.show is true", async () => {
    const disabled = renderHook(() => useGspRegionData(CITR_1_GSP_ID, true, NO_NHOUR), {
      wrapper
    });
    await waitFor(() => {
      disabled.rerender();
      expect(seen("/GB/solar/regions/citr_1/forecast").length).toBeGreaterThanOrEqual(1);
    });
    // Only the plain forecast request, no horizon_minutes-bearing one.
    expect(
      seen("/GB/solar/regions/citr_1/forecast").some((r) =>
        r.url.searchParams.has("horizon_minutes")
      )
    ).toBe(false);

    requests = [];
    const enabled = renderHook(
      () => useGspRegionData(CITR_1_GSP_ID, true, { show: true, horizonMinutes: 240 }),
      { wrapper }
    );
    await waitFor(() => {
      enabled.rerender();
      expect(
        seen("/GB/solar/regions/citr_1/forecast").some((r) =>
          r.url.searchParams.get("horizon_minutes")
        )
      ).toBe(true);
    });
    expect(
      seen("/GB/solar/regions/citr_1/forecast")
        .find((r) => r.url.searchParams.has("horizon_minutes"))
        ?.url.searchParams.get("horizon_minutes")
    ).toBe("240");
  });
});
