/**
 * `getEarliestForecastTimestamp` / `getFurthestForecastTimestamp` — the API request window.
 *
 * These are all that remain of this file. Everything else it covered was the v0 compact-payload
 * plumbing (`filterCompactHistoricData`, `filterCompactFutureData`,
 * `getOldestTimestampFromCompactForecastValues`, `getOldestTimestampFromForecastValues` and the
 * `calculateHistoricDataStart*` pair), which `pages/index.tsx` was the only caller of and which
 * went with it in Phase 4 wave 4.
 */
import { describe, expect, jest } from "@jest/globals";
import { getEarliestForecastTimestamp, getFurthestForecastTimestamp } from "./data";
import { Settings } from "luxon";
import { afterEach, beforeEach, it } from "@jest/globals";

/**
 * B2. These tests previously pinned the *broken* behaviour; they now assert the corrected one.
 * Two things changed:
 *
 * 1. `getFurthestForecastTimestamp` rounded up by adding `hour % 6`, which is not a round-up at
 *    all — 14:00 became 16:00, which is not one of the 6-hour boundaries the API serves. It now
 *    adds `(6 - hour % 6) % 6`, i.e. a true ceiling: 14:00 -> 18:00, and a value already on a
 *    boundary stays put rather than jumping a whole interval.
 * 2. Both helpers rounded in the *viewer's* local timezone and only then converted to UTC, so a
 *    viewer in Los Angeles or Sydney requested a different window from a viewer in the UK for the
 *    same instant (worst around the boundaries, and across the viewer's own DST changes, where
 *    calendar-day arithmetic in local time shifts the instant by an hour). Rounding now happens
 *    in UTC, which is the only zone the API knows about, so every viewer gets the same window.
 *
 * The old expectations that changed, for the record (frozen now = 2025-12-07T14:45:00Z, UTC
 * viewer): furthest was "2025-12-08T16:00:00.000Z", now "2025-12-08T18:00:00.000Z". Earliest was
 * already right for a UTC viewer; it was only wrong off-zone, e.g. an LA viewer at
 * 2025-11-03T12:00:00Z got "2025-11-01T07:00:00.000Z" where a UK viewer got
 * "2025-11-01T12:00:00.000Z".
 */
describe("forecast window helpers (B2)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Settings.defaultZone = "utc";
  });
  afterEach(() => {
    jest.useRealTimers();
    Settings.defaultZone = "system";
    jest.restoreAllMocks();
  });

  const freeze = (iso: string) => jest.setSystemTime(new Date(iso).getTime());

  describe("getEarliestForecastTimestamp — two days back, rounded DOWN to a 6-hour UTC boundary", () => {
    it.each([
      // [frozen now, expected]
      ["2025-12-07T14:45:00Z", "2025-12-05T12:00:00.000Z"],
      ["2025-12-07T05:59:59Z", "2025-12-05T00:00:00.000Z"],
      ["2025-12-07T23:59:59Z", "2025-12-05T18:00:00.000Z"],
      ["2025-12-07T11:59:59.999Z", "2025-12-05T06:00:00.000Z"],
      // BST, where the old local-zone rounding drifted for UK viewers too
      ["2025-07-15T14:45:00Z", "2025-07-13T12:00:00.000Z"],
      ["2025-07-15T00:30:00Z", "2025-07-13T00:00:00.000Z"],
      // spanning the UK DST boundaries
      ["2025-03-30T02:30:00Z", "2025-03-28T00:00:00.000Z"],
      ["2025-10-26T01:30:00Z", "2025-10-24T00:00:00.000Z"],
      ["2026-03-29T02:30:00Z", "2026-03-27T00:00:00.000Z"],
      ["2026-10-25T01:30:00Z", "2026-10-23T00:00:00.000Z"]
    ])("now = %s -> %s", (now, expected) => {
      freeze(now);
      expect(getEarliestForecastTimestamp()).toBe(expected);
    });

    it.each(["00:00", "06:00", "12:00", "18:00"])(
      "is idempotent on the boundary hour %s (does not jump back a full interval)",
      (hhmm) => {
        freeze(`2025-12-07T${hhmm}:00Z`);
        expect(getEarliestForecastTimestamp()).toBe(`2025-12-05T${hhmm}:00.000Z`);
      }
    );
  });

  describe("getFurthestForecastTimestamp — one day forward, rounded UP to a 6-hour UTC boundary", () => {
    it.each([
      // [frozen now, expected]
      ["2025-12-07T14:45:00Z", "2025-12-08T18:00:00.000Z"], // was "…T16:00:00.000Z" — not a boundary
      ["2025-12-07T14:00:00Z", "2025-12-08T18:00:00.000Z"], // the 14:00 -> 18:00 case from the bug report
      ["2025-12-07T00:00:01Z", "2025-12-08T06:00:00.000Z"],
      ["2025-12-07T18:00:01Z", "2025-12-09T00:00:00.000Z"],
      ["2025-12-07T23:30:00Z", "2025-12-09T00:00:00.000Z"],
      ["2025-07-15T14:45:00Z", "2025-07-16T18:00:00.000Z"],
      ["2025-03-30T02:30:00Z", "2025-03-31T06:00:00.000Z"],
      ["2025-10-26T01:30:00Z", "2025-10-27T06:00:00.000Z"]
    ])("now = %s -> %s", (now, expected) => {
      freeze(now);
      expect(getFurthestForecastTimestamp()).toBe(expected);
    });

    it.each(["00:00", "06:00", "12:00", "18:00"])(
      "is idempotent on the boundary hour %s (does not jump forward a full interval)",
      (hhmm) => {
        freeze(`2025-12-07T${hhmm}:00Z`);
        expect(getFurthestForecastTimestamp()).toBe(`2025-12-08T${hhmm}:00.000Z`);
      }
    );

    it("always returns a real 6-hour boundary, whatever the minute", () => {
      for (let hour = 0; hour < 24; hour++) {
        for (const minute of [0, 1, 29, 30, 45, 59]) {
          freeze(
            `2025-12-07T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`
          );
          const result = getFurthestForecastTimestamp();
          expect(result).toMatch(/T(00|06|12|18):00:00\.000Z$/);
        }
      }
    });
  });

  describe("the viewer's timezone must not change the UTC window", () => {
    const zones = [
      "utc",
      "Europe/London",
      "America/Los_Angeles",
      "Australia/Sydney",
      "Asia/Kolkata"
    ];

    it.each(zones)("a viewer in %s gets the same window as a UK viewer (BST)", (zone) => {
      Settings.defaultZone = zone;
      freeze("2025-07-15T14:45:00Z");
      expect(getEarliestForecastTimestamp()).toBe("2025-07-13T12:00:00.000Z");
      expect(getFurthestForecastTimestamp()).toBe("2025-07-16T18:00:00.000Z");
    });

    it.each(zones)("a viewer in %s gets the same window across their own DST change", (zone) => {
      // US DST ended 2025-11-02, UK's 2025-10-26: calendar-day arithmetic in local time used to
      // shift the instant by an hour here, so viewers disagreed.
      Settings.defaultZone = zone;
      freeze("2025-11-03T12:00:00Z");
      expect(getEarliestForecastTimestamp()).toBe("2025-11-01T12:00:00.000Z");
      expect(getFurthestForecastTimestamp()).toBe("2025-11-04T12:00:00.000Z");
    });
  });
});
