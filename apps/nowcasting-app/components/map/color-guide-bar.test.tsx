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
    expect(bands).toEqual(["0-50MW", "50-150", "150-250", "250-350", "350-450", "450+", "no data"]);
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
    expect(bands).toEqual([
      "0-400MW",
      "400-1.2k",
      "1.2k-2k",
      "2k-2.8k",
      "2.8k-3.6k",
      "3.6k+",
      "no data"
    ]);
  });

  test("capacity mode reads the same scale as MW", () => {
    focused = "NL";
    enabled = ["NL"];
    currentLevel = level("province");
    expect(bandsShown(ActiveUnit.capacity)).toEqual(bandsShown(ActiveUnit.MW));
  });

  test("percentage mode is the same everywhere — it never needed calibrating", () => {
    focused = "NL";
    enabled = ["NL"];
    currentLevel = level("province");
    const nl = bandsShown(ActiveUnit.percentage);
    focused = "GB";
    enabled = ["GB"];
    currentLevel = level("gsp");
    expect(bandsShown(ActiveUnit.percentage)).toEqual(nl);
    expect(nl).toEqual(["0-10%", "10-20", "20-35", "35-50", "50-70", "70+", "no data"]);
  });

  test("national level has no band scale and shows none, as before", () => {
    focused = "GB";
    enabled = ["GB"];
    currentLevel = { ...level("national"), level: 0 };
    expect(bandsShown(ActiveUnit.MW)).toEqual(["no data"]);
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
