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
import { setFocusedCountry } from "../../helpers/globalState";
import { DEFAULT_COUNTRY_CODE } from "../../helpers/countryState";
import gbGspForecastPeriod from "../../../lib/api/v1/__fixtures__/gb-gsp-forecasts-period.json";
import gbGspGenerationPeriod from "../../../lib/api/v1/__fixtures__/gb-gsp-generation-period.json";
import gbGenerationSources from "../../../lib/api/v1/__fixtures__/gb-generation-sources.json";
import dnoGroupings from "../../../public/geo/gb/dno-groupings.json";
import { groupRegionNames } from "../../helpers/data";
import { useGspAggregateData, useGspRegionData, useGspRegionNames } from "./use-gsp-region-data";

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
  json("/GB/solar/forecasts/period", gbGspForecastPeriod),
  json("/GB/solar/generation/period", gbGspGenerationPeriod),
  json("/GB/solar/generation/sources", gbGenerationSources),
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
  setFocusedCountry(DEFAULT_COUNTRY_CODE);
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

/**
 * THE GROUPED ROLLUP — the path that broke twice in Phase 5 with nothing to catch it.
 *
 * First when Track B moved the stored aggregation level from `NationalAggregation`'s
 * capitalised values ("DNO") to the registry's lowercase region-type names ("dno"): the
 * lookup table in `data.ts` was still keyed by the enum, every lookup missed, `groupGspIds`
 * returned `undefined`, and the DNO chart drew an empty panel. No error, no type error.
 * Then again when the call site was stubbed to `null` while this seam moved underneath it.
 *
 * Both failures present identically — a blank chart — which is why this asserts the thing a
 * human would have to notice: a real DNO group name produces a series carrying real numbers.
 */
describe("useGspAggregateData — a DNO group name rolls up to a real series", () => {
  const DNO_GROUPINGS = dnoGroupings as Record<string, string[]>;
  const GROUP = "UKPN (London)";

  test("resolves the shipped grouping to members and sums them at every timestamp", async () => {
    // Exactly what `index.tsx` does: the level is derived, so the selected feature id IS the
    // group's key in the grouping file. UKPN (London) is the group four of the recorded
    // fixture's five published regions fall in — the assertions below need members that
    // actually carry numbers, which is the whole point.
    const members = groupRegionNames(DNO_GROUPINGS, GROUP)!;
    expect(members.length).toBeGreaterThan(0);
    expect(members).toContain("citr_1");

    const { result, rerender } = renderHook(() => useGspAggregateData(members, GROUP), {
      wrapper
    });
    await waitFor(() => {
      rerender();
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.forecast).toBeDefined();
    expect(result.current.forecast!.regionName).toBe(GROUP);
    expect(result.current.forecast!.values.length).toBeGreaterThan(0);
    // The blank-chart failure mode: a series of nothing but nulls, or a capacity of zero.
    expect(result.current.forecast!.values.some((point) => typeof point.powerMw === "number")).toBe(
      true
    );
    expect(result.current.capacityMw).toBeGreaterThan(0);
    // Labels, never raw region names, and one per member.
    expect(result.current.memberLabels).toHaveLength(members.length);
    expect(result.current.memberLabels).not.toContain(members[0]);

    // One request for the whole group, not one per member — the roll-up is client-side.
    expect(seen("/GB/solar/forecasts/period")).toHaveLength(1);
  });

  test("an empty or unresolved selection disables the hook rather than charting zeroes", async () => {
    const { result } = renderHook(() => useGspAggregateData(null, null), { wrapper });
    expect(result.current.scope).toBeNull();
    expect(result.current.forecast).toBeUndefined();
    expect(seen("/GB/solar/forecasts/period")).toHaveLength(0);
  });
});

describe("useGspRegionNames — the map's numeric feature ids become v1 region names", () => {
  test("a GSP multi-select resolves to names, not ids", async () => {
    const { result, rerender } = renderHook(() => useGspRegionNames([String(CITR_1_GSP_ID)]), {
      wrapper
    });
    await waitFor(() => {
      rerender();
      expect(result.current).not.toBeNull();
    });
    expect(result.current).toEqual(["citr_1"]);
  });

  test("an empty selection is null, so the caller stays disabled", () => {
    const { result } = renderHook(() => useGspRegionNames([]), { wrapper });
    expect(result.current).toBeNull();
  });
});
