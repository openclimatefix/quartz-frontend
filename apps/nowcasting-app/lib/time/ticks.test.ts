import { describe, expect, it } from "@jest/globals";

import { middayInstants, midnightInstants, selectAxisTicks, tickInstants } from "./ticks";

// A 48-hour window, both ends on a clean UTC day boundary — the shape a real chart/scrubber
// range has. `jest.globalSetup.ts` pins the process to UTC, so a zone has to be passed
// explicitly to exercise anything zone-sensitive.
const START = Date.parse("2026-08-10T00:00:00.000Z");
const END = Date.parse("2026-08-12T00:00:00.000Z");

describe("tickInstants", () => {
  it("names every 6-hourly boundary in UTC", () => {
    const ticks = tickInstants(START, END, "UTC", "six-hourly");
    expect(ticks.map((ms) => new Date(ms).toISOString())).toEqual([
      "2026-08-10T00:00:00.000Z",
      "2026-08-10T06:00:00.000Z",
      "2026-08-10T12:00:00.000Z",
      "2026-08-10T18:00:00.000Z",
      "2026-08-11T00:00:00.000Z",
      "2026-08-11T06:00:00.000Z",
      "2026-08-11T12:00:00.000Z",
      "2026-08-11T18:00:00.000Z",
      "2026-08-12T00:00:00.000Z"
    ]);
  });

  it("collapses to midnight/midday only", () => {
    const ticks = tickInstants(START, END, "UTC", "midday-midnight");
    expect(ticks.map((ms) => new Date(ms).toISOString())).toEqual([
      "2026-08-10T00:00:00.000Z",
      "2026-08-10T12:00:00.000Z",
      "2026-08-11T00:00:00.000Z",
      "2026-08-11T12:00:00.000Z",
      "2026-08-12T00:00:00.000Z"
    ]);
  });

  it("labels local midnight/midday, not UTC — a BST range's 00:00 is 23:00 UTC the day before", () => {
    // Europe/London is UTC+1 in August (BST). A range in local terms of 10 Aug 00:00 to
    // 11 Aug 00:00 is 9 Aug 23:00Z to 10 Aug 23:00Z.
    const startLocalMidnight = Date.parse("2026-08-09T23:00:00.000Z");
    const endLocalMidnight = Date.parse("2026-08-10T23:00:00.000Z");
    const ticks = tickInstants(
      startLocalMidnight,
      endLocalMidnight,
      "Europe/London",
      "midday-midnight"
    );
    expect(ticks.map((ms) => new Date(ms).toISOString())).toEqual([
      "2026-08-09T23:00:00.000Z", // 10 Aug 00:00 BST
      "2026-08-10T11:00:00.000Z", // 10 Aug 12:00 BST
      "2026-08-10T23:00:00.000Z" // 11 Aug 00:00 BST
    ]);
  });

  it("survives a DST transition without drifting off the clock hour", () => {
    // GB clocks go back on 2026-10-25, 02:00 BST -> 01:00 GMT: a 25-hour local day.
    const start = Date.parse("2026-10-24T23:00:00.000Z"); // 25 Oct 00:00 BST
    const end = Date.parse("2026-10-26T00:00:00.000Z"); // 26 Oct 00:00 GMT
    const ticks = tickInstants(start, end, "Europe/London", "six-hourly");
    const local = ticks.map((ms) =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(ms)
    );
    // Every tick still lands on a clock-hour boundary in {00,06,12,18}:00 local time, including
    // through the fold — nothing drifts to e.g. 05:00 or 19:00 because a fixed duration was
    // added across the transition instead of each hour being constructed directly.
    for (const time of local) {
      expect(["00:00", "06:00", "12:00", "18:00"]).toContain(time);
    }
    // `.set({ hour })` resolves an ambiguous local time (the repeated 01:00 in the fold) to one
    // instant rather than enumerating both, so the transition day still has exactly one tick per
    // labelled hour — the point of the test is that none of them drifted, not that the fold
    // produces an extra one.
    expect(ticks).toHaveLength(5);
  });

  it("returns nothing for an inverted or empty range", () => {
    expect(tickInstants(END, START, "UTC", "six-hourly")).toEqual([]);
    expect(tickInstants(START, START, "UTC", "six-hourly")).toEqual([]);
  });
});

