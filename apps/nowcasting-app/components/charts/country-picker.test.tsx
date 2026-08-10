/**
 * The chart header's country picker — which country the chart is reading.
 *
 * The half of the Phase 6 country split that lives with the numbers it governs. Three things
 * matter: it offers only countries that are actually drawn (choosing one that is not would
 * silently enable it, which is the muddle this arrangement exists to remove); it does not
 * pretend to be a choice when there is only one; and it renders correctly before the country
 * manifest has loaded, because the enabled set is synchronous state and the manifest is an
 * hour-cached request that can cold-start with a 503.
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
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
import { COUNTRY_CLAIM_KEY } from "../../lib/api/auth/entitlement";
import { resetTokenCache } from "../../lib/api/auth/token";
import { CookieStorageKeys } from "../helpers/cookieStorage";
import { DEFAULT_COUNTRY_CODE } from "../helpers/countryState";
import {
  getGlobalState,
  setEnabledCountries,
  setFocusedCountry,
  setGlobalState
} from "../helpers/globalState";
import ChartCountryPicker from "./country-picker";

const COUNTRIES_URL = "https://api.quartz.solar/v1/countries";

const server = setupServer(
  http.get("/api/get_token", () => HttpResponse.json({ accessToken: "test-token" })),
  http.get(COUNTRIES_URL, () => HttpResponse.json(countriesFixture))
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  Cookies.remove(CookieStorageKeys.COUNTRY);
  Cookies.remove(CookieStorageKeys.ENABLED_COUNTRIES);
});
afterAll(() => server.close());

beforeEach(() => {
  resetTokenCache();
  mockUser = { [COUNTRY_CLAIM_KEY]: ["GB", "NL"] };
  process.env.NEXT_PUBLIC_DEV_MODE = "false";
  // `react-hooks-global-state`'s store is module-global and leaks between tests.
  setGlobalState("focusedCountry", DEFAULT_COUNTRY_CODE);
  setGlobalState("enabledCountries", [DEFAULT_COUNTRY_CODE]);
});

const renderPicker = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <ChartCountryPicker />
    </SWRConfig>
  );

describe("with more than one country drawn", () => {
  beforeEach(() => setEnabledCountries(["GB", "NL"]));

  test("offers exactly the enabled countries, marking the focused one", async () => {
    renderPicker();
    await waitFor(() => expect(screen.getByRole("button", { name: "NL" })).toBeInTheDocument());

    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["GB", "NL"]);
    expect(screen.getByRole("button", { name: "GB" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "NL" })).toHaveAttribute("aria-pressed", "false");
  });

  test("choosing one moves focus and persists it, leaving the map's set alone", async () => {
    renderPicker();
    await waitFor(() => expect(screen.getByRole("button", { name: "NL" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "NL" }));

    expect(getGlobalState("focusedCountry")).toBe("NL");
    expect(getGlobalState("enabledCountries")).toEqual(["GB", "NL"]);
    expect(Cookies.get(CookieStorageKeys.COUNTRY)).toBe(JSON.stringify("NL"));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "NL" })).toHaveAttribute("aria-pressed", "true")
    );
  });

  // A country not on the map is not on offer: picking it would have to enable it, which is
  // exactly the "one gesture does two things" muddle the split removes.
  test("does not offer a country that is not drawn", async () => {
    setEnabledCountries(["GB"]);
    renderPicker();

    await waitFor(() => expect(screen.getByTitle("Great Britain")).toHaveTextContent("GB"));
    expect(screen.queryByRole("button", { name: "NL" })).not.toBeInTheDocument();
  });

  // The set is synchronous global state; the manifest is not. The picker must be right on
  // the first paint, with the manifest contributing only the tooltip.
  test("renders before the manifest arrives", () => {
    server.use(http.get(COUNTRIES_URL, () => new Promise(() => {})));
    renderPicker();

    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["GB", "NL"]);
  });

  test("names the country in full once the manifest arrives", async () => {
    renderPicker();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "NL" })).toHaveAttribute(
        "title",
        expect.stringContaining("Nederland") as unknown as string
      )
    );
  });
});

describe("with one country drawn", () => {
  // The common case, and a lone highlighted button reads as a control that has lost its
  // other half.
  test("names the country rather than offering a one-sided choice", async () => {
    renderPicker();

    await waitFor(() => expect(screen.getByTitle("Great Britain")).toHaveTextContent("GB"));
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  test("follows focus when the map hands it somewhere else", async () => {
    setEnabledCountries(["GB", "NL"]);
    renderPicker();
    await waitFor(() => expect(screen.getByRole("button", { name: "NL" })).toBeInTheDocument());

    // Standing in for a map region click, which focuses the country the region belongs to.
    setFocusedCountry("NL");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "NL" })).toHaveAttribute("aria-pressed", "true")
    );
  });
});
