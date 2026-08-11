/**
 * Comparison.
 *
 * Phase 6 §2 replaced the dashboard's three-way view switch with comparison state: `null` is
 * the plain forecast, an id is a preset.
 *
 * Through Wave 3, `setComparison` also wrote a `view: VIEWS` value in lockstep, because a
 * dozen components still read it, and this file pinned that the two could never disagree — a
 * `view` of `FORECAST` with a comparison active would draw the delta map under a chart that
 * reset the cursor whenever the delta series lagged, which is the kind of wrong that looks
 * plausible.
 *
 * Wave 4 retired `view` and its mirroring: every consumer now reads `comparison` directly, or
 * (for the sites/dashboard split `view` also served) the new `isSitesChart` flag. There is no
 * second value left to disagree with, so the "never disagree" tests go — they would otherwise
 * be asserting a relationship that no longer exists — and what is left is what was always the
 * substance underneath them: `setComparison` sets `comparison`, and the chart header's echo
 * names it correctly.
 */
import { afterEach, describe, expect, test } from "@jest/globals";

import { comparisonTitle } from "./comparison";
import { getGlobalState, setComparison } from "./globalState";

afterEach(() => setComparison(null));

describe("setComparison", () => {
  test("defaults to no comparison", () => {
    expect(getGlobalState("comparison")).toBeNull();
  });

  test("selecting a preset sets the comparison", () => {
    setComparison("generation");

    expect(getGlobalState("comparison")).toBe("generation");
  });

  test("clearing it returns to the plain forecast", () => {
    setComparison("generation");
    setComparison(null);

    expect(getGlobalState("comparison")).toBeNull();
  });
});

describe("the chart header's echo", () => {
  test("names the comparison when one is active, and the chart otherwise", () => {
    expect(comparisonTitle(null)).toBe("National forecast");
    expect(comparisonTitle("generation")).toBe("Forecast vs generation");
  });
});
