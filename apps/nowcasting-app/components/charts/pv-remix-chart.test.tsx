/**
 * The national chart against the v1 data layer, end to end: MSW over the real
 * `queries -> client -> normalise` machinery, the real country registry, and the real
 * `useLoadingState`.
 *
 * What this is for is the two things that are only true if the wiring is genuinely
 * config-driven rather than copy-pasted:
 *
 *  1. **The series list drives the requests.** GB asks for its four configured models, by their
 *     v1 names, one request each. Nothing is hardcoded in the component.
 *  2. **Country-varying row counts.** Switching to NL yields one forecast request and ONE
 *     generation request, because NL has a single observer. The GB two-line
 *     GENERATION/GENERATION_UPDATED chart is a GB fact, and a test that only ever renders GB
 *     cannot tell the difference between "built from the manifest" and "hardcoded pair".
 *
 * Harness notes, both from `hooks/data/data-hooks.test.tsx`'s `bothSettled`: the component
 * renders a dozen hooks with distinct SWR keys, so `rerender()` MUST happen inside the
 * `waitFor` polling callback, and there must be exactly one `waitFor`. MSW handler paths carry
 * the `/v1` prefix.
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
import { act, render as rtlRender, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { SWRConfig } from "swr";

jest.mock("next/router", () => ({ __esModule: true, default: { push: jest.fn() } }));
jest.mock("@sentry/nextjs", () => ({ __esModule: true, captureException: jest.fn() }));
jest.mock("@auth0/nextjs-auth0/client", () => ({
  __esModule: true,
  useUser: () => ({ user: null, isLoading: false, error: undefined })
}));
// Mapbox never loads in jsdom and the GSP drill-down chart is not what is under test here.
jest.mock("./gsp-pv-remix-chart", () => ({
  __esModule: true,
  default: () => null
}));
// Seasonal norms became a fetched asset in Phase 5 (they were a bundled JSON import), so
// rendering this chart now reaches for the network. There is no server here and this suite
// asserts nothing about the norm bands, so the hook is stubbed to "no dataset" — the same
// state NL is legitimately in. Without this, jsdom pulls in undici and the suite dies on
// missing `clearImmediate`/`markResourceTiming` rather than on anything it is testing.
// The norms' own behaviour is covered by `use-seasonal-norms.test.ts`.
jest.mock("../../hooks/data/use-seasonal-norms", () => ({
  __esModule: true,
  useSeasonalNorms: () => undefined
}));

import countriesFixture from "../../lib/api/v1/__fixtures__/countries.json";
import gbNationalForecast from "../../lib/api/v1/__fixtures__/gb-national-forecast.json";
import gbNationalGenerationInDay from "../../lib/api/v1/__fixtures__/gb-national-generation-pvlive_in_day.json";
import gbNationalGenerationDayAfter from "../../lib/api/v1/__fixtures__/gb-national-generation-pvlive_day_after.json";
import nlNationalGeneration from "../../lib/api/v1/__fixtures__/nl-national-generation-ned_nl.json";
import { resetTokenCache } from "../../lib/api/auth/token";
import { COUNTRY_CONFIG, forecastSeriesModel } from "../../config/countries";
import { setFocusedCountry, setGlobalState } from "../helpers/globalState";
import { DEFAULT_COUNTRY_CODE } from "../helpers/countryState";
import PvRemixChart from "./pv-remix-chart";

// recharts' ResponsiveContainer observes its box on mount; jsdom has no ResizeObserver. The
// container reports 0x0 either way, so the chart draws nothing — which is fine, because what
// is under test is the requests the component makes, not the SVG it produces.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

const V1 = "https://api.quartz.solar/v1";

let requests: { path: string; url: URL }[] = [];
const seen = (path: string) => requests.filter((r) => r.path === path);
const queryValues = (path: string, param: string) =>
  seen(path)
    .map((r) => r.url.searchParams.get(param))
    .sort();

const record = (request: Request) => {
  const url = new URL(request.url);
  requests.push({ path: url.pathname.replace(/^\/v1/, ""), url });
};

const json = (path: string, body: Parameters<typeof HttpResponse.json>[0]) =>
  http.get(`${V1}${path}`, ({ request }) => {
    record(request);
    return HttpResponse.json(body);
  });

// The recordings cover one model each; every model answers with the same payload, because
// what is under test is which requests go out, not what comes back per model.
const server = setupServer(
  http.get("/api/get_token", () => HttpResponse.json({ accessToken: "test-token" })),
  json("/countries", countriesFixture),
  json("/GB/solar/regions/national/forecast", gbNationalForecast),
  http.get(`${V1}/GB/solar/regions/national/generation`, ({ request }) => {
    record(request);
    const observer = new URL(request.url).searchParams.get("observer");
    return HttpResponse.json(
      observer === "pvlive_day_after" ? gbNationalGenerationDayAfter : gbNationalGenerationInDay
    );
  }),
  json("/NL/solar/regions/national/forecast", gbNationalForecast),
  json("/NL/solar/regions/national/generation", nlNationalGeneration)
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  requests = [];
  act(() => setFocusedCountry(DEFAULT_COUNTRY_CODE));
});
afterAll(() => server.close());
beforeEach(() => {
  resetTokenCache();
  // react-hooks-global-state is module-global with no provider, so it leaks between tests.
  setGlobalState("focusedCountry", DEFAULT_COUNTRY_CODE);
  setGlobalState("showNHourView", false);
  setGlobalState("nHourForecast", 4);
  setGlobalState("pLevels", []);
  setGlobalState("visibleLines", ["FORECAST", "GENERATION", "GENERATION_UPDATED"]);
});

const chart = () => (
  <SWRConfig value={{ provider: () => new Map() }}>
    <PvRemixChart />
  </SWRConfig>
);

const renderChart = () => rtlRender(chart());

type View = { rerender: (ui: React.ReactElement) => void };

/** Force a render, so a dropped SWR update is re-read from the cache. See `settled` below. */
const rerender = (view: View) => view.rerender(chart());

