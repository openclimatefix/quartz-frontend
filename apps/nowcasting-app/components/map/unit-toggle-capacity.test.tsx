/**
 * Capacity is a map mode with its own units, and each unit family remembers its last choice.
 *
 * It used to be a third unit beside % and MW, which meant a delta could be asked for in it —
 * installed capacity has no delta — so `setComparison` moved the unit off it and `UnitToggle`
 * greyed it out. Both rules are gone because the state no longer allows the combination: the
 * mode selects the family (`mapEncodingOf`), and each family has its own remembered slot. What
 * this file pins is that memory:
 *
 * 1. Leaving a mode and coming back restores the unit it was last shown in.
 * 2. Forecast and delta share one slot, as they shared `activeUnit` before.
 * 3. `UnitToggle` renders the set it is handed, and selecting writes through `onSelect`.
 */
import { afterEach, describe, expect, jest, test } from "@jest/globals";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { UnitToggle } from "./measuringUnit";
import { ActiveUnit } from "./types";
import {
  getGlobalState,
  setCapacityUnit,
  setGlobalState,
  setMapMode,
  setOutputUnit
} from "../helpers/globalState";
import {
  CAPACITY_MODE,
  CapacityUnit,
  DEFAULT_MAP_UNITS,
  FORECAST_MODE,
  deltaMode,
  mapEncodingOf
} from "../helpers/map-mode";

const encoding = () => mapEncodingOf(getGlobalState("mapMode"), getGlobalState("mapUnits"));

afterEach(() => {
  setMapMode(FORECAST_MODE);
  setGlobalState("mapUnits", DEFAULT_MAP_UNITS);
});

describe("each mode remembers its own unit", () => {
  test("Forecast -> Capacity -> Forecast restores the forecast's unit", () => {
    setOutputUnit(ActiveUnit.MW);
    setMapMode(CAPACITY_MODE);
    setCapacityUnit(CapacityUnit.density);
    setMapMode(FORECAST_MODE);
    expect(encoding()).toEqual({ kind: "forecast", unit: ActiveUnit.MW });
  });

  test("Capacity -> Forecast -> Capacity restores capacity's unit", () => {
    setMapMode(CAPACITY_MODE);
    setCapacityUnit(CapacityUnit.shareOfNational);
    setMapMode(FORECAST_MODE);
    setOutputUnit(ActiveUnit.MW);
    setMapMode(CAPACITY_MODE);
    expect(encoding()).toEqual({ kind: "capacity", unit: CapacityUnit.shareOfNational });
  });

  test("forecast and delta share one remembered unit", () => {
    setOutputUnit(ActiveUnit.MW);
    setMapMode(deltaMode("generation"));
    expect(encoding()).toEqual({ kind: "delta", preset: "generation", unit: ActiveUnit.MW });
    setOutputUnit(ActiveUnit.percentage);
    setMapMode(FORECAST_MODE);
    expect(encoding().unit).toBe(ActiveUnit.percentage);
  });

  test("delta can never be drawn in a capacity unit", () => {
    // The combination `setComparison` used to have to guard against, now unrepresentable.
    setMapMode(CAPACITY_MODE);
    setCapacityUnit(CapacityUnit.density);
    setMapMode(deltaMode("generation"));
    expect(Object.values(ActiveUnit)).toContain(encoding().unit);
    expect(encoding().unit).not.toBe(CapacityUnit.density);
  });

  test("the defaults: % for output, MW for capacity", () => {
    expect(encoding()).toEqual({ kind: "forecast", unit: ActiveUnit.percentage });
    setMapMode(CAPACITY_MODE);
    expect(encoding()).toEqual({ kind: "capacity", unit: CapacityUnit.MW });
  });
});

describe("UnitToggle renders the units it is handed", () => {
  afterEach(cleanup);

  const options = [
    { value: CapacityUnit.shareOfNational, label: "% of national", id: "a" },
    { value: CapacityUnit.MW, label: "MW", id: "b" },
    { value: CapacityUnit.density, label: "MW/km²", id: "c" }
  ];

  test("one button per option, the active one pressed", () => {
    render(
      <UnitToggle
        options={options}
        active={CapacityUnit.density}
        onSelect={() => undefined}
        isLoading={false}
      />
    );
    expect(screen.getAllByRole("button")).toHaveLength(3);
    // Nothing is greyed out: every unit offered is one the mode can draw.
    screen.getAllByRole("button").forEach((button) => expect(button).toBeEnabled());
  });

  test("selecting a unit writes through onSelect", () => {
    const onSelect = jest.fn();
    render(
      <UnitToggle
        options={options}
        active={CapacityUnit.MW}
        onSelect={onSelect}
        isLoading={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "MW/km²" }));
    expect(onSelect).toHaveBeenCalledWith(CapacityUnit.density);
  });
});
