/**
 * The range's left edge has to be the chart's left edge, for as long as the tab stays open.
 *
 * The chart's forecast asks for `defaultSeriesStart()` on every render, a value that moves at each
 * 6-hour UTC boundary. The range used to take it once at mount, so a tab left open past a
 * boundary kept the old start: the arrow keys (limited by this range) could then step to an
 * instant before the chart's first point, and the chart's range guard sent the cursor to now.
 */
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import React from "react";
import { act, render } from "@testing-library/react";

const mockRequestedStarts: string[] = [];

jest.mock("../../hooks/data", () => {
  const actual = jest.requireActual("../../hooks/data") as Record<string, unknown>;
  return {
    ...actual,
    useFocusedCountry: () => "GB",
    // Answers with a series starting at whatever start was asked for, as the API does.
    useNationalForecast: (_scope: unknown, window: { start?: string }) => {
      const start = window.start as string;
      mockRequestedStarts.push(start);
      return {
        data: {
          values: [
            { timeUtc: start, value: 0 },
            { timeUtc: "2026-10-04T12:00:00.000Z", value: 0 }
          ]
        }
      };
    }
  };
});

import { setGlobalState } from "../helpers/globalState";
import { defaultSeriesStart } from "../../lib/api/v1/series-window";
import useTimeNow from "../hooks/use-time-now";
import { useCursorRange } from "./use-cursor-range";

let rangeStart: string | undefined;
const Harness = () => {
  useTimeNow();
  rangeStart = useCursorRange()?.range.start;
  return null;
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-10-02T11:50:00Z"));
  setGlobalState("timeNow", "2026-10-02T11:30:00.000Z");
  mockRequestedStarts.length = 0;
  rangeStart = undefined;
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

test("the range's start follows the chart's window across a 6-hour boundary", () => {
  render(<Harness />);
  expect(rangeStart).toBe("2026-09-30T06:00:00.000Z");

  // Past 12:00Z: the chart now asks for a window starting at 12:00Z two days back.
  act(() => {
    jest.advanceTimersByTime(15 * 60_000);
  });
  expect(defaultSeriesStart()).toBe("2026-09-30T12:00:00.000Z");
  expect(rangeStart).toBe(defaultSeriesStart());
});
