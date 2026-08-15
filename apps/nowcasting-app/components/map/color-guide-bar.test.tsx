/**
 * The legend explains the map, and it can only do that if it is reading the same numbers the
 * map is painted with.
 *
 * It used to hold four hardcoded lists of MW bands, branching on `currentLevel.regionType ===
 * "gsp"` — GB's region type, by name. Two consequences, both of which this file pins:
 *
 *  - NL's `province` level matched neither branch, so the legend drew **no bands at all**
 *    while the map cheerfully painted NL's polygons on GB's scale.
 *  - The lists were a hand-kept copy of `feature-state.ts`'s thresholds, so the map could be
 *    drawn one way and explained another and only a careful eye would catch it.
 *
 * `map-value-join.test.ts` pins the other half — that `bandLabels`'s numbers are the ones the
 * paint expression steps at, for every country and tier. This file pins that the component
 * actually renders those labels, for the focused country.
 */
import { describe, expect, jest, test } from "@jest/globals";
import React from "react";
import { render, screen } from "@testing-library/react";

import ColorGuideBar from "./color-guide-bar";
import { ActiveUnit } from "./types";

let focused = "GB";
let enabled: string[] = ["GB"];
jest.mock("../../hooks/data/use-countries", () => ({
  __esModule: true,
  useEnabledCountries: () => enabled,
  useFocusedCountry: () => focused
}));

let currentLevel: unknown = {
  regionType: "gsp",
  level: 10,
  label: "GSP",
  minZoom: 0,
  maxZoom: 14,
  derived: false
};
jest.mock("../../hooks/data", () => ({
  __esModule: true,
  useCurrentAggregationLevel: () => currentLevel
}));

const level = (regionType: string, derived = false) => ({
  regionType,
  level: derived ? 5 : 10,
  label: regionType,
  minZoom: 0,
  maxZoom: 14,
  derived
});

const bandsShown = (unit: ActiveUnit): string[] => {
  const { container, unmount } = render(<ColorGuideBar comparison={null} unit={unit} />);
  // The pills, in order. The first one carries the unit suffix in a nested span, so its text
  // reads "0-50MW" without a space.
  const text = Array.from(container.querySelectorAll("div.rounded")).map(
    (node) => node.textContent ?? ""
  );
  unmount();
  return text;
};

describe("the legend's bands are the focused country's", () => {
  test("GB at GSP level draws the bands it always drew", () => {
    focused = "GB";
    enabled = ["GB"];
    currentLevel = level("gsp");
    const bands = bandsShown(ActiveUnit.MW);
    // "no data" is no longer among the pills — the legend carries the value scale only, and the
    // other two states are named on hover. See the absence test below.
    expect(bands).toEqual(["0-50MW", "50-150", "150-250", "250-350", "350-450", "450+"]);
  });

  test("GB on a derived level draws the ten-times bands", () => {
    focused = "GB";
    enabled = ["GB"];
    currentLevel = level("dno", true);
    expect(bandsShown(ActiveUnit.MW)).toContain("4.5k+");
  });

  test("NL at province level draws NL's bands, where it used to draw none", () => {
    focused = "NL";
    enabled = ["NL"];
    currentLevel = level("province");
    const bands = bandsShown(ActiveUnit.MW);
    expect(bands).toEqual(["0-400MW", "400-1.2k", "1.2k-2k", "2k-2.8k", "2.8k-3.6k", "3.6k+"]);
  });

  test("capacity mode reads the same scale as MW", () => {
    focused = "NL";
    enabled = ["NL"];
    currentLevel = level("province");
    expect(bandsShown(ActiveUnit.capacity)).toEqual(bandsShown(ActiveUnit.MW));
  });

  /**
   * Percentage stopped being banded on 2026-08-15 — it renders as a ramp with the reference
   * values ticked along it, so there are no pills to compare. What still has to hold is that it
   * is identical in every country and at every level (it is a fraction of the region's own
   * capacity, so it never needed calibrating).
   */
  describe("percentage mode renders a ramp, not bands", () => {
    const rampTicks = (): string[] => {
      const { container, unmount } = render(
        <ColorGuideBar comparison={null} unit={ActiveUnit.percentage} />
      );
      const ticks = Array.from(container.querySelectorAll("span.absolute"))
        .map((node) => node.textContent ?? "")
        .filter((text) => text.length > 0);
      unmount();
      return ticks;
    };

    test("the ticks are the reference values, and the top one is open-ended", () => {
      focused = "GB";
      enabled = ["GB"];
      currentLevel = level("gsp");
      expect(rampTicks()).toEqual(["3", "10", "20", "30", "40", "50", "70%+"]);
    });

    test("it is the same everywhere — it never needed calibrating", () => {
      focused = "NL";
      enabled = ["NL"];
      currentLevel = level("province");
      const nl = rampTicks();
      focused = "GB";
      enabled = ["GB"];
      currentLevel = level("gsp");
      expect(rampTicks()).toEqual(nl);
    });

    test("no pills are drawn at all", () => {
      focused = "GB";
      enabled = ["GB"];
      currentLevel = level("gsp");
      // `bandsShown` selects `div.rounded`, which now also matches the ramp bar itself — it is
      // rounded too, and carries no text. Dropping the empty entry leaves what this asserts:
      // percentage contributes no labelled pill of its own.
      expect(bandsShown(ActiveUnit.percentage).filter(Boolean)).toEqual([]);
    });
  });

  /**
   * The legend explains the value scale and nothing else (2026-08-15).
   *
   * "No data" was a seventh pill, then briefly a key line, and is now absent: the map's popup
   * already reads "no data" or "awaiting" in place of the figure, per region and per instant,
   * which is more use than a swatch. Across two full days of real data no region reported
   * nothing even once, so a permanent entry was billing an anomaly as everyday furniture.
   *
   * Pinned as an absence because it has moved twice — this stops it drifting back into the
   * scale, where a non-quantity reads as a step on it.
   */
  test.each([
    ["percentage", ActiveUnit.percentage],
    ["MW", ActiveUnit.MW],
    ["capacity", ActiveUnit.capacity]
  ])("%s mode's legend carries the scale only, no 'no data' entry", (_label, unit) => {
    focused = "GB";
    enabled = ["GB"];
    currentLevel = level("gsp");
    const { container, unmount } = render(<ColorGuideBar comparison={null} unit={unit} />);
    expect(container.textContent).not.toContain("no data");
    unmount();
  });

  test("national level has no band scale and shows none, as before", () => {
    focused = "GB";
    enabled = ["GB"];
    currentLevel = { ...level("national"), level: 0 };
    expect(bandsShown(ActiveUnit.MW)).toEqual([]);
  });

  test("with several countries enabled the row says whose bands these are", () => {
    focused = "NL";
    enabled = ["GB", "NL"];
    currentLevel = level("province");
    render(<ColorGuideBar comparison={null} unit={ActiveUnit.MW} />);
    // The attribution matters more now than when Track F added it: with per-country bands,
    // "NL bands" means numbers GB's polygons on the same map are genuinely not drawn on.
    expect(screen.getByText("NL bands")).toBeTruthy();
  });
});
