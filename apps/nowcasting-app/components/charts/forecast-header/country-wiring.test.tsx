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

/**
 * Every time the header renders, in DOM order.
 *
 * Four, not two, since each figure states the *period* its reading covers rather than the
 * instant the country names it by — start then end, stacked under the clock (`ui.tsx`). The
 * pairs are the latest actual's period, then the next forecast's.
 */
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
    // GB labels the END of its half hour, so the 11:00 point covers 10:30–11:00.
    expect(renderedTimes()).toEqual(["10:30", "11:00", "11:00", "11:30"]);
  });

  test("switching to NL re-renders the same instants in Europe/Amsterdam", () => {
    renderHeader();
    expect(renderedTimes()).toEqual(["10:30", "11:00", "11:00", "11:30"]);

    act(() => setFocusedCountry("NL"));

    // The first value is the assertion this test exists for: the same UTC instant, one hour
    // later on the wall clock, which separates real wiring from a threaded-but-unused
    // argument.
    //
    // The second moved from 12:30 to 12:15 in Phase 6 Track B, and deliberately: "the next
    // forecast" is one step on the *country's* grid, and NL publishes every 15 minutes where
    // GB publishes every 30. It used to be a hardcoded half hour for everyone.
    //
    // The pairs also flip which side of the label they sit on: NL labels the START of its
    // quarter, so its 12:00 point covers 12:00–12:15 where GB's 11:00 covered 10:30–11:00.
    // That is `periodForLabel` doing its job, and it is the difference this whole area exists
    // to keep visible (`lib/time/cursor.ts`).
    expect(renderedTimes()).toEqual(["12:00", "12:15", "12:15", "12:30"]);
  });

  test("switching back restores the GB rendering", () => {
    renderHeader();
    act(() => setFocusedCountry("NL"));
    act(() => setFocusedCountry("GB"));
    expect(renderedTimes()).toEqual(["10:30", "11:00", "11:00", "11:30"]);
  });
});
