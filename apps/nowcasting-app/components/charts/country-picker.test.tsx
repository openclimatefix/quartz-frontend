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
    await waitFor(() => expect(screen.getByRole("radio", { name: "NL" })).toBeInTheDocument());

    expect(screen.getAllByRole("radio").map((b) => b.textContent)).toEqual(["GB", "NL"]);
    expect(screen.getByRole("radio", { name: "GB" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "NL" })).toHaveAttribute("aria-checked", "false");
  });

  test("choosing one moves focus and persists it, leaving the map's set alone", async () => {
    renderPicker();
    await waitFor(() => expect(screen.getByRole("radio", { name: "NL" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("radio", { name: "NL" }));

    expect(getGlobalState("focusedCountry")).toBe("NL");
    expect(getGlobalState("enabledCountries")).toEqual(["GB", "NL"]);
    expect(Cookies.get(CookieStorageKeys.COUNTRY)).toBe(JSON.stringify("NL"));

    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "NL" })).toHaveAttribute("aria-checked", "true")
    );
  });

  // A country not on the map is not on offer: picking it would have to enable it, which is
  // exactly the "one gesture does two things" muddle the split removes.
  test("does not offer a country that is not drawn", async () => {
    setEnabledCountries(["GB"]);
    renderPicker();

    await waitFor(() => expect(screen.getByTitle("Great Britain")).toHaveTextContent("GB"));
    expect(screen.queryByRole("radio", { name: "NL" })).not.toBeInTheDocument();
  });

  // The set is synchronous global state; the manifest is not. The picker must be right on
  // the first paint, with the manifest contributing only the tooltip.
  test("renders before the manifest arrives", () => {
    server.use(http.get(COUNTRIES_URL, () => new Promise(() => {})));
    renderPicker();

    expect(screen.getAllByRole("radio").map((b) => b.textContent)).toEqual(["GB", "NL"]);
  });

  test("names the country in full once the manifest arrives", async () => {
    renderPicker();
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "NL" })).toHaveAttribute(
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
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  test("follows focus when the map hands it somewhere else", async () => {
    setEnabledCountries(["GB", "NL"]);
    renderPicker();
    await waitFor(() => expect(screen.getByRole("radio", { name: "NL" })).toBeInTheDocument());

    // Standing in for a map region click, which focuses the country the region belongs to.
    setFocusedCountry("NL");

    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "NL" })).toHaveAttribute("aria-checked", "true")
    );
  });
});

// The sliding track. The thumb is the only thing that moves — the labels hold position and
// change colour — and how fast it travels encodes where the change came from.
describe("the track", () => {
  beforeEach(() => setEnabledCountries(["GB", "NL"]));

  // The repo's convention is `data-test`, which RTL's `getByTestId` does not look at.
  const thumb = (): HTMLElement => {
    const el = document.querySelector('[data-test="chart-country-thumb"]');
    if (!el) throw new Error("no thumb rendered");
    return el as HTMLElement;
  };

  test("is a radiogroup, not a bank of toggles", async () => {
    renderPicker();
    await waitFor(() => expect(screen.getByRole("radiogroup")).toBeInTheDocument());

    expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-label", "Chart country");
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  test("parks the thumb over the focused country, one segment wide", async () => {
    renderPicker();
    await waitFor(() => expect(screen.getByRole("radio", { name: "NL" })).toBeInTheDocument());

    expect(thumb()).toHaveStyle({ width: "50%", transform: "translateX(0%)" });

    fireEvent.click(screen.getByRole("radio", { name: "NL" }));

    await waitFor(() => expect(thumb()).toHaveStyle({ transform: "translateX(100%)" }));
  });

  // Roving tabindex: the group is one tab stop and the arrows move within it, wrapping.
  test("arrow keys move the choice, and wrap", async () => {
    renderPicker();
    await waitFor(() => expect(screen.getByRole("radio", { name: "NL" })).toBeInTheDocument());

    expect(screen.getByRole("radio", { name: "GB" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "NL" })).toHaveAttribute("tabindex", "-1");

    fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "ArrowRight" });
    await waitFor(() => expect(getGlobalState("focusedCountry")).toBe("NL"));

    fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "ArrowRight" });
    await waitFor(() => expect(getGlobalState("focusedCountry")).toBe("GB"));
  });

  // Contract §1: focus arriving from a map region click has to be *seen*, and the user is
  // looking at the map when it lands, so it travels slower. Choosing here is a confirmation
  // and stays immediate. Travel speed is the entire signal — a ring was tried and cut.
  test("travels slower for a focus change it did not cause than for one it did", async () => {
    renderPicker();
    await waitFor(() => expect(screen.getByRole("radio", { name: "NL" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("radio", { name: "NL" }));
    await waitFor(() => expect(thumb()).toHaveStyle({ transform: "translateX(100%)" }));
    expect(thumb()).toHaveStyle({ transitionDuration: "200ms" });

    // Standing in for a map region click, which focuses the country the region belongs to.
    setFocusedCountry("GB");

    await waitFor(() => expect(thumb()).toHaveStyle({ transitionDuration: "420ms" }));
    expect(thumb()).toHaveStyle({ transform: "translateX(0%)" });
  });

  // The slower duration is a property of that one arrival, not a mode the control gets stuck
  // in — the next choice made here has to be immediate again.
  test("returns to the immediate timing once the hand-over has landed", async () => {
    renderPicker();
    await waitFor(() => expect(screen.getByRole("radio", { name: "NL" })).toBeInTheDocument());

    setFocusedCountry("NL");
    await waitFor(() => expect(thumb()).toHaveStyle({ transitionDuration: "420ms" }));

    await waitFor(() => expect(thumb()).toHaveStyle({ transitionDuration: "200ms" }), {
      timeout: 2000
    });
  });
});
