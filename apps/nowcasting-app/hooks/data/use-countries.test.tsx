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
import { renderHook, waitFor } from "@testing-library/react";
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

import countriesFixture from "../../lib/api/v1/__fixtures__/countries.json";
import { COUNTRY_CLAIM_KEY } from "../../lib/api/auth/entitlement";
import { resetTokenCache } from "../../lib/api/auth/token";
import { useCountries, useCurrentCountry, useEntitledCountries } from "./use-countries";

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

describe("useCurrentCountry", () => {
  // Deliberately a constant until the Phase 3 state split lands. Pinned so the swap to
  // cookie-backed global state is a visible, single-file change.
  test("falls back to GB", () => {
    const { result } = renderHook(() => useCurrentCountry());
    expect(result.current).toBe("GB");
  });
});
