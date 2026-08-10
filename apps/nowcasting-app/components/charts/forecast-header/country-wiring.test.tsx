/**
 * The date/locale wiring, end to end through a real component.
 *
 * Phase 3 gave every date helper a `(…, timezone, locale)` tail and left the call sites on
 * the GB defaults. The risk in wiring them up is that the plumbing looks right and renders
 * the same string anyway — a helper still defaulting, a value threaded but unused. So this
 * asserts the one thing that cannot be true by accident: switching the current country to NL
 * moves a rendered timestamp by the London/Amsterdam offset.
 *
 * `ForecastHeader` is the cheapest component on the wired path that puts a formatted instant
 * on screen. The process timezone is pinned to UTC by `jest.globalSetup.ts`, so both expected
 * values are stated as explicit zone conversions rather than "whatever the machine does".
 */
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import React from "react";
import { act, render, screen } from "@testing-library/react";

jest.mock("next/router", () => ({ __esModule: true, default: { push: jest.fn() } }));
jest.mock("@sentry/nextjs", () => ({ __esModule: true, captureException: jest.fn() }));
jest.mock("@auth0/nextjs-auth0/client", () => ({
  __esModule: true,
  useUser: () => ({ user: null, isLoading: false, error: undefined })
}));

import Cookies from "js-cookie";
import { CookieStorageKeys } from "../../helpers/cookieStorage";
import { DEFAULT_COUNTRY_CODE } from "../../helpers/countryState";
import { setFocusedCountry, setGlobalState } from "../../helpers/globalState";
import { PvRealData, ForecastData } from "../../types";
import ForecastHeader from "./index";

// 10:00 UTC in July: 11:00 in Europe/London (BST), 12:00 in Europe/Amsterdam (CEST). A
// summer instant on purpose — the two zones agree on neither the offset nor the DST rule
// boundary, so a wired-but-ignored timezone cannot produce the NL answer by luck.
const LATEST_ACTUAL_UTC = "2025-07-01T10:00:00+00:00";

const pvLiveData: PvRealData = [
  { datetimeUtc: LATEST_ACTUAL_UTC, solarGenerationKw: 5_000_000 }
] as unknown as PvRealData;

const pvForecastData: ForecastData = [
  { targetTime: LATEST_ACTUAL_UTC, expectedPowerGenerationMegawatts: 6000 },
  { targetTime: "2025-07-01T10:30:00+00:00", expectedPowerGenerationMegawatts: 6500 }
] as unknown as ForecastData;

const renderHeader = () =>
  render(<ForecastHeader pvLiveData={pvLiveData} pvForecastData={pvForecastData} deltaView />);

/** Every time the header renders, in DOM order: the latest actual, then the next forecast. */
const renderedTimes = () => screen.getAllByText(/^\d{2}:\d{2}$/).map((el) => el.textContent);

beforeEach(() => {
  setGlobalState("focusedCountry", DEFAULT_COUNTRY_CODE);
});
afterEach(() => {
  act(() => setFocusedCountry(DEFAULT_COUNTRY_CODE));
  Cookies.remove(CookieStorageKeys.COUNTRY);
});

describe("the current country drives how instants are rendered", () => {
  test("GB renders Europe/London, unchanged from before the wiring", () => {
    renderHeader();
    expect(renderedTimes()).toEqual(["11:00", "11:30"]);
  });

  test("switching to NL re-renders the same instants in Europe/Amsterdam", () => {
    renderHeader();
    expect(renderedTimes()).toEqual(["11:00", "11:30"]);

    act(() => setFocusedCountry("NL"));

    // Same UTC instants, one hour later on the wall clock. This is the assertion that
    // separates real wiring from a threaded-but-unused argument.
    expect(renderedTimes()).toEqual(["12:00", "12:30"]);
  });

  test("switching back restores the GB rendering", () => {
    renderHeader();
    act(() => setFocusedCountry("NL"));
    act(() => setFocusedCountry("GB"));
    expect(renderedTimes()).toEqual(["11:00", "11:30"]);
  });
});
