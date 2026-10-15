/**
 * `useApiQuery`'s scope guard. `apiV1SwrOptions.keepPreviousData` makes SWR 2.2.5 return the
 * previous key's data whenever the current key has none — while the new key loads, after it
 * errors, and when the key is `null`. Within one scope that keeps a time-window move smooth;
 * across scopes it would show GB's series under NL's name. The hook withholds data fetched
 * under a different `continuityKey`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { SWRConfig } from "swr";

jest.mock("next/router", () => ({ __esModule: true, default: { push: jest.fn() } }));
jest.mock("@sentry/nextjs", () => ({ __esModule: true, captureException: jest.fn() }));

import gbNationalForecast from "../../lib/api/v1/__fixtures__/gb-national-forecast.json";
import gbGenDayAfter from "../../lib/api/v1/__fixtures__/gb-national-generation-pvlive_day_after.json";
import { resetTokenCache } from "../../lib/api/auth/token";
import * as queries from "../../lib/api/v1/queries";
import type { Scope, TimeSeries } from "../../lib/domain/types";
import { FetchJsonError } from "../../lib/api/fetch-json";
import { ApiV1Error } from "../../lib/api/v1/client";
import { continuityKey, isNonRetryableError } from "./query";
import { useNationalForecast } from "./use-forecast";
import { useNationalGeneration } from "./use-generation";

const V1 = "https://api.quartz.solar/v1";
const GB: Scope = { country: "GB", source: "solar", regionType: "national" };
const NL: Scope = { country: "NL", source: "solar", regionType: "national" };
const DE: Scope = { country: "DE", source: "solar", regionType: "national" };

// Derived from the GB recording so a value can only have come from the NL request.
const nlNationalForecast = {
  ...gbNationalForecast,
  region_name: "Nederland",
  values: gbNationalForecast.values.slice(0, 4).map((v, i) => ({ ...v, power_kW: 1000 * (i + 1) }))
};

/** A response the test releases by hand, so the in-flight state can be observed. */
let releaseGate: () => void = () => {};
let gatePromise: Promise<void> = Promise.resolve();
const gate = () => gatePromise;