/**
 * Wait until the expected requests have all gone out, forcing a render on every poll.
 *
 * The `rerender` inside the callback is the point: with a dozen hooks on distinct SWR keys,
 * responses landing microseconds apart get their component update dropped, and the hook then
 * reports `isLoading` forever even though the cache holds the data. One `waitFor`, never two.
 */
const settled = async (view: View, expected: number) => {
  await waitFor(
    () => {
      rerender(view);
      expect(requests.length).toBeGreaterThanOrEqual(expected);
    },
    { timeout: 5000 }
  );
};

describe("the forecast series are driven by the country's config, not by the component", () => {
  test("GB asks for exactly its four configured models, by their v1 names", async () => {
    const view = renderChart();
    await settled(view, 6);

    const path = "/GB/solar/regions/national/forecast";
    const configured = COUNTRY_CONFIG.GB.nationalChartSeries.map(forecastSeriesModel);
    expect(queryValues(path, "model")).toEqual([...configured].sort());
    expect(seen(path)).toHaveLength(configured.length);
  });

  // The whole reason the list is curated rather than derived: GB national offers twelve
  // models and the chart draws four of them. It drew six until `pvnet_day_ahead` and
  // `pvnet_intraday` were removed — fetched on every load with no legend entry and no line to
  // draw them on, and close enough to the blend they mostly make up to add nothing.
  test("it does not fan out over every model the manifest offers", async () => {
    const view = renderChart();
    await settled(view, 6);

    const manifestModels = (countriesFixture as any[])
      .find((c) => c.country === "GB")
      .region_types.find((rt: any) => rt.type === "national").forecast_models;
    expect(manifestModels.length).toBe(12);
    expect(seen("/GB/solar/regions/national/forecast").length).toBe(4);
  });

  // v1 has no `trend_adjuster_on`; it exposes `_adjust` model variants instead, and the
  // instruction is to run on the non-adjusted ones until the API settles. If someone flips
  // NATIONAL_FORECAST_MODEL_SUFFIX, this and the config test move together.
  test("no request asks for an _adjust variant", async () => {
    const view = renderChart();
    await settled(view, 6);
    for (const model of queryValues("/GB/solar/regions/national/forecast", "model")) {
      expect(model).not.toMatch(/_adjust$/);
    }
  });

  /**
   * The API defaults `/regions/{region}/forecast` to **now → +48 hours** and
   * `/regions/{region}/generation` to the **last 24 hours**. The chart plots two days back, so
   * a request with no `start_utc` has no past forecast in it at all — which is what shipped
   * first and had to be fixed. Nothing else in the suite would have caught it: every fixture
   * answers regardless of the query string, so the chart rendered, just with the left half
   * empty.
   *
   * `end_utc` must stay ABSENT, which is the second half of the same bug. The first fix pinned
   * it to `getFurthestForecastTimestamp()` — now +1 day — which bought the past back by
   * clipping the forward horizon from the API's 48 hours to about 26. Leaving it off lets the
   * documented default supply the full horizon.
   */
  test("every national request pins a start, so the past is not cut off", async () => {
    const view = renderChart();
    await settled(view, 6);

    const forecasts = seen("/GB/solar/regions/national/forecast");
    const generation = seen("/GB/solar/regions/national/generation");
    expect(forecasts.length).toBeGreaterThan(0);
    expect(generation.length).toBeGreaterThan(0);

    for (const { url } of [...forecasts, ...generation]) {
      const start = url.searchParams.get("start_utc");
      expect(start).toBeTruthy();
      // Two days back, floored to a 6-hour boundary — the past the chart draws.
      expect(new Date(start as string).getTime()).toBeLessThan(Date.now());
    }
  });

  test("no national request pins an end, so the forward horizon is not clipped", async () => {
    const view = renderChart();
    await settled(view, 6);

    for (const { url } of [
      ...seen("/GB/solar/regions/national/forecast"),
      ...seen("/GB/solar/regions/national/generation")
    ]) {
      expect(url.searchParams.get("end_utc")).toBeNull();
    }
  });

  // The window has to be byte-identical across every national call, including the ones
  // `useLoadingState` repeats: a differing window is a different SWR key, which silently turns
  // the indicator's free cache hits back into real requests.
  test("all national requests share one window", async () => {
    const view = renderChart();
    await settled(view, 6);

    const windows = [
      ...seen("/GB/solar/regions/national/forecast"),
      ...seen("/GB/solar/regions/national/generation")
    ].map(({ url }) => `${url.searchParams.get("start_utc")}|${url.searchParams.get("end_utc")}`);
    expect(new Set(windows).size).toBe(1);
  });

  test("the N-hour series is only fetched when the N-hour view is on", async () => {
    const view = renderChart();
    await settled(view, 6);
    // One entry per configured series, none of them carrying a horizon.
    expect(queryValues("/GB/solar/regions/national/forecast", "horizon_minutes")).toEqual(
      new Array(COUNTRY_CONFIG.GB.nationalChartSeries.length).fill(null)
    );
  });
});

