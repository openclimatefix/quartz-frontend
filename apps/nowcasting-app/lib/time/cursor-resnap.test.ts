/**
 * Re-snapping the cursor onto the focused country's grid must not change which period is shown.
 *
 * Two re-snaps exist: when playback pauses (`snapCursorToFocusedGrid`, playback walks the finest
 * enabled cadence, so it can stop off the focused grid) and when focus moves to a coarser
 * country (`resnapCursorToGrid`, from `setFocusedCountry`). Every country reads the period that
 * starts at or before the cursor (`periodStartForInstant`, a floor), so the snap has to floor too.
 * A ceiling moved the cursor into the next period: paused at 16:15Z, GB's 16:00-16:30 became
 * 16:30-17:00.
 */
import { beforeEach, expect, test } from "@jest/globals";

import {
  getGlobalState,
  setEnabledCountries,
  setFocusedCountry,
  setGlobalState,
  snapCursorToFocusedGrid
} from "../../components/helpers/globalState";
import { periodForInstant } from "./cursor";

const cursor = () => getGlobalState("selectedISOTime");

beforeEach(() => {
  setEnabledCountries(["GB", "NL"]);
  setFocusedCountry("GB");
});

test("pausing off GB's grid keeps the GB period that was on screen", () => {
  const paused = "2026-10-02T16:15:00.000Z";
  setGlobalState("selectedISOTime", paused);
  const before = periodForInstant(paused, "GB");
  expect(before).toEqual({ start: "2026-10-02T16:00:00.000Z", end: "2026-10-02T16:30:00.000Z" });

  snapCursorToFocusedGrid();
  expect(periodForInstant(cursor(), "GB")).toEqual(before);
});

test("pausing off a period-start country's grid keeps its period", () => {
  setFocusedCountry("NL");
  const paused = "2026-10-02T16:20:00.000Z";
  setGlobalState("selectedISOTime", paused);
  const before = periodForInstant(paused, "NL");
  expect(before).toEqual({ start: "2026-10-02T16:15:00.000Z", end: "2026-10-02T16:30:00.000Z" });

  snapCursorToFocusedGrid();
  expect(periodForInstant(cursor(), "NL")).toEqual(before);
});

test("moving focus NL to GB keeps the GB period that contained NL's quarter hour", () => {
  setFocusedCountry("NL");
  const quarter = "2026-10-02T16:15:00.000Z";
  setGlobalState("selectedISOTime", quarter);
  const before = periodForInstant(quarter, "GB");

  setFocusedCountry("GB");
  expect(periodForInstant(cursor(), "GB")).toEqual(before);
  expect(cursor()).toBe("2026-10-02T16:00:00.000Z");
});