describe("selectAxisTicks — the space decision", () => {
  const gaps = 8; // 9 six-hourly ticks across the 48h window above

  it("picks 6-hourly when there is comfortably enough space", () => {
    const result = selectAxisTicks({ startMs: START, endMs: END, zone: "UTC", widthPx: gaps * 80 });
    expect(result.density).toBe("six-hourly");
    expect(result.ticks).toHaveLength(9);
  });

  it("picks midnight/midday when 6-hourly is too tight but 12-hourly is not", () => {
    // 40px between six-hourly labels, 80px between midday/midnight ones — the middle rung.
    const result = selectAxisTicks({ startMs: START, endMs: END, zone: "UTC", widthPx: gaps * 40 });
    expect(result.density).toBe("midday-midnight");
    expect(result.ticks).toHaveLength(5);
  });

  it("falls all the way to one label a day when even 12-hourly will not fit", () => {
    const result = selectAxisTicks({ startMs: START, endMs: END, zone: "UTC", widthPx: gaps * 20 });
    expect(result.density).toBe("midnight-only");
    expect(result.ticks).toHaveLength(3);
  });

  it("starts at the sparsest rung when nothing has been measured yet", () => {
    const result = selectAxisTicks({ startMs: START, endMs: END, zone: "UTC", widthPx: 0 });
    expect(result.density).toBe("midnight-only");
  });

  it("holds midnight-only through a resize that does not clear the wide threshold", () => {
    // Its own spacing is comfortable, but stepping *up* to midday/midnight has to clear 76px of
    // that density's spacing — at 35px six-hourly it is 70px, so the sparse rung keeps it.
    const result = selectAxisTicks({
      startMs: START,
      endMs: END,
      zone: "UTC",
      widthPx: gaps * 35,
      previousDensity: "midnight-only"
    });
    expect(result.density).toBe("midnight-only");
  });

  it("has hysteresis at the boundary: a resize that only just crosses the narrow threshold does not flip back on the next tiny change", () => {
    // Starting six-hourly, drop spacing just below the narrow threshold (56px) — should flip.
    const narrowed = selectAxisTicks({
      startMs: START,
      endMs: END,
      zone: "UTC",
      widthPx: gaps * 55,
      previousDensity: "six-hourly"
    });
    expect(narrowed.density).toBe("midday-midnight");

    // Now widen back to just above the narrow threshold but still below the wide threshold
    // (76px): a bare `>=` would flip straight back to six-hourly here. The hysteresis band must
    // hold it at midday-midnight.
    const stillNarrow = selectAxisTicks({
      startMs: START,
      endMs: END,
      zone: "UTC",
      widthPx: gaps * 65,
      previousDensity: narrowed.density
    });
    expect(stillNarrow.density).toBe("midday-midnight");

    // Only once space clears the wide threshold does it switch back.
    const widened = selectAxisTicks({
      startMs: START,
      endMs: END,
      zone: "UTC",
      widthPx: gaps * 77,
      previousDensity: stillNarrow.density
    });
    expect(widened.density).toBe("six-hourly");
  });

  it("is stable the other direction too: coming from six-hourly, space has to drop below the narrow threshold, not just below the wide one", () => {
    const stillWide = selectAxisTicks({
      startMs: START,
      endMs: END,
      zone: "UTC",
      widthPx: gaps * 65, // between the two thresholds
      previousDensity: "six-hourly"
    });
    expect(stillWide.density).toBe("six-hourly");
  });
});