const server = setupServer(
  http.get("/api/get_token", () => HttpResponse.json({ accessToken: "t" })),
  http.get(`${V1}/GB/solar/regions/national/forecast`, async ({ request }) => {
    // A second GB window (or horizon) waits for the gate; the first answers at once.
    const url = new URL(request.url);
    if (url.searchParams.has("end_utc") || url.searchParams.has("horizon_minutes")) await gate();
    return HttpResponse.json(gbNationalForecast);
  }),
  http.get(`${V1}/GB/solar/regions/national/generation`, () => HttpResponse.json(gbGenDayAfter)),
  http.get(`${V1}/NL/solar/regions/national/forecast`, () => HttpResponse.json(nlNationalForecast)),
  http.get(`${V1}/DE/solar/regions/national/forecast`, async () => {
    await gate();
    return HttpResponse.json({ detail: "not entitled" }, { status: 403 });
  }),
  // 403 is non-retryable, so the error state settles immediately.
  http.get(`${V1}/XX/solar/regions/national/forecast`, () =>
    HttpResponse.json({ detail: "not entitled" }, { status: 403 })
  )
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
beforeEach(() => {
  resetTokenCache();
  gatePromise = new Promise<void>((resolve) => {
    releaseGate = resolve;
  });
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
);

const XX: Scope = { country: "XX", source: "solar", regionType: "national" };

describe("continuityKey", () => {
  const region = { country: "GB", source: "solar", region: "national" };

  test("ignores the time window", () => {
    expect(
      continuityKey(queries.forecast(region, { start: "2026-08-01T00:00:00Z", model: "m" }))
    ).toBe(
      continuityKey(
        queries.forecast(region, {
          start: "2026-08-02T00:00:00Z",
          end: "2026-08-03T00:00:00Z",
          model: "m"
        })
      )
    );
    expect(continuityKey(queries.forecastSnapshot(GB, { time: "2026-08-01T00:00:00Z" }))).toBe(
      continuityKey(queries.forecastSnapshot(GB, { time: "2026-08-01T00:30:00Z" }))
    );
  });

  test.each([
    ["country", queries.forecast({ ...region, country: "NL" })],
    ["region", queries.forecast({ ...region, region: "gsp_1" })],
    ["horizon", queries.forecast(region, { horizonMinutes: 60 })],
    ["model", queries.forecast(region, { model: "blend" })],
    ["creation limit", queries.forecast(region, { creationLimit: "2026-08-01T00:00:00Z" })]
  ])("treats %s as identity", (_name, other) => {
    expect(continuityKey(other)).not.toBe(continuityKey(queries.forecast(region)));
  });

  test("treats observer, region type and region names as identity", () => {
    const gsp: Scope = { ...GB, regionType: "gsp" };
    expect(continuityKey(queries.generation(region, { observer: "a" }))).not.toBe(
      continuityKey(queries.generation(region, { observer: "b" }))
    );
    expect(continuityKey(queries.forecastPeriod(gsp))).not.toBe(
      continuityKey(queries.forecastPeriod({ ...GB, regionType: "dno" }))
    );
    expect(continuityKey(queries.forecastPeriod(gsp, { regionNames: ["a"] }))).not.toBe(
      continuityKey(queries.forecastPeriod(gsp, { regionNames: ["b"] }))
    );
  });

  test("leaves a descriptor with no query params (the manifest) equal to its cache key", () => {
    expect(continuityKey(queries.countries())).toBe(queries.queryKey(queries.countries()));
  });
});

test("switching GB -> NL with NL failing returns the error and no data", async () => {
  const { result, rerender } = renderHook(({ scope }) => useNationalForecast(scope), {
    wrapper,
    initialProps: { scope: GB as Scope | null }
  });
  await waitFor(() => expect(result.current.data?.values.length).toBeGreaterThan(0));
  const gbFirst = result.current.data!.values[0];

  rerender({ scope: XX });
  await waitFor(() => expect(result.current.error).toBeTruthy());

  expect(result.current.data?.values[0]).not.toEqual(gbFirst);
  expect(result.current.data).toBeUndefined();
  expect(result.current.isLoading).toBe(false);
});

test("disabling the query (null scope) returns no data and is not loading", async () => {
  const { result, rerender } = renderHook(({ scope }) => useNationalForecast(scope), {
    wrapper,
    initialProps: { scope: GB as Scope | null }
  });
  await waitFor(() => expect(result.current.data?.values.length).toBeGreaterThan(0));

  rerender({ scope: null });
  expect(result.current.data).toBeUndefined();
  expect(result.current.isLoading).toBe(false);
});

// The shape profile-dropdown.tsx and pv-remix-chart.tsx use for the second observer. NL has
// one observer, so after GB -> NL the query is disabled (null scope); GB's pvlive_day_after
// series must not reach an NL CSV as its "PVLive Updated" column.
test("second-observer hook returns no data after switching to a one-observer country", async () => {
  type P = { scope: Scope; observer: string | undefined };
  const { result, rerender } = renderHook(
    ({ scope, observer }: P) =>
      useNationalGeneration(observer === undefined ? null : scope, { observer }),
    { wrapper, initialProps: { scope: GB, observer: "pvlive_day_after" } as P }
  );
  await waitFor(() => expect(result.current.data?.values.length).toBeGreaterThan(0));

  rerender({ scope: NL, observer: undefined });
  expect(result.current.data).toBeUndefined();
});

test("a time-window change within one scope keeps the previous data while it loads", async () => {
  const { result, rerender } = renderHook(
    ({ end }: { end?: string }) => useNationalForecast(GB, { end }),
    { wrapper, initialProps: {} as { end?: string } }
  );
  await waitFor(() => expect(result.current.data?.values.length).toBeGreaterThan(0));
  const previous = result.current.data;

  rerender({ end: "2026-08-05T00:00:00Z" });
  expect(result.current.data).toBe(previous);
  expect(result.current.isLoading).toBe(true);

  await act(async () => releaseGate());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.data?.regionName).toBe(previous?.regionName);
});

test("a horizon change withholds the old horizon's data and reports loading", async () => {
  const { result, rerender } = renderHook(
    ({ horizonMinutes }: { horizonMinutes?: number }) =>
      useNationalForecast(GB, { horizonMinutes }),
    { wrapper, initialProps: {} as { horizonMinutes?: number } }
  );
  await waitFor(() => expect(result.current.data?.values.length).toBeGreaterThan(0));

  rerender({ horizonMinutes: 120 });
  expect(result.current.data).toBeUndefined();
  expect(result.current.isLoading).toBe(true);

  await act(async () => releaseGate());
  await waitFor(() => expect(result.current.data?.values.length).toBeGreaterThan(0));
});

test("a scope change reports loading with no data until the new request fails", async () => {
  const { result, rerender } = renderHook(({ scope }) => useNationalForecast(scope), {
    wrapper,
    initialProps: { scope: GB }
  });
  await waitFor(() => expect(result.current.data?.values.length).toBeGreaterThan(0));

  rerender({ scope: DE });
  expect(result.current.data).toBeUndefined();
  expect(result.current.isLoading).toBe(true);

  await act(async () => releaseGate());
  await waitFor(() => expect(result.current.error).toBeTruthy());
  expect(result.current.data).toBeUndefined();
  expect(result.current.isLoading).toBe(false);
});

test("switching GB -> NL -> GB returns GB's cached data and never NL's", async () => {
  const seen: { scope: string; data: TimeSeries | undefined }[] = [];
  const { result, rerender } = renderHook(
    ({ scope }: { scope: Scope }) => {
      const res = useNationalForecast(scope);
      seen.push({ scope: scope.country, data: res.data });
      return res;
    },
    { wrapper, initialProps: { scope: GB } }
  );
  await waitFor(() => expect(result.current.data?.regionName).toBe("Great Britain"));

  rerender({ scope: NL });
  await waitFor(() => expect(result.current.data?.regionName).toBe("Nederland"));

  const from = seen.length;
  rerender({ scope: GB });
  expect(result.current.data?.regionName).toBe("Great Britain");

  const afterSwitchBack = seen.slice(from);
  expect(afterSwitchBack.length).toBeGreaterThan(0);
  for (const render of afterSwitchBack) {
    expect(render.data?.regionName).toBe("Great Britain");
  }
  // And across the whole run, no render paired one country's scope with the other's data.
  for (const render of seen) {
    if (render.data === undefined) continue;
    expect(render.data.regionName).toBe(render.scope === "GB" ? "Great Britain" : "Nederland");
  }
});

/**
 * The retry policy's "stop retrying fast" switch, across both error kinds SWR sees. The v1
 * rule (403 only) is unchanged; the `FetchJsonError` rule is the plain HTTP one.
 */
describe("isNonRetryableError", () => {
  test.each<[number, boolean]>([
    [400, true],
    [404, true],
    [408, false],
    [429, false],
    [500, false],
    [503, false]
  ])("a FetchJsonError %i -> non-retryable: %s", (status, expected) => {
    expect(
      isNonRetryableError(new FetchJsonError("https://status.test/products", status, null))
    ).toBe(expected);
  });

  test.each<[number, boolean]>([
    [403, true],
    [404, false],
    [422, false],
    [503, false]
  ])("an ApiV1Error %i keeps the v1 rule -> non-retryable: %s", (status, expected) => {
    expect(isNonRetryableError(new ApiV1Error(status, null))).toBe(expected);
  });

  test("anything else is retryable", () => {
    expect(isNonRetryableError(new TypeError("Failed to fetch"))).toBe(false);
    expect(isNonRetryableError(new Error("normaliser bug"))).toBe(false);
    expect(isNonRetryableError(undefined)).toBe(false);
  });
});
