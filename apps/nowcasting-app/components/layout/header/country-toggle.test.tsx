/**
 * The header country control — which countries are drawn on the map.
 *
 * Since Phase 6 this is a plain multi-select and nothing more: *focused* (which country the
 * chart reads) moved to the chart header, so the property most worth pinning here is the
 * negative one — enabling a country must not silently move the chart.
 *
 * Two older properties still matter. First, an unentitled country must be *shown and
 * unclickable* — `/countries` returns every country the API serves so a prospect can see
 * what exists, and hiding them would defeat that. Second, the states where there is no real
 * choice (manifest loading, manifest failed, one country) must not render a half-drawn
 * toggle: the app still works in all of them, because the enabled set comes from the cookie
 * rather than the manifest.
 *
 * Newest is the status lamp. Its rendering is unreachable in production today, because
 * `useCountryStatus` is a stub — so the non-ok cases are driven here by mocking the hook, and
 * these tests are the only thing keeping that path honest until the endpoint exists.
 *
 * Everything is driven off the recorded `/countries` fixture — the same payload the contract
 * test validates against `v1-api.json`.
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

// `useCountryStatus` returns "ok" for everything (see its doc comment — there is no
// per-country status endpoint yet). Mocking it is the only way to reach the non-ok rendering,
// and driving it from here is what stops that rendering being dead code nobody notices has
// rotted before the endpoint lands.
let mockStatuses: Record<string, { level: string; message: string | null }> = {};
const OK_STATUS = { level: "ok", message: null };
jest.mock("../../../hooks/data/use-country-status", () => ({
  __esModule: true,
  useCountryStatus: (code: string) => mockStatuses[code] ?? OK_STATUS
}));

// This repo marks test hooks with `data-test`, which RTL's `getByTestId` does not read.
const discFor = (code: string) =>
  document.querySelector(`[data-test="country-disc-${code}"]`) as HTMLElement | null;
const statusFor = (code: string) =>
  document.querySelector(`[data-test="country-status-${code}"]`) as HTMLElement | null;

import Cookies from "js-cookie";
import countriesFixture from "../../../lib/api/v1/__fixtures__/countries.json";
import { COUNTRY_CLAIM_KEY } from "../../../lib/api/auth/entitlement";
import { resetTokenCache } from "../../../lib/api/auth/token";
import { CookieStorageKeys } from "../../helpers/cookieStorage";
import { DEFAULT_COUNTRY_CODE } from "../../helpers/countryState";
import {
  getGlobalState,
  setEnabledCountries,
  setFocusedCountry,
  setGlobalState
} from "../../helpers/globalState";
import CountryToggle from "./country-toggle";

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
  mockUser = null;
  mockStatuses = {};
  process.env.NEXT_PUBLIC_DEV_MODE = "false";
  // `react-hooks-global-state`'s store is module-global and leaks between tests.
  setGlobalState("focusedCountry", DEFAULT_COUNTRY_CODE);
  setGlobalState("enabledCountries", [DEFAULT_COUNTRY_CODE]);
});

// A fresh SWR cache per render, so one test's hour-long manifest cache cannot satisfy the
// next test's request and hide a fetch that should have happened.
const renderToggle = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <CountryToggle />
    </SWRConfig>
  );

const options = () => screen.getAllByRole("button").map((b) => b.textContent);

describe("with the manifest loaded", () => {
  test("renders one option per manifest country", async () => {
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB", "NL"] };
    renderToggle();
    await waitFor(() => expect(screen.getByRole("button", { name: "NL" })).toBeInTheDocument());

    expect(options()).toEqual(["GB", "NL"]);
  });

  // `aria-pressed` is the enabled state, and it is the *only* state this control carries.
  // Focus moved to the chart header in Phase 6, so nothing here should reflect it.
  test("reports which countries are drawn, and nothing about focus", async () => {
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB", "NL"] };
    renderToggle();
    await waitFor(() => expect(screen.getByRole("button", { name: "NL" })).toBeInTheDocument());

    expect(screen.getByRole("button", { name: "GB" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "NL" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "GB" })).not.toHaveAttribute("aria-current");
  });

  test("enabling a country adds it to the map and persists, without moving focus", async () => {
    // The point of the split: "draw this" and "read this" are two gestures in two places.
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB", "NL"] };
    renderToggle();
    await waitFor(() => expect(screen.getByRole("button", { name: "NL" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "NL" }));

    expect(getGlobalState("enabledCountries")).toEqual(["GB", "NL"]);
    expect(getGlobalState("focusedCountry")).toBe("GB");
    expect(Cookies.get(CookieStorageKeys.ENABLED_COUNTRIES)).toBe(JSON.stringify(["GB", "NL"]));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "NL" })).toHaveAttribute("aria-pressed", "true")
    );
  });

  test("disabling an unfocused country leaves focus alone", async () => {
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB", "NL"] };
    setEnabledCountries(["GB", "NL"]);
    renderToggle();
    await waitFor(() => expect(screen.getByRole("button", { name: "NL" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "NL" }));

    expect(getGlobalState("enabledCountries")).toEqual(["GB"]);
    expect(getGlobalState("focusedCountry")).toBe("GB");
  });

  // The one case where this control touches focus, and it is the invariant rather than a
  // choice: the chart cannot be reading a country that is not drawn.
  test("disabling the focused country hands focus to what is left", async () => {
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB", "NL"] };
    setEnabledCountries(["GB", "NL"]);
    setFocusedCountry("NL");
    renderToggle();
    await waitFor(() => expect(screen.getByRole("button", { name: "NL" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "NL" }));

    expect(getGlobalState("enabledCountries")).toEqual(["GB"]);
    expect(getGlobalState("focusedCountry")).toBe("GB");
  });

  // An empty set is a blank map with no way back. `setEnabledCountries` refuses it too; the
  // point here is that the button does not pretend otherwise.
  test("the last enabled country is not clickable", async () => {
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB", "NL"] };
    renderToggle();
    await waitFor(() => expect(screen.getByRole("button", { name: "NL" })).toBeInTheDocument());

    expect(screen.getByRole("button", { name: "GB" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "GB" }));
    expect(getGlobalState("enabledCountries")).toEqual(["GB"]);
  });

  // Shown-but-disabled is the deliberate design: a prospect should be able to see that NL
  // exists before their subscription completes.
  test("an unentitled country is listed but disabled and unselectable", async () => {
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB"] };
    renderToggle();
    await waitFor(() => expect(screen.getByRole("button", { name: "NL" })).toBeInTheDocument());

    const nl = screen.getByRole("button", { name: "NL" });
    expect(nl).toBeDisabled();

    // React DOM does not invoke handlers for mouse events on disabled form controls, so
    // this is the real "unselectable", not just "looks greyed out".
    fireEvent.click(nl);
    expect(getGlobalState("focusedCountry")).toBe("GB");
    expect(Cookies.get(CookieStorageKeys.COUNTRY)).toBeUndefined();
  });

  // Today's production state: the Auth0 Action that sets the country claim has not shipped,
  // so nothing is entitled. Every country must still be visible.
  test("with no entitlement at all, every country renders disabled", async () => {
    mockUser = { email: "someone@example.test" };
    renderToggle();
    await waitFor(() => expect(screen.getByRole("button", { name: "NL" })).toBeInTheDocument());

    expect(options()).toEqual(["GB", "NL"]);
    for (const code of ["GB", "NL"]) {
      expect(screen.getByRole("button", { name: code })).toBeDisabled();
    }
  });

  // A country in the manifest this build has no registry entry for has no boundaries to draw
  // and no timezone to render in, so it is discoverable but not selectable even when entitled.
  test("an entitled country with no registry entry is listed but disabled", async () => {
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
    renderToggle();
    await waitFor(() => expect(screen.getByRole("button", { name: "DE" })).toBeInTheDocument());

    expect(screen.getByRole("button", { name: "DE" })).toBeDisabled();
  });
});

describe("states with no real choice", () => {
  test("while the manifest loads, it names the focused country rather than nothing", async () => {
    server.use(http.get(COUNTRIES_URL, () => new Promise(() => {})));
    renderToggle();

    expect(screen.getByRole("group", { name: "Countries" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("GB")).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  test("a failed manifest still names the focused country, with no false choices", async () => {
    server.use(http.get(COUNTRIES_URL, () => HttpResponse.json({ detail: "no" }, { status: 403 })));
    renderToggle();

    await waitFor(() => expect(screen.getByText("GB")).toBeInTheDocument());
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  // One option is not a choice, and a lone highlighted button reads as a toggle that has lost
  // its other half.
  test("a single-country manifest renders a label, not a one-sided toggle", async () => {
    server.use(
      http.get(COUNTRIES_URL, () => HttpResponse.json([(countriesFixture as unknown[])[0]]))
    );
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB"] };
    renderToggle();

    await waitFor(() => expect(screen.getByText("GB")).toBeInTheDocument());
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});

// The disc is what stops this reading as a segmented control: a segmented control has nothing
// to say about the options you did not pick, so a lamp that holds its place while dark is the
// structural difference, not a decoration on top of one.
describe("the status disc", () => {
  const renderPair = async () => {
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB", "NL"] };
    renderToggle();
    await waitFor(() => expect(screen.getByRole("button", { name: "NL" })).toBeInTheDocument());
  };

  test("every country carries a disc, on or off", async () => {
    await renderPair();

    // GB is enabled, NL is not — and both have one.
    expect(discFor("GB")).not.toBeNull();
    expect(discFor("NL")).not.toBeNull();
  });

  // Lit fills with full-strength yellow against a segment holding the same yellow at 70%, with
  // a black outline keeping the two strengths apart. Dark is a hollow ring in the same place —
  // one lamp changing state, not an ornament appearing and vanishing.
  test("the disc is filled when lit and a hollow ring when off", async () => {
    await renderPair();

    expect(discFor("GB")?.className).toContain("bg-ocf-yellow");
    expect(discFor("GB")?.className).toContain("border-black");
    expect(discFor("NL")?.className).toContain("border-ocf-gray-900");
    expect(discFor("NL")?.className).not.toContain("bg-");
  });

  test("the segments sit inside one bonded pill rather than floating free", async () => {
    await renderPair();

    const pill = document.querySelector('[data-test="country-pill"]');
    expect(pill).not.toBeNull();
    expect(pill?.contains(screen.getByRole("button", { name: "GB" }))).toBe(true);
    expect(pill?.contains(screen.getByRole("button", { name: "NL" }))).toBe(true);
  });
});

// Nothing produces a non-ok status yet — `useCountryStatus` is a stub. These pin the rendering
// so that when a country-aware endpoint lands there is no dormant UI to wake up.
describe("a country with something wrong (driven by mocking the status hook)", () => {
  const LATE = { level: "error", message: "Forecast is 3 hours late" };

  test("a lit country's disc takes the status colour", async () => {
    mockStatuses = { GB: LATE };
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB", "NL"] };
    renderToggle();
    await waitFor(() => expect(screen.getByRole("button", { name: "NL" })).toBeInTheDocument());

    expect(discFor("GB")?.className).toContain("bg-red-500");
  });

  test("an off country shows no status colour, however bad the status", async () => {
    // NL is not drawn, so its pipeline health is not a fact about anything on screen.
    mockStatuses = { NL: LATE };
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB", "NL"] };
    renderToggle();
    await waitFor(() => expect(screen.getByRole("button", { name: "NL" })).toBeInTheDocument());

    expect(discFor("NL")?.className).not.toContain("bg-red-500");
    expect(statusFor("NL")).toBeNull();
  });

  test("an ok country offers no status affordance at all", async () => {
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB", "NL"] };
    renderToggle();
    await waitFor(() => expect(screen.getByRole("button", { name: "NL" })).toBeInTheDocument());

    // No tooltip to hover, and nothing describing the button — hovering is never a dead end.
    expect(statusFor("GB")).toBeNull();
    expect(screen.getByRole("button", { name: "GB" })).not.toHaveAttribute("aria-describedby");
    expect(screen.getByRole("button", { name: "GB" }).className).not.toContain("cursor-help");
  });

  test("a non-ok country gets a hover affordance and reaches assistive tech in words", async () => {
    mockStatuses = { GB: LATE };
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB", "NL"] };
    renderToggle();
    await waitFor(() => expect(screen.getByRole("button", { name: "NL" })).toBeInTheDocument());

    const gb = screen.getByRole("button", { name: "GB" });
    expect(gb.className).toContain("cursor-help");

    // The message is a *description*, not part of the name: the reader still says "GB".
    const tooltip = statusFor("GB");
    expect(tooltip).not.toBeNull();
    expect(tooltip?.textContent).toBe(LATE.message);
    expect(gb).toHaveAttribute("aria-describedby", tooltip?.id);
    expect(gb.textContent).toBe("GB");
  });

  test("an unentitled country reports no status, because it is not drawn either", async () => {
    mockStatuses = { NL: LATE };
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB"] };
    renderToggle();
    await waitFor(() => expect(screen.getByRole("button", { name: "NL" })).toBeInTheDocument());

    expect(statusFor("NL")).toBeNull();
    expect(discFor("NL")?.className).not.toContain("bg-red-500");
  });
});
