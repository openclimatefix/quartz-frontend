/**
 * @jest-environment <rootDir>/components/helpers/london.environment.js
 */
/**
 * `addMinutesToISODate` must step by real minutes whatever zone the viewer's browser is in.
 * The suite pins TZ=UTC in its global setup, which hides local-time arithmetic, so this file
 * runs under `london.environment.js`, which sets the process zone to Europe/London for the
 * file and restores it afterwards. For a viewer in London on 2026-10-25 the clocks go back at
 * 01:00Z.
 */
import { describe, expect, test } from "@jest/globals";
import { addMinutesToISODate } from "./utils";

describe("stepping the cursor across the 2026-10-25 clock change (viewer in Europe/London)", () => {
  test("sanity: the process zone is London", () => {
    expect(new Date("2026-07-01T12:00:00Z").getTimezoneOffset()).toBe(-60);
  });

  test("forward +30 from 00:30Z is 01:00Z", () => {
    expect(addMinutesToISODate("2026-10-25T00:30:00.000Z", 30)).toBe("2026-10-25T01:00:00.000Z");
  });

  test("back -30 from 02:00Z is 01:30Z", () => {
    expect(addMinutesToISODate("2026-10-25T02:00:00.000Z", -30)).toBe("2026-10-25T01:30:00.000Z");
  });

  test("NL 15-minute playback stride from 00:45Z is 01:00Z", () => {
    expect(addMinutesToISODate("2026-10-25T00:45:00.000Z", 15)).toBe("2026-10-25T01:00:00.000Z");
  });

  test("spring change: back -30 from 01:00Z on 2027-03-28 is 00:30Z", () => {
    expect(addMinutesToISODate("2027-03-28T01:00:00.000Z", -30)).toBe("2027-03-28T00:30:00.000Z");
  });
});
