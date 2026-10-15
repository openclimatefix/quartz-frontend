/**
 * C6: the national header prints a placeholder for a value that was never published, and
 * derives no delta from one. A published 0 (overnight) is still 0.0.
 */
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import React from "react";
import { act, render } from "@testing-library/react";

jest.mock("next/router", () => ({ __esModule: true, default: { push: jest.fn() } }));
jest.mock("@sentry/nextjs", () => ({ __esModule: true, captureException: jest.fn() }));
jest.mock("@auth0/nextjs-auth0/client", () => ({
  __esModule: true,
  useUser: () => ({ user: null, isLoading: false, error: undefined })
}));

import { DEFAULT_COUNTRY_CODE } from "../../helpers/countryState";
import { setFocusedCountry, setGlobalState } from "../../helpers/globalState";
import type { TimeSeries } from "../../../lib/domain/types";
import ForecastHeader from "./index";

const series = (points: [string, number | null][]): TimeSeries => ({
  regionName: "national",
  capacityMw: null,
  values: points.map(([hhmm, powerMw]) => ({ timeUtc: `2025-07-01T${hhmm}:00+00:00`, powerMw }))
});

/** The three figures in DOM order: actual, forecast at the actual, next forecast. */
const figures = () => {
  const actual = document.querySelector("span.text-solar-light");
  const pair = actual?.parentElement?.textContent ?? "";
  const next = document.querySelectorAll('[data-test="pvlive-ocf-headline-figure"]')[1];
  return { pair, next: next?.textContent ?? "" };
};
const delta = () =>
  document.querySelector('[data-test="delta-header-figure"] > div')?.textContent ?? "";

beforeEach(() => {
  setGlobalState("focusedCountry", DEFAULT_COUNTRY_CODE);
});
afterEach(() => {
  act(() => setFocusedCountry(DEFAULT_COUNTRY_CODE));
});

describe("C6: missing is not zero", () => {
  test("no actual in the window: the actual and the delta are placeholders", () => {
    render(
      <ForecastHeader
        generationSeries={series([
          ["10:00", null],
          ["10:30", null]
        ])}
        forecastSeries={series([
          ["10:00", 6200],
          ["10:30", 6300]
        ])}
        deltaView
      />
    );
    expect(figures().pair).not.toContain("0.0 / ");
    expect(figures().pair).toMatch(/^– \/ /);
    expect(delta()).toBe("–");
  });

  test("no forecast at the latest actual's slot: the forecast and the delta are placeholders", () => {
    render(
      <ForecastHeader
        generationSeries={series([["10:00", 5000]])}
        forecastSeries={series([
          ["10:00", null],
          ["10:30", 6300]
        ])}
        deltaView
      />
    );
    expect(figures().pair).toMatch(/^5\.0 \/ –/);
    expect(delta()).toBe("–");
  });

  test("a published 0 overnight still prints as 0.0 with a 0.0 delta", () => {
    render(
      <ForecastHeader
        generationSeries={series([["10:00", 0]])}
        forecastSeries={series([
          ["10:00", 0],
          ["10:30", 0]
        ])}
        deltaView
      />
    );
    expect(figures().pair).toMatch(/^0\.0 \/ 0\.0/);
    expect(figures().next).toMatch(/^0\.0/);
    expect(delta()).toBe("0.0");
  });
});