describe("observers are per country and there may be exactly one", () => {
  test("GB fetches both of its observers, one request each", async () => {
    const view = renderChart();
    await settled(view, 6);

    expect(queryValues("/GB/solar/regions/national/generation", "observer")).toEqual([
      "pvlive_day_after",
      "pvlive_in_day"
    ]);
  });

  // The assertion that separates "built from useGenerationSources" from "hardcoded pair":
  // NL has one observer, so there must be exactly one generation request and no attempt at
  // a second, undefined one.
  test("NL fetches its single observer and never a second", async () => {
    setGlobalState("focusedCountry", "NL");
    const view = renderChart();
    await settled(view, 2);

    await waitFor(() => {
      rerender(view);
      expect(seen("/NL/solar/regions/national/generation")).toHaveLength(1);
    });
    expect(queryValues("/NL/solar/regions/national/generation", "observer")).toEqual(["ned_nl"]);
    // ...and one forecast line, not GB's four.
    expect(seen("/NL/solar/regions/national/forecast")).toHaveLength(1);
    expect(seen("/GB/solar/regions/national/generation")).toHaveLength(0);
  });
});

// Phase 6 followup, Track G: the chart's own legend (`ChartLegend`, which produced the labels
// this block used to assert on — "ECMWF-only", "PV Live Estimated", "NED NL Initial") is gone.
// It duplicated the display rail's series toggles (`components/shell/display-panel.tsx`,
// `SeriesToggles`), which already built the identical list off the same two config sources
// (`nationalChartSeries` and `useGenerationSources`) and now carries the colour swatch that
// used to live only in the chart legend — see `docs/phase6-followup-track-g-notes.md`. That
// component has no dedicated test yet; this suite is end-to-end for the *chart*, not the rail,
// so the equivalent "series list drives legend rows" coverage belongs over there rather than
// rebuilt against a component this file does not render. What is worth pinning here is the
// negative: the chart itself renders no legend text at all any more.
describe("the chart's own key", () => {
  // Track G deleted `ChartLegend` and this block asserted its absence. The key is back
  // (`chart-legend.tsx`), so what is worth pinning has moved: it names *drawn* series only, and
  // it is inert. Both are the properties that stop it becoming the display rail drawn twice.
  test("GB: it names the drawn series and not the ones switched off", async () => {
    const view = renderChart();
    await settled(view, 6);
    await waitFor(() => {
      rerender(view);
      expect(screen.queryAllByText("PV Live Estimated")).toHaveLength(1);
    });

    // Configured for GB but absent from the default `visibleLines`, so the chart does not draw
    // them and the key must not name them.
    for (const label of ["ECMWF-only", "Met Office-only", "Satellite-only"]) {
      expect(screen.queryAllByText(label)).toHaveLength(0);
    }
  });

  test("GB: the key is inert — it holds no controls", async () => {
    const view = renderChart();
    await settled(view, 6);
    await waitFor(() => {
      rerender(view);
      expect(screen.queryByLabelText("Chart series")).not.toBeNull();
    });

    const legend = screen.getByLabelText("Chart series");
    expect(legend.querySelectorAll("button, input, [role='button']")).toHaveLength(0);
  });

  test("NL: the key follows the country's own series", async () => {
    setGlobalState("focusedCountry", "NL");
    const view = renderChart();
    await settled(view, 2);
    await waitFor(() => {
      rerender(view);
      expect(screen.queryAllByText("NED NL Initial")).toHaveLength(1);
    });
  });
});

describe("the staleness indicator", () => {
  // useLoadingState calls the same hooks the chart calls. If the arguments diverge, SWR keys
  // diverge, and the indicator silently reports on requests nobody is rendering — the failure
  // would show up here as extra requests rather than as a wrong message.
  test("adopting useLoadingState adds no requests of its own", async () => {
    const view = renderChart();
    await settled(view, 6);

    // 1 manifest + one forecast per configured series + 2 generations. Anything more means a
    // key mismatch. Off the config's own length, so removing a series does not leave this
    // asserting a count nothing produces any more.
    await waitFor(() => {
      rerender(view);
      expect(seen("/GB/solar/regions/national/forecast")).toHaveLength(
        COUNTRY_CONFIG.GB.nationalChartSeries.length
      );
    });
    expect(seen("/GB/solar/regions/national/generation")).toHaveLength(2);
    expect(seen("/countries").length).toBeGreaterThanOrEqual(1);
  });

  test("it stops showing the loading message once the data has arrived", async () => {
    const view = renderChart();
    expect(screen.queryByText(/Loading initial data/)).not.toBeNull();
    await settled(view, 6);
    await waitFor(() => {
      rerender(view);
      expect(screen.queryByText(/Loading initial data/)).toBeNull();
    });
  });
});
