/**
 * globalState.tsx seeds itself from cookies at module scope. A cookie that is not JSON, or has
 * the wrong shape, must fall back to the default instead of throwing while the module loads
 * (`country` is a common cookie name; geo cookies set a bare "GB").
 */
import { afterEach, describe, expect, test } from "@jest/globals";
import Cookies from "js-cookie";
import { setSettingInCookieStorage } from "./cookieStorage";

const load = () => {
  let mod: any;
  jest.isolateModules(() => {
    mod = require("./globalState");
  });
  return mod;
};

afterEach(() => {
  for (const k of [
    "country",
    "enabledCountries",
    "visibleLines",
    "pLevels",
    "chartSplitOverrides",
    "constraints"
  ])
    Cookies.remove(k);
});

describe("cookie seeding falls back on bad values", () => {
  test("country=GB (a bare, non-JSON value)", () => {
    document.cookie = "country=GB";
    expect(() => load()).not.toThrow();
  });
  test("pLevels={} (valid JSON, not an array)", () => {
    Cookies.set("pLevels", "{}");
    expect(() => load()).not.toThrow();
  });
  test('visibleLines="FORECAST" (string)', () => {
    Cookies.set("visibleLines", JSON.stringify("FORECAST"));
    const m = load();
    expect(Array.isArray(m.getGlobalState("visibleLines"))).toBe(true);
  });
  test("chartSplitOverrides={plain:{width:'x'}}", () => {
    Cookies.set("chartSplitOverrides", JSON.stringify({ plain: { width: "x", height: null } }));
    const m = load();
    // An invalid entry is dropped, so the mode reads its seed like a mode never resized.
    const stored = Object.values(m.getGlobalState("chartSplitOverrides")) as any[];
    expect(stored.every((v) => Number.isFinite(v.width) && Number.isFinite(v.height))).toBe(true);
    expect(m.getGlobalState("chartSplitOverrides").plain).toBeUndefined();
  });
});

describe("setSettingInCookieStorage", () => {
  test("sets a 365 day expiry", () => {
    const set = jest.spyOn(Cookies, "set");
    setSettingInCookieStorage("pLevels", [[10, 90]]);
    expect(set).toHaveBeenCalledWith("pLevels", "[[10,90]]", { expires: 365 });
    set.mockRestore();
  });
});
