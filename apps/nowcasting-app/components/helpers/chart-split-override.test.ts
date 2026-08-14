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
import { CookieStorageKeys, getSettingFromCookieStorage } from "./cookieStorage";

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
    expect(getSettingFromCookieStorage(CookieStorageKeys.CHART_SPLIT_OVERRIDES)).toEqual({
      plain: { width: 62, height: 72 }
    });
  });
});
