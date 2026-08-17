/**
 * "Capacity" is not a unit a delta can be shown in — installed capacity has no delta.
 *
 * It used to fall through to megawatts, so the toggle read "Capacity" over a map painted in MW.
 * That is the same defect as the delta view ignoring `activeUnit` entirely: a control asserting
 * one unit while the map draws another. Two halves, tested here:
 *
 * 1. `setComparison` moves the active unit off Capacity — the invariant, at the chokepoint.
 * 2. `UnitToggle` greys the button out — the affordance, so the rule is visible rather than
 *    something the user discovers by having their selection silently changed.
 */
import { describe, expect, test, beforeEach } from "@jest/globals";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";

import { UnitToggle } from "./measuringUnit";
import { ActiveUnit } from "./types";
import { setComparison, setGlobalState, getGlobalState } from "../helpers/globalState";

describe("setComparison keeps the unit valid for the view", () => {
  beforeEach(() => {
    setComparison(null);
  });

  test("selecting a comparison moves Capacity to percentage", () => {
    setGlobalState("activeUnit", ActiveUnit.capacity);
    setComparison("generation");
    expect(getGlobalState("activeUnit")).toBe(ActiveUnit.percentage);
  });

  test("percentage rather than MW — the MW delta scale is 96% neutral for GB", () => {
    setGlobalState("activeUnit", ActiveUnit.capacity);
    setComparison("generation");
    expect(getGlobalState("activeUnit")).not.toBe(ActiveUnit.MW);
  });

  test("a unit the view CAN show is left alone", () => {
    setGlobalState("activeUnit", ActiveUnit.MW);
    setComparison("generation");
    expect(getGlobalState("activeUnit")).toBe(ActiveUnit.MW);
  });

  test("returning to the forecast view does not change the unit back", () => {
    // Deliberate: `activeUnit` is one shared setting, and restoring it would mean the unit can
    // also change under the user on the way back. Brad's call — not worth the extra state.
    setGlobalState("activeUnit", ActiveUnit.capacity);
    setComparison("generation");
    setComparison(null);
    expect(getGlobalState("activeUnit")).toBe(ActiveUnit.percentage);
  });
});

describe("UnitToggle greys out units the view cannot express", () => {
  const noop = () => undefined;
  beforeEach(cleanup);

  test("Capacity is disabled and says why when a comparison is selected", () => {
    render(
      <UnitToggle
        activeUnit={ActiveUnit.percentage}
        setActiveUnit={noop}
        isLoading={false}
        unavailableUnits={[ActiveUnit.capacity]}
        unavailableReason="Installed capacity has no delta"
      />
    );
    const capacity = screen.getByRole("button", { name: "Capacity" });
    expect(capacity).toBeDisabled();
    // A disabled control with no reason reads as broken rather than as deliberate.
    expect(capacity).toHaveAttribute("title", "Installed capacity has no delta");
  });

  test("the other units stay live", () => {
    render(
      <UnitToggle
        activeUnit={ActiveUnit.percentage}
        setActiveUnit={noop}
        isLoading={false}
        unavailableUnits={[ActiveUnit.capacity]}
      />
    );
    expect(screen.getByRole("button", { name: "%" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "MW" })).toBeEnabled();
  });

  test("nothing is disabled on the forecast view", () => {
    render(
      <UnitToggle activeUnit={ActiveUnit.percentage} setActiveUnit={noop} isLoading={false} />
    );
    expect(screen.getByRole("button", { name: "Capacity" })).toBeEnabled();
  });
});
