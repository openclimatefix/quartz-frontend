/**
 * MSW + RTL over the real Phase 2 machinery — queries, client, normalise — against the
 * recorded `/countries` payload. Nothing here invents a wire shape: if the API drifts, the
 * fixture contract test catches it and these tests move with it.
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

// useUser() needs a UserProvider and a live /api/auth/me round trip; the claim it returns
// is the only part these tests care about, so it is stubbed directly.
let mockUser: unknown = null;
jest.mock("@auth0/nextjs-auth0/client", () => ({
  __esModule: true,
  useUser: () => ({ user: mockUser, isLoading: false, error: undefined })
}));

import Cookies from "js-cookie";
import countriesFixture from "../../lib/api/v1/__fixtures__/countries.json";
import { CookieStorageKeys } from "../../components/helpers/cookieStorage";
import {
  setEnabledCountries,
  setFocusedCountry,
  setGlobalState
} from "../../components/helpers/globalState";
import { COUNTRY_CLAIM_KEY } from "../../lib/api/auth/entitlement";
import { resetTokenCache } from "../../lib/api/auth/token";
import {
  useCountries,
  useEnabledCountries,
  useEnabledCountryListings,
  useEntitledCountries,
  useFocusedCountry
} from "./use-countries";

const COUNTRIES_URL = "https://api.quartz.solar/v1/countries";

let countriesRequestCount = 0;

const okHandler = http.get(COUNTRIES_URL, () => {
  countriesRequestCount++;
  return HttpResponse.json(countriesFixture);
});

const server = setupServer(
  http.get("/api/get_token", () => HttpResponse.json({ accessToken: "test-token" })),
  okHandler
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  countriesRequestCount = 0;
});
afterAll(() => server.close());

beforeEach(() => {
  resetTokenCache();
  mockUser = null;
  process.env.NEXT_PUBLIC_DEV_MODE = "false";
  // `react-hooks-global-state`'s store is module-global and leaks between tests. Reset both
  // country keys together — `setFocusedCountry` writes both, so resetting one is how a test
  // that only touched focus still leaves NL enabled for the next one.
  setGlobalState("focusedCountry", "GB");
  setGlobalState("enabledCountries", ["GB"]);
  Cookies.remove(CookieStorageKeys.COUNTRY);
  Cookies.remove(CookieStorageKeys.ENABLED_COUNTRIES);
});

// A fresh SWR cache per render, so one test's long-lived (one hour) manifest cache cannot
// satisfy the next test's request and hide a fetch that should have happened.
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

const renderCountries = () => renderHook(() => useCountries(), { wrapper });

describe("useCountries", () => {
  test("returns every manifest country, joined to its registry config", async () => {
    const { result } = renderCountries();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.countries.map((c) => c.code)).toEqual(["GB", "NL"]);
    const gb = result.current.countries[0];
    // Dynamic half, from the manifest.
    expect(gb.name).toBe("Great Britain");
    expect(gb.regionTypes.map((r) => r.type)).toEqual(["national", "gsp"]);
    expect(gb.generationSources.map((s) => s.name)).toEqual(["pvlive_in_day", "pvlive_day_after"]);
    // Static half, from the registry.
    expect(gb.configured).toBe(true);
    expect(gb.config?.timezone).toBe("Europe/London");
    expect(result.current.countries[1].config?.timezone).toBe("Europe/Amsterdam");
  });

  test("marks entitlement from the claim, entitling only the intersection", async () => {
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB"] };
    const { result } = renderCountries();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.countries.map((c) => [c.code, c.entitled])).toEqual([
      ["GB", true],
      ["NL", false]
    ]);
  });

  // The claim is not live on the tenant yet, so this is today's real behaviour: everything
  // discoverable, nothing entitled.
  test("an absent claim leaves every country listed but unentitled", async () => {
    mockUser = { email: "someone@example.test" };
    const { result } = renderCountries();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.countries).toHaveLength(2);
    expect(result.current.countries.every((c) => c.entitled === false)).toBe(true);
  });

  test("dev mode entitles everything", async () => {
    process.env.NEXT_PUBLIC_DEV_MODE = "true";
    const { result } = renderCountries();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.countries.every((c) => c.entitled)).toBe(true);
  });

  // Phase 6 adds DE by adding a registry entry. Until it does, a DE in the manifest must
  // still list — discoverable and flagged — rather than be dropped or crash the app.
  test("a manifest country with no registry entry is listed and flagged", async () => {
    server.use(
      http.get(COUNTRIES_URL, () =>
        HttpResponse.json([
          ...(countriesFixture as unknown[]),
          {
            country: "DE",
            name: "Deutschland",
            capacity_kW: 90000000,
            centroid: { lat: 51.16, lng: 10.45 },
            region_types: [],
            generation_sources: []
          }
        ])
      )
    );
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB", "DE"] };

    const { result } = renderCountries();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const de = result.current.countries.find((c) => c.code === "DE");
    expect(de).toBeDefined();
    expect(de?.configured).toBe(false);
    expect(de?.config).toBeUndefined();
    expect(de?.entitled).toBe(true);
  });

  test("caches the manifest across consumers rather than refetching", async () => {
    const { result } = renderHook(() => ({ a: useCountries(), b: useEntitledCountries() }), {
      wrapper
    });
    await waitFor(() => expect(result.current.a.isLoading).toBe(false));
    expect(countriesRequestCount).toBe(1);
  });
});

describe("retry policy", () => {
  // Cold `period`/`snapshot` caches answer 503 "retry in 60 seconds". Confirmed with the
  // API owner as a brief post-deploy state, so it is retried silently.
  test("retries a 503 and recovers", async () => {
    let calls = 0;
    server.use(
      http.get(COUNTRIES_URL, () => {
        calls++;
        if (calls === 1) {
          return HttpResponse.json({ detail: "cache is being populated" }, { status: 503 });
        }
        return HttpResponse.json(countriesFixture);
      })
    );

    const { result } = renderCountries();
    await waitFor(() => expect(result.current.countries).toHaveLength(2), { timeout: 5000 });
    expect(calls).toBeGreaterThan(1);
  }, 10000);

  // A 403 is the caller not being authorised; the same token retried cannot succeed, so
  // retrying only produces a request loop against an endpoint that will keep refusing.
  test("does not retry a 403", async () => {
    let calls = 0;
    server.use(
      http.get(COUNTRIES_URL, () => {
        calls++;
        return HttpResponse.json({ detail: "not allowed" }, { status: 403 });
      })
    );

    const { result } = renderCountries();
    await waitFor(() => expect(result.current.error).toBeDefined());
    expect((result.current.error as { status: number }).status).toBe(403);
    expect(result.current.countries).toEqual([]);

    await new Promise((resolve) => setTimeout(resolve, 2500));
    expect(calls).toBe(1);
  }, 10000);
});

describe("useEntitledCountries", () => {
  test("returns only the entitled, configured subset", async () => {
    mockUser = { [COUNTRY_CLAIM_KEY]: ["NL"] };
    const { result } = renderHook(() => useEntitledCountries(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.countries.map((c) => c.code)).toEqual(["NL"]);
  });

  test("an empty claim fans out over nothing", async () => {
    const { result } = renderHook(() => useEntitledCountries(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.countries).toEqual([]);
  });
});

describe("useFocusedCountry", () => {
  test("defaults to GB", () => {
    const { result } = renderHook(() => useFocusedCountry());
    expect(result.current).toBe("GB");
  });

  // The point of the hook: every consumer reads the live value, so the toggle switching
  // country re-renders the charts, headline figures and CSV without any of them knowing
  // where the country came from.
  test("reflects a country change", () => {
    const { result } = renderHook(() => useFocusedCountry());
    act(() => setFocusedCountry("NL"));
    expect(result.current).toBe("NL");
  });

  test("reflects the normalisation setFocusedCountry applies", () => {
    const { result } = renderHook(() => useFocusedCountry());
    act(() => setFocusedCountry("nl"));
    expect(result.current).toBe("NL");
  });
});

describe("useEnabledCountries", () => {
  // Codes, not listings: this is synchronous global state, so a map layer or a cursor grid
  // can depend on it without inheriting the manifest's loading and error states.
  test("is the default country alone until something enables more", () => {
    const { result } = renderHook(() => useEnabledCountries());
    expect(result.current).toEqual(["GB"]);
  });

  test("reflects the set live, like the focused country does", () => {
    const { result } = renderHook(() => useEnabledCountries());
    act(() => setEnabledCountries(["GB", "NL"]));
    expect(result.current).toEqual(["GB", "NL"]);
  });

  test("always contains the focused country", () => {
    const { result } = renderHook(() => ({
      enabled: useEnabledCountries(),
      focused: useFocusedCountry()
    }));
    act(() => setFocusedCountry("NL"));
    expect(result.current.enabled).toContain(result.current.focused);
  });
});

describe("useEnabledCountryListings", () => {
  test("is the enabled set joined to the manifest, in enabled order", async () => {
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB", "NL"] };
    act(() => setEnabledCountries(["NL", "GB"]));

    const { result } = renderHook(() => useEnabledCountryListings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.countries.map((c) => c.code)).toEqual(["NL", "GB"]);
    expect(result.current.countries[0].config).toBeDefined();
  });

  // Entitlement is applied here rather than in the state layer, because the claim arrives
  // asynchronously and does not exist on the tenant yet. State keeps the user's choice; this
  // is what refuses to draw it.
  test("drops an enabled country the user is not entitled to", async () => {
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB"] };
    act(() => setEnabledCountries(["GB", "NL"]));

    const { result } = renderHook(() => useEnabledCountryListings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.countries.map((c) => c.code)).toEqual(["GB"]);
  });

  test("is empty while the manifest is still loading, rather than guessing", () => {
    const { result } = renderHook(() => useEnabledCountryListings(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.countries).toEqual([]);
  });
});
