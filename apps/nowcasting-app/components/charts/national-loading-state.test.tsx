/**
 * `useLoadingState` — the staleness indicator's assembly.
 *
 * The contract lists this as a known gap: "its inputs are covered, its assembly is not… the
 * view that adopts it should bring one." The national chart is that view, which is why the
 * test lives beside it rather than under `hooks/data/`.
 *
 * What is worth pinning is the part that is not obvious from the types: which ROWS exist. The
 * row set is country-shaped — NL has one generation observer where GB has two — and a row
 * whose input is omitted has to disappear rather than sit permanently loading. Everything the
 * indicator renders is driven off that set, so getting it wrong shows up as a message that
 * never clears.
 *
 * Harness: MSW paths carry the `/v1` prefix; one `waitFor` with `rerender()` inside it,
 * because several hooks with distinct SWR keys resolve microseconds apart (see `bothSettled`
 * in `hooks/data/data-hooks.test.tsx`).
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

import gbGspForecastPeriod from "../../lib/api/v1/__fixtures__/gb-gsp-forecasts-period.json";
import gbGspGenerationPeriod from "../../lib/api/v1/__fixtures__/gb-gsp-generation-period.json";
import gbNationalForecast from "../../lib/api/v1/__fixtures__/gb-national-forecast.json";
import gbNationalGenerationInDay from "../../lib/api/v1/__fixtures__/gb-national-generation-pvlive_in_day.json";
import nlNationalGeneration from "../../lib/api/v1/__fixtures__/nl-national-generation-ned_nl.json";
import { resetTokenCache } from "../../lib/api/auth/token";
import { useLoadingState } from "../../hooks/data";
import type { Scope } from "../../lib/domain/types";

const V1 = "https://api.quartz.solar/v1";

const GB_NATIONAL: Scope = { country: "GB", source: "solar", regionType: "national" };
const GB_GSP: Scope = { country: "GB", source: "solar", regionType: "gsp" };
const NL_NATIONAL: Scope = { country: "NL", source: "solar", regionType: "national" };

const GB_OBSERVERS = ["pvlive_in_day", "pvlive_day_after"];

const json = (path: string, body: Parameters<typeof HttpResponse.json>[0]) =>
  http.get(`${V1}${path}`, () => HttpResponse.json(body));

const server = setupServer(
  http.get("/api/get_token", () => HttpResponse.json({ accessToken: "test-token" })),
  json("/GB/solar/regions/national/forecast", gbNationalForecast),
  json("/GB/solar/regions/national/generation", gbNationalGenerationInDay),
  json("/GB/solar/forecasts/period", gbGspForecastPeriod),
  json("/GB/solar/generation/period", gbGspGenerationPeriod),
  json("/NL/solar/regions/national/forecast", gbNationalForecast),
  json("/NL/solar/regions/national/generation", nlNationalGeneration)
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => resetTokenCache());

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
);

const render = (options: Parameters<typeof useLoadingState>[0]) =>
  renderHook(() => useLoadingState(options), { wrapper });

/** One `waitFor`, `rerender()` inside it — see the file header. */
const loaded = async (view: ReturnType<typeof render>) => {
  await waitFor(() => {
    view.rerender();
    expect(view.result.current.initialLoadComplete).toBe(true);
  });
  return view.result.current;
};

const rowKeys = (state: ReturnType<typeof useLoadingState>) =>
  Object.keys(state.endpointStates ?? {})
    .filter((key) => key !== "type")
    .sort();

