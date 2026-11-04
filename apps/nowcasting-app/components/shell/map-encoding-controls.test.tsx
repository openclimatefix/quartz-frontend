/**
 * The two-step "Map shows" control: Forecast | Delta | Capacity, then that mode's units.
 */
import { describe, expect, test, beforeEach, jest } from "@jest/globals";
import React from "react";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";

import MapEncodingControls from "./map-encoding-controls";
import { ActiveUnit } from "../map/types";
import { setComparison, setGlobalState, getGlobalState } from "../helpers/globalState";
import { COMPARISON_PRESETS } from "../helpers/comparison";

jest.mock("../map/color-guide-bar", () => ({ __esModule: true, default: () => null }));
jest.mock("../map/map-layer-controls", () => ({
  __esModule: true,
  default: () => null,
  SatelliteChannelSelect: () => null
}));
jest.mock("../map/measuringUnit", () => ({
  ...(jest.requireActual("../map/measuringUnit") as object),
  AggregationLevelToggle: () => null
}));

const modes = () => within(screen.getByRole("group", { name: "Map shows" }));
const unitLabels = () =>
  screen
    .getAllByRole("button")
    .filter((button) => button.id.startsWith("UnitButton"))
    .map((button) => button.textContent);

describe("MapEncodingControls", () => {
  beforeEach(() => {
    cleanup();
    setComparison(null);
    setGlobalState("activeUnit", ActiveUnit.percentage);
  });

  test("forecast offers % and MW", () => {
    render(<MapEncodingControls />);
    expect(modes().getByRole("button", { name: "Forecast" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(unitLabels()).toEqual(["%", "MW"]);
  });

  test("Capacity switches to MW and offers MW and MW/km²", () => {
    render(<MapEncodingControls />);
    fireEvent.click(modes().getByRole("button", { name: "Capacity" }));
    expect(getGlobalState("activeUnit")).toBe(ActiveUnit.capacity);
    expect(modes().getByRole("button", { name: "Capacity" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(unitLabels()).toEqual(["MW", "MW/km²"]);

    fireEvent.click(screen.getByRole("button", { name: "MW/km²" }));
    expect(getGlobalState("activeUnit")).toBe(ActiveUnit.capacityDensity);
  });

  test("leaving Capacity for Forecast goes back to %", () => {
    setGlobalState("activeUnit", ActiveUnit.capacityDensity);
    render(<MapEncodingControls />);
    fireEvent.click(modes().getByRole("button", { name: "Forecast" }));
    expect(getGlobalState("activeUnit")).toBe(ActiveUnit.percentage);
    expect(unitLabels()).toEqual(["%", "MW"]);
  });

  test("a delta from Capacity goes back to %", () => {
    setGlobalState("activeUnit", ActiveUnit.capacity);
    render(<MapEncodingControls />);
    fireEvent.click(modes().getByRole("button", { name: COMPARISON_PRESETS[0].label }));
    expect(getGlobalState("comparison")).toBe(COMPARISON_PRESETS[0].id);
    expect(getGlobalState("activeUnit")).toBe(ActiveUnit.percentage);
    expect(unitLabels()).toEqual(["%", "MW"]);
  });
});
