/**
 * Entering the Delta view leaves the cursor where the user put it. Opening Delta with the cursor
 * ahead of the latest actuals used to move it back to the last period with a delta; that was
 * rejected (the cursor is never moved automatically), and the "No actuals yet" empty state
 * covers the situation instead.
 *
 * Everything around the component is stubbed: what is under test is whether rendering it writes
 * `selectedISOTime`, and the rows `useFormatChartData` returns are the only input that decides it.
 */
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import React from "react";
import { render, screen } from "@testing-library/react";

const rows = [
  { formattedDate: "2026-09-29T10:00", FORECAST: 9000, GENERATION: 9100, DELTA: 100 },
  { formattedDate: "2026-09-29T10:30", FORECAST: 9200, GENERATION: 9150, DELTA: -50 },
  { formattedDate: "2026-09-29T11:00", FORECAST: 9300 },
  { formattedDate: "2026-09-29T11:30", FORECAST: 9400 }
];

jest.mock("../../../hooks/data", () => ({
  __esModule: true,
  NATIONAL_REGION_TYPE: "national",
  useFocusedCountry: () => "GB",
  useGenerationSources: () => ({ data: [{ name: "pvlive_in_day", label: "PV Live" }] }),
  useLoadingState: () => ({}),
  useNationalForecast: () => ({ data: { values: [] } }),
  useNationalGeneration: () => ({ data: { values: [] } })
}));
jest.mock("../use-format-chart-data", () => ({ __esModule: true, default: () => rows }));
jest.mock("./use-gsp-deltas", () => ({
  __esModule: true,
  default: () => ({ gspDeltas: undefined, scope: null, window: undefined })
}));
jest.mock("../../hooks/use-and-update-selected-time", () => ({
  __esModule: true,
  useStopAndResetTime: () => ({ stopTime: () => {}, resetTime: () => {} })
}));
jest.mock("../pv-remix-chart", () => ({
  __esModule: true,
  GENERATION_CHART_KEYS: ["GENERATION", "GENERATION_UPDATED"]
}));
jest.mock("../remix-line", () => ({
  __esModule: true,
  default: () => null,
  plotInsetRightPx: () => 0
}));
jest.mock("../forecast-header", () => ({ __esModule: true, default: () => null }));
jest.mock("../gsp-pv-remix-chart", () => ({ __esModule: true, default: () => null }));
jest.mock("../../shell/chart-scrubber", () => ({ __esModule: true, default: () => null }));
jest.mock("../chart-legend", () => ({ __esModule: true, default: () => null }));
jest.mock("../DataLoadingChartStatus", () => ({ __esModule: true, default: () => null }));
jest.mock("./delta-buckets-ui", () => ({ __esModule: true, default: () => null }));
jest.mock("../../delta-forecast-label", () => ({ __esModule: true, default: () => null }));

import { getGlobalState, setGlobalState } from "../../helpers/globalState";
import { periodForLabel } from "../../../lib/time/cursor";
import DeltaChart from "./delta-view-chart";

describe("DeltaChart on entry", () => {
  beforeEach(() => {
    setGlobalState("timeNow", periodForLabel("2026-09-29T11:30:00.000Z", "GB").start);
    setGlobalState("selectedMapRegionIds" as never, [] as never);
  });

  test("leaves a cursor ahead of the actuals where it is", () => {
    // The period labelled 11:00: in range, with a forecast and no delta yet.
    const cursor = periodForLabel("2026-09-29T11:00:00.000Z", "GB").start;
    setGlobalState("selectedISOTime", cursor);

    render(<DeltaChart />);

    expect(getGlobalState("selectedISOTime")).toBe(cursor);
    // The existing empty state is what the user sees there.
    expect(screen.getByText(/No actuals yet for this time/)).toBeTruthy();
  });
});
