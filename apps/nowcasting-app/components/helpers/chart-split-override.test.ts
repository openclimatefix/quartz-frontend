/**
 * `setChartSplitOverride` — the write half of the floating chart's per-mode resize (OPEN 5).
 *
 * `geometry.test.ts` covers the pure lookup (`resolveChartSplit`, seeding). This pins the
 * global-state side, and the rule that makes it more than a per-mode `Record` write: **width is
 * shared across modes, height is per mode**, so a commit reaches every mode's width and only
 * its own mode's height. Clearing one (the reset affordance) removes the entry rather than
 * writing the seed's numbers back — see the doc comment on `setChartSplitOverride`.
 */
import { afterEach, describe, expect, test } from "@jest/globals";

import { getGlobalState, setChartSplitOverride, setGlobalState } from "./globalState";
import { CookieStorageKeys, getSettingFromCookieStorage } from "./cookieStorage";
import { CHART_SPLIT } from "../shell/geometry";

afterEach(() => {
  // Reset every mode, not two: a single commit now seeds all four, so clearing a subset leaves
  // the rest behind and the next test starts dirty.
  setGlobalState("chartSplitOverrides", {});
});

describe("setChartSplitOverride", () => {
  test("starts with no overrides stored", () => {
    expect(getGlobalState("chartSplitOverrides")).toEqual({});
  });

  test("stores a mode's dragged size", () => {
    setChartSplitOverride("plain", { width: 60, height: 70 });

    expect(getGlobalState("chartSplitOverrides").plain).toEqual({ width: 60, height: 70 });
  });

  test("a width dragged in one mode becomes every mode's width", () => {
    setChartSplitOverride("plain", { width: 60, height: 70 });

    const stored = getGlobalState("chartSplitOverrides");
    expect(stored.plain).toEqual({ width: 60, height: 70 });
    expect(stored.comparing?.width).toBe(60);
    expect(stored.selected?.width).toBe(60);
    expect(stored.comparingSelected?.width).toBe(60);
  });

  test("a mode that has never been sized keeps its own seed height", () => {
    setChartSplitOverride("plain", { width: 60, height: 70 });

    // Selecting a region still gets the taller panel it seeds with — only the width travelled.
    expect(getGlobalState("chartSplitOverrides").selected).toEqual({
      width: 60,
      height: CHART_SPLIT.selected.height
    });
  });

  test("sizing one mode leaves another mode's height untouched", () => {
    setChartSplitOverride("plain", { width: 60, height: 70 });
    setChartSplitOverride("comparing", { width: 35, height: 50 });

    const stored = getGlobalState("chartSplitOverrides");
    expect(stored.plain).toEqual({ width: 35, height: 70 });
    expect(stored.comparing).toEqual({ width: 35, height: 50 });
  });

  test("resetting a mode (null) removes its entry rather than storing the seed", () => {
    setChartSplitOverride("plain", { width: 60, height: 70 });
    setChartSplitOverride("plain", null);

    const stored = getGlobalState("chartSplitOverrides");
    expect(stored).not.toHaveProperty("plain");
    // The shared width goes back to the reset mode's seed everywhere, or another mode would
    // keep a width the mode you reset from has just disowned.
    expect(stored.comparing?.width).toBe(CHART_SPLIT.plain.width);
  });
});

/**
 * The in-drag frames move state without touching the cookie.
 *
 * A resize commits once per animation frame so the rest of the app tracks it live, and each of
 * those used to `JSON.stringify` and write `document.cookie` — ~60 synchronous cookie-jar writes
 * a second, on the critical path of a direct manipulation. Only the size a gesture *ends* on is
 * worth remembering. What must not break is the invariant the persisted settings rely on: any
 * value a reload could observe was written to state and cookie together.
 */
describe("persistence during a drag", () => {
  test("a transient frame updates state but does not write the cookie", () => {
    setChartSplitOverride("plain", { width: 60, height: 70 });
    const persisted = getSettingFromCookieStorage(CookieStorageKeys.CHART_SPLIT_OVERRIDES);

    setChartSplitOverride("plain", { width: 61, height: 71 }, { persist: false });

    // State has moved — the panel and anything reading it see the live size.
    expect(getGlobalState("chartSplitOverrides").plain).toEqual({ width: 61, height: 71 });
    // The cookie has not — it still holds the last size a gesture ended on.
    expect(getSettingFromCookieStorage(CookieStorageKeys.CHART_SPLIT_OVERRIDES)).toEqual(persisted);
  });

  test("the end of a gesture writes both, so the two can never be observed apart", () => {
    setChartSplitOverride("plain", { width: 61, height: 71 }, { persist: false });
    setChartSplitOverride("plain", { width: 62, height: 72 });

    expect(getGlobalState("chartSplitOverrides").plain).toEqual({ width: 62, height: 72 });
    expect(getSettingFromCookieStorage(CookieStorageKeys.CHART_SPLIT_OVERRIDES)).toEqual(
      getGlobalState("chartSplitOverrides")
    );
  });
});