describe("which rows exist", () => {
  test("GB's national chart reports its forecast and both observers", async () => {
    const state = await loaded(
      render({ scope: GB_NATIONAL, model: "blend", observers: GB_OBSERVERS })
    );
    expect(rowKeys(state)).toEqual(["nationalForecast", "pvRealDayAfter", "pvRealDayIn"]);
    expect(state.endpointStates?.nationalForecast.hasData).toBe(true);
    expect(state.endpointStates?.pvRealDayIn.hasData).toBe(true);
  });

  // The single-observer case. A hardcoded pair would leave `pvRealDayAfter` present and
  // permanently empty; it has to be absent instead.
  test("a single-observer country drops the second generation row entirely", async () => {
    const state = await loaded(render({ scope: NL_NATIONAL, observers: ["ned_nl"] }));
    expect(rowKeys(state)).toEqual(["nationalForecast", "pvRealDayIn"]);
    expect(state.endpointStates?.pvRealDayAfter).toBeUndefined();
  });

  test("no observers at all leaves only the forecast row", async () => {
    const state = await loaded(render({ scope: GB_NATIONAL, model: "blend" }));
    expect(rowKeys(state)).toEqual(["nationalForecast"]);
  });

  // The national chart passes no `regionScope`, so the two all-region rows the map cares
  // about must not appear on it.
  test("omitting regionScope drops both period rows", async () => {
    const state = await loaded(
      render({ scope: GB_NATIONAL, model: "blend", observers: GB_OBSERVERS })
    );
    expect(state.endpointStates?.allGspForecast).toBeUndefined();
    expect(state.endpointStates?.allGspReal).toBeUndefined();
  });

  test("passing a regionScope adds them back", async () => {
    const state = await loaded(
      render({
        scope: GB_NATIONAL,
        model: "blend",
        observers: GB_OBSERVERS,
        regionScope: GB_GSP
      })
    );
    expect(rowKeys(state)).toEqual([
      "allGspForecast",
      "allGspReal",
      "nationalForecast",
      "pvRealDayAfter",
      "pvRealDayIn"
    ]);
  });

  test("omitting nHourHorizonMinutes drops the N-hour row", async () => {
    const state = await loaded(
      render({ scope: GB_NATIONAL, model: "blend", observers: GB_OBSERVERS })
    );
    expect(state.endpointStates?.nationalNHour).toBeUndefined();
  });

  // The N-hour query is a long historic one that is slow by nature. It never held up
  // "initial load complete" under `computeLoadingState` and still must not.
  test("the N-hour row exists when asked for and does not gate initial load", async () => {
    const view = render({
      scope: GB_NATIONAL,
      model: "blend",
      observers: GB_OBSERVERS,
      nHourHorizonMinutes: 240
    });
    const state = await loaded(view);
    expect(rowKeys(state)).toContain("nationalNHour");
  });
});

describe("the message", () => {
  test("shows the initial-load message until everything has arrived, then clears", async () => {
    const view = render({ scope: GB_NATIONAL, model: "blend", observers: GB_OBSERVERS });
    expect(view.result.current.initialLoadComplete).toBe(false);
    expect(view.result.current.showMessage).toBe(true);
    expect(view.result.current.message).toBe("Loading initial data");

    const state = await loaded(view);
    expect(state.showMessage).toBe(false);
  });

  // An error outranks whatever was loading: the retry is silent, so the indicator is the only
  // place a user learns the data on screen may be behind.
  test("an error replaces the message and keeps it shown", async () => {
    // 403 rather than a 5xx: it is fatal, so it settles once instead of retrying six times
    // with backoff while the test waits.
    server.use(
      http.get(`${V1}/GB/solar/regions/national/generation`, () =>
        HttpResponse.json({ detail: "not entitled" }, { status: 403 })
      )
    );
    const view = render({ scope: GB_NATIONAL, model: "blend", observers: GB_OBSERVERS });
    await waitFor(() => {
      view.rerender();
      expect(view.result.current.endpointStates?.pvRealDayIn.error).toBeDefined();
    });
    expect(view.result.current.showMessage).toBe(true);
    expect(view.result.current.message).toMatch(/Error loading (initial )?data/);
  });
});

describe("disabled queries", () => {
  // A null scope must not leave the indicator stuck: a disabled query reports
  // `isLoading: false`, so "no country selected yet" reads as loaded-and-empty, not as
  // loading forever.
  test("a null scope settles immediately with no data", () => {
    const view = render({ scope: null, observers: [] });
    expect(view.result.current.initialLoadComplete).toBe(true);
    expect(view.result.current.showMessage).toBe(false);
    expect(view.result.current.endpointStates?.nationalForecast).toMatchObject({
      loading: false,
      hasData: false
    });
  });
});
