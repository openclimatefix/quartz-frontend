/**
 * The two enabled-set rules: derived from entitlement for a regular user, chosen (and only
 * seeded) for an OCF admin. MSW serves the recorded `/countries` payload (GB and NL).
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
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { SWRConfig } from "swr";

jest.mock("next/router", () => ({ __esModule: true, default: { push: jest.fn() } }));
jest.mock("@sentry/nextjs", () => ({ __esModule: true, captureException: jest.fn() }));

let mockUser: unknown = null;
jest.mock("@auth0/nextjs-auth0/client", () => ({
  __esModule: true,
  useUser: () => ({ user: mockUser, isLoading: false, error: undefined })
}));

import Cookies from "js-cookie";
import countriesFixture from "../../lib/api/v1/__fixtures__/countries.json";
import { CookieStorageKeys } from "../../components/helpers/cookieStorage";
import {
  getGlobalState,
  setEnabledCountriesDerived,
  setGlobalState,
  toggleCountryEnabled
} from "../../components/helpers/globalState";
import { PRODUCTS_CLAIM_KEY } from "../../lib/api/auth/entitlement";
import { resetTokenCache } from "../../lib/api/auth/token";
import { useCountries, useEnabledCountries, useIsOcfAdmin } from "./use-countries";
import useSyncEnabledCountries from "./use-sync-enabled-countries";

const server = setupServer(
  http.get("/api/get_token", () => HttpResponse.json({ accessToken: "test-token" })),
  http.get("https://api.quartz.solar/v1/countries", () => HttpResponse.json(countriesFixture))
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  resetTokenCache();
  mockUser = null;
  process.env.NEXT_PUBLIC_DEV_MODE = "false";
  setEnabledCountriesDerived(false);
  // What module load leaves behind for a user whose cookie says GB alone.
  setGlobalState("focusedCountry", "GB");
  setGlobalState("enabledCountries", ["GB"]);
  Cookies.remove(CookieStorageKeys.COUNTRY);
  Cookies.remove(CookieStorageKeys.ENABLED_COUNTRIES);
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

// `result.current` is the enabled set; `manifest.current` says whether `/countries` has
// arrived, so a "nothing changed" assertion is made after the sync had its chance to act.
const renderSync = () => {
  const manifest = { current: false };
  const rendered = renderHook(
    () => {
      useSyncEnabledCountries();
      const { countries } = useCountries();
      manifest.current = countries.length > 0;
      return useEnabledCountries();
    },
    { wrapper }
  );
  return { ...rendered, manifest };
};

const settle = async (manifest: { current: boolean }) => {
  await waitFor(() => expect(manifest.current).toBe(true));
  // One more turn for the effect that runs after the manifest's render.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const products = (...keys: string[]) => ({ [PRODUCTS_CLAIM_KEY]: keys });
const cookieSet = () => {
  const raw = Cookies.get(CookieStorageKeys.ENABLED_COUNTRIES);
  return raw === undefined ? undefined : JSON.parse(raw);
};
const sorted = (codes: string[]) => codes.slice().sort();

describe("useIsOcfAdmin", () => {
  test("reads ocf-admin from the products claim", () => {
    mockUser = products("gb-solar", "ocf-admin");
    expect(renderHook(() => useIsOcfAdmin()).result.current).toBe(true);
    mockUser = products("gb-solar");
    expect(renderHook(() => useIsOcfAdmin()).result.current).toBe(false);
  });
});

describe("a regular user", () => {
  test("has every entitled country enabled, whatever a narrower cookie says", async () => {
    Cookies.set(CookieStorageKeys.ENABLED_COUNTRIES, JSON.stringify(["GB"]));
    mockUser = products("gb-solar", "nl-solar");
    const { result } = renderSync();
    await waitFor(() => expect(sorted(result.current)).toEqual(["GB", "NL"]));
    // Neither read nor written: the stale cookie is left as it was.
    expect(cookieSet()).toEqual(["GB"]);
  });

  test("follows a change in entitlement mid-session", async () => {
    mockUser = products("gb-solar", "nl-solar");
    const { result, rerender } = renderSync();
    await waitFor(() => expect(sorted(result.current)).toEqual(["GB", "NL"]));

    mockUser = products("nl-solar");
    rerender();
    await waitFor(() => expect(result.current).toEqual(["NL"]));
    // Focus kept inside the set by `setEnabledCountries`.
    expect(getGlobalState("focusedCountry")).toBe("NL");
    expect(cookieSet()).toBeUndefined();
  });

  test("cannot switch a country off: the set is put back", async () => {
    mockUser = products("gb-solar", "nl-solar");
    const { result } = renderSync();
    await waitFor(() => expect(sorted(result.current)).toEqual(["GB", "NL"]));

    act(() => toggleCountryEnabled("NL"));
    await waitFor(() => expect(sorted(result.current)).toEqual(["GB", "NL"]));
    expect(cookieSet()).toBeUndefined();
  });

  test("entitled to nothing keeps the set it started with", async () => {
    mockUser = products("asset-solar");
    const { result, manifest } = renderSync();
    await settle(manifest);
    expect(result.current).toEqual(["GB"]);
  });
});

describe("an OCF admin", () => {
  test("keeps the set in their cookie", async () => {
    Cookies.set(CookieStorageKeys.ENABLED_COUNTRIES, JSON.stringify(["GB"]));
    mockUser = products("gb-solar", "nl-solar", "ocf-admin");
    const { result, manifest } = renderSync();
    await settle(manifest);
    expect(result.current).toEqual(["GB"]);
  });

  test("with no cookie is seeded with every entitled country, and the cookie written", async () => {
    mockUser = products("gb-solar", "nl-solar", "ocf-admin");
    const { result } = renderSync();
    await waitFor(() => expect(sorted(result.current)).toEqual(["GB", "NL"]));
    expect(sorted(cookieSet())).toEqual(["GB", "NL"]);
  });

  test("can switch a country off, and the choice is persisted", async () => {
    Cookies.set(CookieStorageKeys.ENABLED_COUNTRIES, JSON.stringify(["GB", "NL"]));
    setGlobalState("enabledCountries", ["GB", "NL"]);
    mockUser = products("gb-solar", "nl-solar", "ocf-admin");
    const { result, manifest } = renderSync();
    await settle(manifest);
    act(() => toggleCountryEnabled("NL"));
    await settle(manifest);
    expect(result.current).toEqual(["GB"]);
    expect(cookieSet()).toEqual(["GB"]);
  });

  test("dev mode counts as admin, so the cookie is honoured", async () => {
    process.env.NEXT_PUBLIC_DEV_MODE = "true";
    Cookies.set(CookieStorageKeys.ENABLED_COUNTRIES, JSON.stringify(["GB"]));
    const { result, manifest } = renderSync();
    await settle(manifest);
    expect(result.current).toEqual(["GB"]);
  });
});
