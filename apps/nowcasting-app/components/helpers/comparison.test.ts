/**
 * Comparison, and the `view` value it keeps in step.
 *
 * Phase 6 §2 replaced the dashboard's three-way view switch with comparison state: `null` is
 * the plain forecast, an id is a preset. `view` survives only because a dozen components still
 * read it — `remix-line`'s axis, `StatusBanner`, the CSV modal, both charts' reset effects —
 * and Wave 4 is what retires them. Until then the two must never disagree: a `view` of
 * `FORECAST` with a comparison active would draw the delta map under a chart that reset the
 * cursor whenever the delta series lagged, which is the kind of wrong that looks plausible.
 *
 * That is the whole of what is pinned here. The presets themselves are Track E's to grow.
 */
import { afterEach, describe, expect, test } from "@jest/globals";

import { VIEWS } from "../../constant";
import { COMPARISON_PRESETS, comparisonTitle, viewForComparison } from "./comparison";
import { getGlobalState, setComparison } from "./globalState";

afterEach(() => setComparison(null));

describe("setComparison", () => {
  test("defaults to no comparison, on the forecast view", () => {
    expect(getGlobalState("comparison")).toBeNull();
    expect(getGlobalState("view")).toBe(VIEWS.FORECAST);
  });

  test("selecting a preset moves both the comparison and the view it mirrors", () => {
    setComparison("generation");

    expect(getGlobalState("comparison")).toBe("generation");
    expect(getGlobalState("view")).toBe(VIEWS.DELTA);
  });

  test("clearing it returns to the plain forecast", () => {
    setComparison("generation");
    setComparison(null);

    expect(getGlobalState("comparison")).toBeNull();
    expect(getGlobalState("view")).toBe(VIEWS.FORECAST);
  });

  test("every configured preset maps to the delta view", () => {
    for (const preset of COMPARISON_PRESETS) {
      expect(viewForComparison(preset.id)).toBe(VIEWS.DELTA);
    }
  });
});

describe("the chart header's echo", () => {
  test("names the comparison when one is active, and the chart otherwise", () => {
    expect(comparisonTitle(null)).toBe("National forecast");
    expect(comparisonTitle("generation")).toBe("Forecast vs generation");
  });
});