// Track O: the scrub track's midnight hairlines. They must land on exactly the same instants as
// the midnight labels `tickInstants` already produces at "midday-midnight" density, independent
// of whichever density the axis has actually chosen to show.
describe("midnightInstants", () => {
  it("agrees with the midnight half of tickInstants' midday-midnight density", () => {
    const midnights = midnightInstants(START, END, "UTC");
    const fromDensity = tickInstants(START, END, "UTC", "midday-midnight").filter(
      (ms) => new Date(ms).getUTCHours() === 0
    );
    expect(midnights).toEqual(fromDensity);
    expect(midnights.map((ms) => new Date(ms).toISOString())).toEqual([
      "2026-08-10T00:00:00.000Z",
      "2026-08-11T00:00:00.000Z",
      "2026-08-12T00:00:00.000Z"
    ]);
  });

  it("reads local midnight, not UTC midnight — same BST case as tickInstants", () => {
    const startLocalMidnight = Date.parse("2026-08-09T23:00:00.000Z");
    const endLocalMidnight = Date.parse("2026-08-10T23:00:00.000Z");
    const midnights = midnightInstants(startLocalMidnight, endLocalMidnight, "Europe/London");
    expect(midnights.map((ms) => new Date(ms).toISOString())).toEqual([
      "2026-08-09T23:00:00.000Z", // 10 Aug 00:00 BST
      "2026-08-10T23:00:00.000Z" // 11 Aug 00:00 BST
    ]);
  });

  it("survives a DST transition on the clock hour, same as tickInstants", () => {
    // GB clocks go back on 2026-10-25, so the local day is 25 real hours long.
    const start = Date.parse("2026-10-24T23:00:00.000Z"); // 25 Oct 00:00 BST
    const end = Date.parse("2026-10-26T00:00:00.000Z"); // 26 Oct 00:00 GMT
    const midnights = midnightInstants(start, end, "Europe/London");
    expect(midnights.map((ms) => new Date(ms).toISOString())).toEqual([
      "2026-10-24T23:00:00.000Z", // 25 Oct 00:00 BST
      "2026-10-26T00:00:00.000Z" // 26 Oct 00:00 GMT — the transition day has no midnight of its own
    ]);
  });

  it("an inverted or empty range produces nothing", () => {
    expect(midnightInstants(END, START, "UTC")).toEqual([]);
    expect(midnightInstants(START, START, "UTC")).toEqual([]);
  });
});

// The scrub track's midday ticks — the half-height, centred companion to the midnight hairlines.
// Same contract as `midnightInstants`, one hour along, so the same three properties are what
// matter: it agrees with the labelled midday ticks, it is local rather than UTC, and it walks
// calendar days so DST cannot slide it.
describe("middayInstants", () => {
  it("agrees with the midday half of tickInstants' midday-midnight density", () => {
    const middays = middayInstants(START, END, "UTC");
    const fromDensity = tickInstants(START, END, "UTC", "midday-midnight").filter(
      (ms) => new Date(ms).getUTCHours() === 12
    );
    expect(middays).toEqual(fromDensity);
    expect(middays.map((ms) => new Date(ms).toISOString())).toEqual([
      "2026-08-10T12:00:00.000Z",
      "2026-08-11T12:00:00.000Z"
    ]);
  });

  it("reads local midday, not UTC midday — a BST range's 12:00 is 11:00 UTC", () => {
    const middays = middayInstants(START, END, "Europe/London");
    expect(middays.map((ms) => new Date(ms).toISOString())).toEqual([
      "2026-08-10T11:00:00.000Z", // 10 Aug 12:00 BST
      "2026-08-11T11:00:00.000Z" // 11 Aug 12:00 BST
    ]);
  });

  it("stays on the clock hour across a DST transition", () => {
    // The 25 Oct 2026 day is 25 real hours long; midday must still be local 12:00, which is GMT
    // that afternoon rather than sliding an hour with the change.
    const start = Date.parse("2026-10-24T23:00:00.000Z"); // 25 Oct 00:00 BST
    const end = Date.parse("2026-10-26T00:00:00.000Z"); // 26 Oct 00:00 GMT
    const middays = middayInstants(start, end, "Europe/London");
    // 26 Oct's midday falls past `end` and is correctly left out.
    expect(middays.map((ms) => new Date(ms).toISOString())).toEqual([
      "2026-10-25T12:00:00.000Z" // 25 Oct 12:00 GMT — after the clocks went back
    ]);
  });

  it("an inverted or empty range produces nothing", () => {
    expect(middayInstants(END, START, "UTC")).toEqual([]);
    expect(middayInstants(START, START, "UTC")).toEqual([]);
  });
});
