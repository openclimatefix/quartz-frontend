/**
 * The header country control — which country the chart is focused on.
 *
 * Since Phase 6, and since focus took over this control from the enabled set, this is a
 * plain radio group and nothing more: the *enabled* set (which countries draw on the map)
 * is scaffolded to "every entitled, configured country" by `useSyncEnabledCountries` until a
 * sidebar control owns it for real, and this control's whole job is naming the one country
 * the chart, the headline figures and the level selector follow.
 *
 * Two older properties still matter. First, an unentitled country must be *shown and
 * unclickable* — `/countries` returns every country the API serves so a prospect can see
 * what exists, and hiding them would defeat that. Second, the states where there is no real
 * choice (manifest loading, manifest failed, one country) must not render a half-drawn
 * control: the app still works in all of them, because focus comes from the cookie rather
 * than the manifest.
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
import { getGlobalState, setGlobalState } from "../../helpers/globalState";
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

const options = () => screen.getAllByRole("radio").map((b) => b.textContent);

describe("with the manifest loaded", () => {
  test("renders one option per manifest country", async () => {
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB", "NL"] };
    renderToggle();
    await waitFor(() => expect(screen.getByRole("radio", { name: "NL" })).toBeInTheDocument());

    expect(options()).toEqual(["GB", "NL"]);
  });

  test("the focused country is checked, and nothing else is", async () => {
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB", "NL"] };
    renderToggle();
    await waitFor(() => expect(screen.getByRole("radio", { name: "NL" })).toBeInTheDocument());

    expect(screen.getByRole("radio", { name: "GB" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "NL" })).toHaveAttribute("aria-checked", "false");
  });

  test("clicking a country focuses it and persists the choice", async () => {
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB", "NL"] };
    renderToggle();
    await waitFor(() => expect(screen.getByRole("radio", { name: "NL" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("radio", { name: "NL" }));

    expect(getGlobalState("focusedCountry")).toBe("NL");
    expect(Cookies.get(CookieStorageKeys.COUNTRY)).toBe(JSON.stringify("NL"));

    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "NL" })).toHaveAttribute("aria-checked", "true")
    );
  });

  test("the roving tabindex sits on the focused country", async () => {
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB", "NL"] };
    renderToggle();
    await waitFor(() => expect(screen.getByRole("radio", { name: "NL" })).toBeInTheDocument());

    expect(screen.getByRole("radio", { name: "GB" })).toHaveAttribute("tabIndex", "0");
    expect(screen.getByRole("radio", { name: "NL" })).toHaveAttribute("tabIndex", "-1");
  });

  test("ArrowRight moves focus to the next country and wraps", async () => {
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB", "NL"] };
    renderToggle();
    await waitFor(() => expect(screen.getByRole("radio", { name: "NL" })).toBeInTheDocument());

    fireEvent.keyDown(screen.getByRole("radiogroup", { name: "Focused country" }), {
      key: "ArrowRight"
    });
    expect(getGlobalState("focusedCountry")).toBe("NL");

    fireEvent.keyDown(screen.getByRole("radiogroup", { name: "Focused country" }), {
      key: "ArrowRight"
    });
    expect(getGlobalState("focusedCountry")).toBe("GB");
  });

  test("ArrowLeft moves focus to the previous country and wraps", async () => {
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB", "NL"] };
    renderToggle();
    await waitFor(() => expect(screen.getByRole("radio", { name: "NL" })).toBeInTheDocument());

    fireEvent.keyDown(screen.getByRole("radiogroup", { name: "Focused country" }), {
      key: "ArrowLeft"
    });
    expect(getGlobalState("focusedCountry")).toBe("NL");
  });

  test("arrow keys skip an unselectable country rather than landing on it", async () => {
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB"] };
    renderToggle();
    await waitFor(() => expect(screen.getByRole("radio", { name: "NL" })).toBeInTheDocument());

    // Only GB is selectable, so ArrowRight has nowhere to go and focus stays put.
    fireEvent.keyDown(screen.getByRole("radiogroup", { name: "Focused country" }), {
      key: "ArrowRight"
    });
    expect(getGlobalState("focusedCountry")).toBe("GB");
  });

  // Shown-but-disabled is the deliberate design: a prospect should be able to see that NL
  // exists before their subscription completes.
  test("an unentitled country is listed but disabled and unselectable", async () => {
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB"] };
    renderToggle();
    await waitFor(() => expect(screen.getByRole("radio", { name: "NL" })).toBeInTheDocument());

    const nl = screen.getByRole("radio", { name: "NL" });
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
    await waitFor(() => expect(screen.getByRole("radio", { name: "NL" })).toBeInTheDocument());

    expect(options()).toEqual(["GB", "NL"]);
    for (const code of ["GB", "NL"]) {
      expect(screen.getByRole("radio", { name: code })).toBeDisabled();
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
    await waitFor(() => expect(screen.getByRole("radio", { name: "DE" })).toBeInTheDocument());

    expect(screen.getByRole("radio", { name: "DE" })).toBeDisabled();
  });
});

describe("states with no real choice", () => {
  test("while the manifest loads, it names the focused country rather than nothing", async () => {
    server.use(http.get(COUNTRIES_URL, () => new Promise(() => {})));
    renderToggle();

    expect(screen.getByRole("group", { name: "Countries" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("GB")).toBeInTheDocument();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  test("a failed manifest still names the focused country, with no false choices", async () => {
    server.use(http.get(COUNTRIES_URL, () => HttpResponse.json({ detail: "no" }, { status: 403 })));
    renderToggle();

    await waitFor(() => expect(screen.getByText("GB")).toBeInTheDocument());
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  // One option is not a choice, and a lone checked radio reads as a group that has lost its
  // other members.
  test("a single-country manifest renders a label, not a one-sided radio group", async () => {
    server.use(
      http.get(COUNTRIES_URL, () => HttpResponse.json([(countriesFixture as unknown[])[0]]))
    );
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB"] };
    renderToggle();

    await waitFor(() => expect(screen.getByText("GB")).toBeInTheDocument());
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });
});

// The disc is a status mark now, not a lamp. It used to sit on every segment and carry two
// things at once — "this country is on the map" and "its pipeline is healthy" — and the first
// is not a question the control asks any more. So: a dot means something is wrong.
describe("the status disc", () => {
  const renderPair = async () => {
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB", "NL"] };
    renderToggle();
    await waitFor(() => expect(screen.getByRole("radio", { name: "NL" })).toBeInTheDocument());
  };

  test("a healthy country carries no disc at all, focused or not", async () => {
    await renderPair();

    expect(discFor("GB")).toBeNull();
    expect(discFor("NL")).toBeNull();
  });

  test("an unselectable country carries no disc, because it is not drawn", async () => {
    mockStatuses = { NL: { level: "error", message: "Forecast is 3 hours late" } };
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB"] };
    renderToggle();
    await waitFor(() => expect(screen.getByRole("radio", { name: "NL" })).toBeInTheDocument());

    expect(discFor("NL")).toBeNull();
  });

  test("the segments sit inside one bonded pill rather than floating free", async () => {
    await renderPair();

    const pill = document.querySelector('[data-test="country-pill"]');
    expect(pill).not.toBeNull();
    expect(pill?.contains(screen.getByRole("radio", { name: "GB" }))).toBe(true);
    expect(pill?.contains(screen.getByRole("radio", { name: "NL" }))).toBe(true);
  });
});

// Nothing produces a non-ok status yet — `useCountryStatus` is a stub. These pin the rendering
// so that when a country-aware endpoint lands there is no dormant UI to wake up.
describe("a country with something wrong (driven by mocking the status hook)", () => {
  const LATE = { level: "error", message: "Forecast is 3 hours late" };

  test("a focused country's disc takes the status colour", async () => {
    mockStatuses = { GB: LATE };
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB", "NL"] };
    renderToggle();
    await waitFor(() => expect(screen.getByRole("radio", { name: "NL" })).toBeInTheDocument());

    expect(discFor("GB")?.className).toContain("bg-status-alert");
  });

  test("an unfocused but selectable country still takes the status colour", async () => {
    // NL is drawn on the map even though GB is focused, so its pipeline health is a fact
    // about something on screen.
    mockStatuses = { NL: LATE };
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB", "NL"] };
    renderToggle();
    await waitFor(() => expect(screen.getByRole("radio", { name: "NL" })).toBeInTheDocument());

    expect(discFor("NL")?.className).toContain("bg-status-alert");
    expect(statusFor("NL")).not.toBeNull();
  });

  test("an ok country offers no status affordance at all", async () => {
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB", "NL"] };
    renderToggle();
    await waitFor(() => expect(screen.getByRole("radio", { name: "NL" })).toBeInTheDocument());

    // No tooltip to hover, and nothing describing the button — hovering is never a dead end.
    expect(statusFor("GB")).toBeNull();
    expect(screen.getByRole("radio", { name: "GB" })).not.toHaveAttribute("aria-describedby");
    expect(screen.getByRole("radio", { name: "GB" }).className).not.toContain("cursor-help");
  });

  test("a non-ok country gets a hover affordance and reaches assistive tech in words", async () => {
    mockStatuses = { GB: LATE };
    mockUser = { [COUNTRY_CLAIM_KEY]: ["GB", "NL"] };
    renderToggle();
    await waitFor(() => expect(screen.getByRole("radio", { name: "NL" })).toBeInTheDocument());

    const gb = screen.getByRole("radio", { name: "GB" });
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
    await waitFor(() => expect(screen.getByRole("radio", { name: "NL" })).toBeInTheDocument());

    expect(statusFor("NL")).toBeNull();
    expect(discFor("NL")).toBeNull();
  });
});
