/**
 * `safelyUpdateMapData` — D-map review, finding D4.
 *
 * While any source is loading, `map.isStyleLoaded()` is false and the update is deferred. The
 * deferred replay must apply the newest update requested in that window: replaying the closure
 * captured by the first skipped call painted an older render's values over a newer one (the
 * forecast encoding under a Delta legend). The pending marker lives in memory for the map
 * instance, so nothing left over from before a reload can suppress an update.
 */
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import type mapboxgl from "mapbox-gl";

import { safelyUpdateMapData } from "./mapUtils";

const fakeMap = (title = "Forecast") => {
  let ready = false;
  const container = document.createElement("div");
  container.dataset.title = title;
  return {
    map: {
      getContainer: () => container,
      getSource: () => undefined,
      isStyleLoaded: () => ready
    } as unknown as mapboxgl.Map,
    setReady: (next: boolean) => {
      ready = next;
    }
  };
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "debug").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
  sessionStorage.clear();
});

test("an update applies at once when the map is ready", () => {
  const { map, setReady } = fakeMap();
  setReady(true);
  const applied: string[] = [];
  safelyUpdateMapData(map, () => applied.push("now"));
  expect(applied).toEqual(["now"]);
});

test("the replay applies the latest update requested while loading, once", () => {
  const { map, setReady } = fakeMap();
  const applied: string[] = [];

  safelyUpdateMapData(map, () => applied.push("forecast"));
  safelyUpdateMapData(map, () => applied.push("delta"));
  setReady(true);
  jest.advanceTimersByTime(500);

  expect(applied).toEqual(["delta"]);
});

test("the replay waits while the map is still loading", () => {
  const { map, setReady } = fakeMap();
  const applied: string[] = [];

  safelyUpdateMapData(map, () => applied.push("first"));
  jest.advanceTimersByTime(500);
  safelyUpdateMapData(map, () => applied.push("second"));
  jest.advanceTimersByTime(500);
  expect(applied).toEqual([]);

  setReady(true);
  jest.advanceTimersByTime(500);
  expect(applied).toEqual(["second"]);
});

test("an update applied directly is not overwritten by an older pending one", () => {
  const { map, setReady } = fakeMap();
  const applied: string[] = [];

  safelyUpdateMapData(map, () => applied.push("older"));
  setReady(true);
  safelyUpdateMapData(map, () => applied.push("newer"));
  jest.advanceTimersByTime(500);

  expect(applied).toEqual(["newer"]);
});

test("updates of different kinds are each replayed", () => {
  const { map, setReady } = fakeMap();
  const applied: string[] = [];

  safelyUpdateMapData(map, () => applied.push("data"));
  safelyUpdateMapData(map, () => applied.push("constraints"), "constraints");
  setReady(true);
  jest.advanceTimersByTime(500);

  expect(applied.sort()).toEqual(["constraints", "data"]);
});

test("a marker left in sessionStorage by an earlier page does not suppress the retry", () => {
  const { map, setReady } = fakeMap("Forecast");
  sessionStorage.setItem("MapTimeoutId-Forecast", "123");
  const applied: string[] = [];

  safelyUpdateMapData(map, () => applied.push("after reload"));
  setReady(true);
  jest.advanceTimersByTime(500);

  expect(applied).toEqual(["after reload"]);
});

test("two map instances with the same title keep separate pending updates", () => {
  const first = fakeMap("Forecast");
  const second = fakeMap("Forecast");
  const applied: string[] = [];

  safelyUpdateMapData(first.map, () => applied.push("first"));
  safelyUpdateMapData(second.map, () => applied.push("second"));
  first.setReady(true);
  second.setReady(true);
  jest.advanceTimersByTime(500);

  expect(applied.sort()).toEqual(["first", "second"]);
});
