/**
 * Comparison, and the map mode that replaced it as state.
 *
 * Phase 6 §2 replaced the dashboard's three-way view switch with comparison state: `null` was
 * the plain forecast, an id a preset. Capacity made that a three-way switch again, and `null`
 * could no longer mean "forecast" — so the state is `mapMode` now (`helpers/map-mode.ts`), and
 * the comparison survives only as the chart's question: what B side does it draw?
 *
 * What is pinned here is the seam: the chart's comparison is the delta preset or nothing, and
 * capacity is nothing to the chart while being its own thing to the map.
 */
import { afterEach, describe, expect, test } from "@jest/globals";

import { comparisonTitle } from "./comparison";
import { getGlobalState, setMapMode } from "./globalState";
import {
  CAPACITY_MODE,
  FORECAST_MODE,
  chartComparisonOf,
  deltaMode,
  mapEncodingOf,
  DEFAULT_MAP_UNITS
} from "./map-mode";

afterEach(() => setMapMode(FORECAST_MODE));

describe("setMapMode", () => {
  test("defaults to the forecast", () => {
    expect(getGlobalState("mapMode")).toEqual({ kind: "forecast" });
  });

  test("selecting a preset sets the delta mode", () => {
    setMapMode(deltaMode("generation"));
    expect(getGlobalState("mapMode")).toEqual({ kind: "delta", preset: "generation" });
  });

  test("clearing it returns to the plain forecast", () => {
    setMapMode(deltaMode("generation"));
    setMapMode(FORECAST_MODE);
    expect(getGlobalState("mapMode").kind).toBe("forecast");
  });

  test("the same mode again is not a new state", () => {
    setMapMode(deltaMode("generation"));
    const before = getGlobalState("mapMode");
    setMapMode(deltaMode("generation"));
    expect(getGlobalState("mapMode")).toBe(before);
  });
});

describe("the chart's comparison", () => {
  test("is the preset in delta mode", () => {
    expect(chartComparisonOf(deltaMode("generation"))).toBe("generation");
  });

  test("is none for both the forecast and capacity — capacity changes the map, not the chart", () => {
    expect(chartComparisonOf(FORECAST_MODE)).toBeNull();
    expect(chartComparisonOf(CAPACITY_MODE)).toBeNull();
  });

  test("capacity is still not the forecast to the map", () => {
    expect(mapEncodingOf(CAPACITY_MODE, DEFAULT_MAP_UNITS).kind).toBe("capacity");
  });
});

describe("the chart header's echo", () => {
  test("names the plain forecast, and echoes nothing for a preset with no title", () => {
    // The Delta preset's title was emptied on 2026-08-17 — with one preset the echo restated
    // what the "Map shows" control already said, and cost header space to do it. Empty is a
    // legal value meaning "no echo": `ComparisonEcho` renders null rather than a blank span,
    // which in a flex row would still hold its gap open.
    expect(comparisonTitle(null)).toBe("National forecast");
    expect(comparisonTitle("generation")).toBe("");
  });
});
