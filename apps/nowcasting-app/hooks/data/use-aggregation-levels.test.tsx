/**
 * The hook side of the region-type seam: the derived list joined to the current country and
 * the live manifest.
 *
 * The derivation itself is tested in `components/helpers/aggregationLevels.test.ts`. What is
 * worth testing here is what only the hook can get wrong — that the manifest's labels reach
 * the list, and that a stored region type belonging to a *different* country resolves to
 * this country's default rather than to `undefined`. That second one happens the instant
 * anyone switches country, because the stored value is a bare name.
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
import {
  setCountryState,
  setFocusedCountry,
  setGlobalState
} from "../../components/helpers/globalState";
import { COUNTRY_SCOPED_KEYS } from "../../components/helpers/countryState";
import { resetTokenCache } from "../../lib/api/auth/token";
import { useAggregationLevels, useCurrentAggregationLevel } from "./use-aggregation-levels";

const server = setupServer(
  http.get("/api/get_token", () => HttpResponse.json({ accessToken: "test-token" })),
  http.get("https://api.quartz.solar/v1/countries", () => HttpResponse.json(countriesFixture))
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// The global store is module-global and leaks between tests; emptying the country-keyed
// records puts each test back at "no country visited yet".
beforeEach(() => {
  resetTokenCache();
  process.env.NEXT_PUBLIC_DEV_MODE = "false";
  setGlobalState("focusedCountry", "GB");
  for (const key of COUNTRY_SCOPED_KEYS) setGlobalState(key as "lng", {});
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

describe("useAggregationLevels", () => {
  test("returns the current country's levels, outermost first", async () => {
    const { result } = renderHook(() => useAggregationLevels(), { wrapper });
    await waitFor(() =>
      expect(result.current.map((level) => level.regionType)).toEqual([
        "national",
        "dno",
        "zone",
        "gsp"
      ])
    );
    // GB's `gsp` label is "GSP" because the registry overrides the manifest's "Grid Supply
    // Point" (Brad's call — see `GeoLayerConfig.label`). This assertion therefore no longer
    // doubles as proof that the manifest reached the list: with the override in place, GB
    // has no non-derived label that differs between manifest and registry. That proof lives
    // in `aggregationLevels.test.ts`'s override tests, which feed the manifest's real
    // wording and assert the registry wins.
    expect(result.current.map((level) => level.label)).toEqual(["National", "DNO", "Zone", "GSP"]);
    expect(result.current.filter((level) => level.derived).map((l) => l.regionType)).toEqual([
      "dno",
      "zone"
    ]);
  });

  test("follows the current country", async () => {
    setFocusedCountry("NL");
    const { result } = renderHook(() => useAggregationLevels(), { wrapper });
    await waitFor(() =>
      expect(result.current.map((level) => level.regionType)).toEqual(["national", "province"])
    );
  });

  test("is usable before the manifest resolves, from the registry alone", () => {
    // The map draws from this list, so an empty first render would be a flash of nothing.
    const { result } = renderHook(() => useAggregationLevels(), { wrapper });
    expect(result.current.map((level) => level.regionType)).toEqual([
      "national",
      "dno",
      "zone",
      "gsp"
    ]);
  });
});

describe("useCurrentAggregationLevel", () => {
  test("returns the level the stored region type names", async () => {
    setCountryState("nationalAggregationLevel", "dno");
    const { result } = renderHook(() => useCurrentAggregationLevel(), { wrapper });
    await waitFor(() => expect(result.current?.regionType).toBe("dno"));
    expect(result.current?.derived).toBe(true);
  });

  test("defaults to the country's finest non-derived level when nothing is stored", async () => {
    const { result } = renderHook(() => useCurrentAggregationLevel(), { wrapper });
    await waitFor(() => expect(result.current?.regionType).toBe("gsp"));
  });

  test("falls back to this country's default when the stored level belongs to another", async () => {
    // The country switch: `nationalAggregationLevel` is country-keyed, but NL has never been
    // visited, so it takes its own default — and even if a stale `gsp` were stored against
    // NL, NL has no such level and must resolve to `province`, not to `undefined`.
    setCountryState("nationalAggregationLevel", "gsp", "NL");
    setFocusedCountry("NL");
    const { result } = renderHook(() => useCurrentAggregationLevel(), { wrapper });
    await waitFor(() => expect(result.current?.regionType).toBe("province"));
  });

  test("is undefined only for a country with no registry entry", async () => {
    setFocusedCountry("ZZ");
    const { result } = renderHook(() => useCurrentAggregationLevel(), { wrapper });
    await waitFor(() => expect(result.current).toBeUndefined());
  });
});
