/**
 * `setChartSplitOverride` — the write half of the floating chart's per-mode resize (OPEN 5).
 *
 * `geometry.test.ts` covers the pure lookup (`resolveChartSplit`, seeding, per-mode isolation).
 * This pins the global-state side: a mode's override lands under its own key without disturbing
 * another mode's, and clearing one (the reset affordance) removes the entry rather than writing
 * the seed's numbers back — see the doc comment on `setChartSplitOverride` for why that
 * distinction matters.
 */
import { afterEach, describe, expect, test } from "@jest/globals";

import { getGlobalState, setChartSplitOverride } from "./globalState";

afterEach(() => {
  setChartSplitOverride("plain", null);
  setChartSplitOverride("comparing", null);
});

describe("setChartSplitOverride", () => {
  test("starts with no overrides stored", () => {
    expect(getGlobalState("chartSplitOverrides")).toEqual({});
  });

  test("stores a mode's dragged size", () => {
    setChartSplitOverride("plain", { width: 60, height: 70 });

    expect(getGlobalState("chartSplitOverrides").plain).toEqual({ width: 60, height: 70 });
  });

  test("sizing one mode leaves another mode's override untouched", () => {
    setChartSplitOverride("plain", { width: 60, height: 70 });
    setChartSplitOverride("comparing", { width: 35, height: 50 });

    expect(getGlobalState("chartSplitOverrides")).toEqual({
      plain: { width: 60, height: 70 },
      comparing: { width: 35, height: 50 }
    });
  });

  test("resetting a mode (null) removes its entry rather than storing the seed", () => {
    setChartSplitOverride("plain", { width: 60, height: 70 });
    setChartSplitOverride("plain", null);

    expect(getGlobalState("chartSplitOverrides")).not.toHaveProperty("plain");
  });
});
